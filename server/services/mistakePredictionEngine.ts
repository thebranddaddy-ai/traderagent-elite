import { db } from '../db';
import { mistakePredictions, paperOrders, tradingPatterns, users, aiPersonalExamples, aiAgentHealth } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { shadowLearningLogger } from './shadowLearningLogger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TradeSetup {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'market' | 'limit';
  leverage?: number;
}

interface MistakePredictionResult {
  hasPrediction: boolean;
  prediction?: {
    id?: string; // PHASE 5: Include prediction ID for tracking
    predictionType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    reasoning: string;
    evidence: string[];
    alternativeSuggestion: string;
    triggerFactors: string[];
  };
}

export const mistakePredictionEngine = {
  /**
   * Analyze a trade setup before execution and predict potential mistakes
   */
  async analyzeTrade(setup: TradeSetup): Promise<MistakePredictionResult> {
    // 1. Get user's recent trading context
    const context = await this.getUserTradingContext(setup.userId);
    
    // 2. Detect potential mistake patterns
    const mistakeIndicators = await this.detectMistakeIndicators(setup, context);
    
    // 3. If indicators found, get AI analysis
    if (mistakeIndicators.length > 0) {
      const aiAnalysis = await this.getAIPrediction(setup, context, mistakeIndicators);
      
      // 4. Save prediction to database and get ID
      const savedPrediction = await this.savePrediction({
        userId: setup.userId,
        symbol: setup.symbol,
        side: setup.side,
        quantity: String(setup.quantity),
        price: setup.price ? String(setup.price) : null,
        ...aiAnalysis,
      });
      
      return {
        hasPrediction: true,
        prediction: {
          ...aiAnalysis,
          id: savedPrediction[0].id, // Include prediction ID for tracking
        },
      };
    }
    
    return { hasPrediction: false };
  },

  /**
   * Get user's recent trading context (PHASE 5: Enhanced with DNA + Feedback)
   */
  async getUserTradingContext(userId: string) {
    // Get recent trades (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await db
      .select()
      .from(paperOrders)
      .where(
        and(
          sql`${paperOrders.walletId} IN (SELECT id FROM paper_wallets WHERE user_id = ${userId})`,
          sql`${paperOrders.timestamp} > ${oneDayAgo}`
        )
      )
      .orderBy(desc(paperOrders.timestamp))
      .limit(20);
    
    // Get recent trading patterns
    const recentPatterns = await db
      .select()
      .from(tradingPatterns)
      .where(
        and(
          eq(tradingPatterns.userId, userId),
          sql`${tradingPatterns.detectedAt} > ${oneDayAgo}`
        )
      )
      .orderBy(desc(tradingPatterns.detectedAt))
      .limit(10);
    
    // PHASE 5: Get Trading DNA for personalized predictions
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    // PHASE 5: Get AI agent health for confidence adjustments
    const [agentHealth] = await db
      .select()
      .from(aiAgentHealth)
      .where(eq(aiAgentHealth.userId, userId))
      .limit(1);
    
    // PHASE 5: Get recent feedback patterns (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFeedback = await db
      .select()
      .from(aiPersonalExamples)
      .where(
        and(
          eq(aiPersonalExamples.userId, userId),
          sql`${aiPersonalExamples.timestamp} > ${sevenDaysAgo}`
        )
      )
      .orderBy(desc(aiPersonalExamples.timestamp))
      .limit(20);
    
    // Analyze feedback trends
    const feedbackTrends = {
      totalFeedback: recentFeedback.length,
      positiveCount: recentFeedback.filter(f => f.feedbackType === 'thumbs_up').length,
      negativeCount: recentFeedback.filter(f => f.feedbackType === 'thumbs_down').length,
      recentlyIgnoredWarnings: recentFeedback.filter(
        f => f.contextType === 'risk_warning' && f.userAction === 'ignored'
      ).length,
      // Check if user tends to ignore suggestions
      ignoresAIFrequently: recentFeedback.filter(f => f.userAction === 'ignored').length > recentFeedback.length * 0.6,
    };
    
    // Calculate session stats
    const tradesInLastHour = recentTrades.filter(
      t => new Date(t.timestamp).getTime() > Date.now() - 60 * 60 * 1000
    ).length;
    
    const recentLosses = recentTrades
      .filter(t => t.status === 'completed')
      .slice(0, 5);
    
    const consecutiveLosses = this.countConsecutiveLosses(recentLosses);
    
    return {
      recentTrades,
      recentPatterns,
      tradesInLastHour,
      consecutiveLosses,
      hasRecentLoss: consecutiveLosses > 0,
      tradingSessionDuration: this.calculateSessionDuration(recentTrades),
      // Phase 5 additions
      tradingDNA: {
        archetype: user?.archetype || 'guardian',
        dataShareOptIn: user?.dataShareOptIn || false,
      },
      agentHealth: {
        confidenceScore: agentHealth ? parseFloat(agentHealth.confidenceScore) : 0,
        readinessLevel: agentHealth?.readinessLevel || 'learning',
        totalExamples: agentHealth?.totalExamples || 0,
      },
      feedbackTrends,
    };
  },

  /**
   * Detect mistake indicators
   */
  async detectMistakeIndicators(setup: TradeSetup, context: any): Promise<string[]> {
    const indicators: string[] = [];
    
    // Overtrading detection
    if (context.tradesInLastHour >= 5) {
      indicators.push('overtrading');
    }
    
    // Revenge trading detection
    if (context.consecutiveLosses >= 2 && context.tradesInLastHour >= 2) {
      indicators.push('revenge_trading');
    }
    
    // FOMO detection (rapid successive trades)
    if (context.tradesInLastHour >= 3 && context.tradingSessionDuration < 30) {
      indicators.push('fomo');
    }
    
    // Trading fatigue (long session with many trades)
    if (context.tradingSessionDuration > 180 && context.recentTrades.length > 15) {
      indicators.push('trading_fatigue');
    }
    
    // High leverage risk detection
    const leverage = setup.leverage || 1;
    if (leverage > 5) {
      indicators.push('high_leverage_risk');
    }
    
    // Position size risk detection (warn if position value exceeds typical thresholds)
    // For market orders, use current market price if not provided by frontend
    let price = setup.price || 0;
    if (price === 0 && setup.orderType === 'market') {
      const { getMarketPrice } = await import('./paperTrading');
      price = getMarketPrice(setup.symbol);
    }
    
    if (price > 0) {
      const positionValue = setup.quantity * price * leverage;
      if (positionValue > 10000) {
        indicators.push('large_position_size');
      }
    }
    
    // Pattern-based detection
    const revengePattern = context.recentPatterns.find(
      (p: any) => p.patternType === 'revenge_trading'
    );
    if (revengePattern) {
      indicators.push('revenge_pattern_detected');
    }
    
    const fomoPattern = context.recentPatterns.find(
      (p: any) => p.patternType === 'fomo'
    );
    if (fomoPattern) {
      indicators.push('fomo_pattern_detected');
    }
    
    return indicators;
  },

  /**
   * Get AI prediction using GPT-4
   */
  async getAIPrediction(
    setup: TradeSetup,
    context: any,
    indicators: string[]
  ): Promise<{
    predictionType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    reasoning: string;
    evidence: string[];
    alternativeSuggestion: string;
    triggerFactors: string[];
  }> {
    const prompt = `You are an AI trading coach analyzing a potential trading mistake.

TRADE SETUP:
- Symbol: ${setup.symbol}
- Side: ${setup.side}
- Quantity: ${setup.quantity}
- Type: ${setup.orderType}

TRADER CONTEXT:
- Trades in last hour: ${context.tradesInLastHour}
- Consecutive losses: ${context.consecutiveLosses}
- Session duration: ${context.tradingSessionDuration} minutes
- Recent patterns: ${context.recentPatterns.map((p: any) => p.patternType).join(', ')}

TRADER DNA (PHASE 5):
- Archetype: ${context.tradingDNA.archetype}
- Agent Readiness: ${context.agentHealth.readinessLevel} (confidence: ${context.agentHealth.confidenceScore}%)
- Learning Examples: ${context.agentHealth.totalExamples}

FEEDBACK TRENDS (PHASE 5):
- Total recent feedback: ${context.feedbackTrends.totalFeedback}
- Positive feedback: ${context.feedbackTrends.positiveCount}
- Negative feedback: ${context.feedbackTrends.negativeCount}
- Ignored warnings recently: ${context.feedbackTrends.recentlyIgnoredWarnings}
- Tends to ignore AI: ${context.feedbackTrends.ignoresAIFrequently ? 'Yes' : 'No'}

DETECTED INDICATORS: ${indicators.join(', ')}

IMPORTANT: 
- Use the trader's DNA archetype to personalize the prediction
- If agent readiness is "learning" or "training", acknowledge this is still learning their patterns
- If user frequently ignores warnings, be more direct but calm
- Adjust confidence based on agent's learning progress

Analyze this trade setup and predict if the trader is about to make a mistake. Respond in JSON format:
{
  "predictionType": "revenge_trading|fomo|overtrading|emotional_entry|poor_timing|oversized_position",
  "severity": "low|medium|high|critical",
  "confidence": 0-100,
  "reasoning": "Clear, personalized explanation considering their DNA and feedback history",
  "evidence": ["specific evidence point 1", "specific evidence point 2"],
  "alternativeSuggestion": "What the trader should do instead, personalized to their archetype",
  "triggerFactors": ["factor1", "factor2"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert trading psychologist who helps traders avoid emotional mistakes. Be direct, evidence-based, and protective.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // SHADOW LEARNING: Log AI interaction to audit_log.jsonl
    await shadowLearningLogger.log({
      userId: setup.userId,
      feature: 'mistake_prediction',
      input_prompt: prompt,
      model_response: response.choices[0].message.content || '{}',
      confidence: result.confidence || 0,
      metadata: {
        symbol: setup.symbol,
        side: setup.side,
        quantity: setup.quantity,
        prediction_type: result.predictionType,
      },
    });
    
    return result;
  },

  /**
   * Save prediction to database
   */
  async savePrediction(data: any) {
    return await db.insert(mistakePredictions).values({
      userId: data.userId,
      symbol: data.symbol,
      side: data.side,
      quantity: data.quantity,
      price: data.price,
      predictionType: data.predictionType,
      severity: data.severity,
      confidence: String(data.confidence),
      reasoning: data.reasoning,
      evidence: JSON.stringify(data.evidence),
      alternativeSuggestion: data.alternativeSuggestion,
      triggerFactors: JSON.stringify(data.triggerFactors),
    }).returning();
  },

  /**
   * Record user response to prediction (with ownership check)
   */
  async recordUserResponse(
    predictionId: string,
    userId: string,
    response: 'dismissed' | 'modified_trade' | 'cancelled' | 'proceeded_anyway',
    wasHeeded: boolean
  ) {
    // Verify ownership
    const [prediction] = await db
      .select()
      .from(mistakePredictions)
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      )
      .limit(1);
    
    if (!prediction) {
      throw new Error('Prediction not found or access denied');
    }
    
    return await db
      .update(mistakePredictions)
      .set({
        userResponse: response,
        wasHeeded,
      })
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      );
  },

  /**
   * Record trade execution outcome (with ownership check)
   */
  async recordOutcome(
    predictionId: string,
    userId: string,
    tradeId: string,
    outcome: 'prediction_correct' | 'prediction_wrong' | 'neutral',
    details: any
  ) {
    // Verify ownership
    const [prediction] = await db
      .select()
      .from(mistakePredictions)
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      )
      .limit(1);
    
    if (!prediction) {
      throw new Error('Prediction not found or access denied');
    }
    
    return await db
      .update(mistakePredictions)
      .set({
        tradeExecuted: true,
        tradeId,
        actualOutcome: outcome,
        outcomeDetails: JSON.stringify(details),
        predictionAccurate: outcome === 'prediction_correct',
      })
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      );
  },

  /**
   * Helper: Count consecutive losses
   */
  countConsecutiveLosses(trades: any[]): number {
    let count = 0;
    for (const trade of trades) {
      // Check if trade resulted in loss (basic check - would need actual P/L calculation)
      if (trade.status === 'completed') {
        // This is simplified - you'd calculate actual P/L
        count++;
      } else {
        break;
      }
    }
    return count;
  },

  /**
   * Helper: Calculate session duration in minutes
   */
  calculateSessionDuration(trades: any[]): number {
    if (trades.length === 0) return 0;
    
    const now = Date.now();
    const firstTradeTime = new Date(trades[trades.length - 1].timestamp).getTime();
    
    return Math.floor((now - firstTradeTime) / (60 * 1000));
  },
};
