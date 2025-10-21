import { db } from '../db';
import { tradeJournalEntries, paperOrders, tradingPatterns } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TradeData {
  userId: string;
  tradeId: string;
  tradeType: 'paper' | 'live' | 'simulated';
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profitLoss?: number;
  profitLossPercent?: number;
}

interface JournalEntry {
  id: string;
  userId: string;
  tradeId: string;
  tradeType: string;
  symbol: string;
  side: string;
  entryPrice: string;
  exitPrice?: string;
  quantity: string;
  profitLoss?: string;
  profitLossPercent?: string;
  aiInsights?: string;
  lessonsLearned?: string;
  mistakesMade?: string;
  whatWorked?: string;
  whatDidntWork?: string;
  detectedPatterns?: string;
  tradeRank?: string;
  entryTimestamp: Date;
  exitTimestamp?: Date;
  createdAt: Date;
}

export const aiTradeJournal = {
  /**
   * Auto-log a trade with AI-generated insights
   */
  async logTrade(tradeData: TradeData): Promise<JournalEntry> {
    try {
      // 1. Get trading context
      const context = await this.getTradingContext(tradeData.userId, tradeData.symbol);
      
      // 2. Generate AI insights
      const aiAnalysis = await this.generateAIInsights(tradeData, context);
      
      // 3. Detect patterns
      const patterns = await this.detectTradePatterns(tradeData, context);
      
      // 4. Rank the trade
      const tradeRank = this.rankTrade(tradeData, aiAnalysis);
      
      // 5. Save to database
      const [entry] = await db.insert(tradeJournalEntries).values({
        userId: tradeData.userId,
        tradeId: tradeData.tradeId,
        tradeType: tradeData.tradeType,
        symbol: tradeData.symbol,
        side: tradeData.side,
        entryPrice: String(tradeData.entryPrice),
        exitPrice: tradeData.exitPrice ? String(tradeData.exitPrice) : null,
        quantity: String(tradeData.quantity),
        profitLoss: tradeData.profitLoss ? String(tradeData.profitLoss) : null,
        profitLossPercent: tradeData.profitLossPercent ? String(tradeData.profitLossPercent) : null,
        marketCondition: context.marketCondition,
        userEmotionalState: aiAnalysis.emotionalState,
        tradingSessionDuration: context.sessionDuration,
        consecutiveTradesCount: context.consecutiveTrades,
        aiInsights: JSON.stringify(aiAnalysis.insights),
        lessonsLearned: JSON.stringify(aiAnalysis.lessons),
        mistakesMade: JSON.stringify(aiAnalysis.mistakes),
        whatWorked: JSON.stringify(aiAnalysis.strengths),
        whatDidntWork: JSON.stringify(aiAnalysis.weaknesses),
        detectedPatterns: JSON.stringify(patterns),
        tradeRank,
        strategicAlignment: String(aiAnalysis.strategicAlignment),
        riskRewardRatio: tradeData.exitPrice 
          ? String(this.calculateRiskReward(tradeData)) 
          : null,
        entryTimestamp: new Date(),
        exitTimestamp: tradeData.exitPrice ? new Date() : null,
      }).returning();
      
      return entry as JournalEntry;
    } catch (error) {
      console.error('Trade journal logging error:', error);
      throw error;
    }
  },

  /**
   * Get trading context for AI analysis
   */
  async getTradingContext(userId: string, symbol: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get recent trades
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
    
    // Get recent patterns
    const recentPatterns = await db
      .select()
      .from(tradingPatterns)
      .where(
        and(
          eq(tradingPatterns.userId, userId),
          sql`${tradingPatterns.detectedAt} > ${oneDayAgo}`
        )
      )
      .orderBy(desc(tradingPatterns.detectedAt));
    
    // Calculate session stats
    const tradesInSession = recentTrades.filter(
      t => new Date(t.timestamp).getTime() > Date.now() - 4 * 60 * 60 * 1000
    ).length;
    
    const sessionDuration = this.calculateSessionDuration(recentTrades);
    
    // Determine market condition (simplified - would integrate with market data)
    const marketCondition = this.inferMarketCondition(recentTrades, symbol);
    
    return {
      recentTrades,
      recentPatterns,
      consecutiveTrades: tradesInSession,
      sessionDuration,
      marketCondition,
    };
  },

  /**
   * Generate AI insights using GPT-4
   */
  async generateAIInsights(tradeData: TradeData, context: any) {
    const isProfitable = (tradeData.profitLoss ?? 0) > 0;
    
    const prompt = `You are an AI trading journal assistant analyzing a completed trade.

TRADE DETAILS:
- Symbol: ${tradeData.symbol}
- Side: ${tradeData.side}
- Entry: $${tradeData.entryPrice}
- Exit: ${tradeData.exitPrice ? `$${tradeData.exitPrice}` : 'Still open'}
- P/L: ${tradeData.profitLoss ? `$${tradeData.profitLoss}` : 'N/A'}
- P/L %: ${tradeData.profitLossPercent ? `${tradeData.profitLossPercent}%` : 'N/A'}

CONTEXT:
- Market: ${context.marketCondition}
- Session trades: ${context.consecutiveTrades}
- Session duration: ${context.sessionDuration} minutes
- Recent patterns: ${context.recentPatterns.map((p: any) => p.patternType).join(', ')}

Analyze this trade and provide insights in JSON format:
{
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "lessons": ["lesson 1", "lesson 2"],
  "mistakes": ["mistake 1", "mistake 2"] or [],
  "strengths": ["what worked 1", "what worked 2"],
  "weaknesses": ["what didn't work 1", "what didn't work 2"] or [],
  "emotionalState": "calm|stressed|confident|fearful|neutral",
  "strategicAlignment": 0-100
}

Be specific, actionable, and honest. Focus on learning and improvement.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert trading coach providing constructive trade analysis. Be specific, evidence-based, and focused on helping traders improve.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  },

  /**
   * Detect trading patterns in this trade
   */
  async detectTradePatterns(tradeData: TradeData, context: any): Promise<string[]> {
    const patterns: string[] = [];
    
    // Check for revenge trading pattern
    const hasRecentLoss = context.recentTrades.slice(0, 3).some((t: any) => {
      // Simplified - would calculate actual P/L
      return t.status === 'completed';
    });
    
    if (hasRecentLoss && context.consecutiveTrades >= 3) {
      patterns.push('potential_revenge_trading');
    }
    
    // Check for FOMO pattern
    if (context.sessionDuration < 30 && context.consecutiveTrades >= 4) {
      patterns.push('rapid_trading_fomo');
    }
    
    // Check for overtrading
    if (context.consecutiveTrades >= 10) {
      patterns.push('overtrading');
    }
    
    // Add detected patterns from database
    const dbPatterns = context.recentPatterns.map((p: any) => p.patternType);
    patterns.push(...dbPatterns);
    
    return Array.from(new Set(patterns)); // Remove duplicates
  },

  /**
   * Rank the trade based on performance
   */
  rankTrade(tradeData: TradeData, aiAnalysis: any): string {
    if (!tradeData.profitLossPercent) return 'pending';
    
    const plPercent = tradeData.profitLossPercent;
    const alignment = aiAnalysis.strategicAlignment || 50;
    
    // Combine P/L and strategic alignment for ranking
    if (plPercent > 5 && alignment > 70) return 'excellent';
    if (plPercent > 2 && alignment > 50) return 'good';
    if (plPercent > -2 && plPercent <= 2) return 'average';
    if (plPercent < -2 && plPercent >= -5) return 'poor';
    if (plPercent < -5) return 'terrible';
    
    return 'average';
  },

  /**
   * Calculate risk-reward ratio
   */
  calculateRiskReward(tradeData: TradeData): number {
    if (!tradeData.exitPrice) return 0;
    
    const entry = tradeData.entryPrice;
    const exit = tradeData.exitPrice;
    
    if (tradeData.side === 'buy') {
      const profit = exit - entry;
      const risk = entry * 0.02; // Assume 2% risk (simplified)
      return profit / risk;
    } else {
      const profit = entry - exit;
      const risk = entry * 0.02;
      return profit / risk;
    }
  },

  /**
   * Get journal entries for a user
   */
  async getUserJournal(userId: string, limit = 50): Promise<JournalEntry[]> {
    const entries = await db
      .select()
      .from(tradeJournalEntries)
      .where(eq(tradeJournalEntries.userId, userId))
      .orderBy(desc(tradeJournalEntries.createdAt))
      .limit(limit);
    
    return entries as JournalEntry[];
  },

  /**
   * Get journal entry by ID
   */
  async getEntryById(entryId: string): Promise<JournalEntry | null> {
    const [entry] = await db
      .select()
      .from(tradeJournalEntries)
      .where(eq(tradeJournalEntries.id, entryId))
      .limit(1);
    
    return (entry as JournalEntry) || null;
  },

  /**
   * Add user notes to journal entry (with ownership check)
   */
  async addUserNotes(entryId: string, userId: string, notes: string, tags?: string[]) {
    // Verify ownership
    const [entry] = await db
      .select()
      .from(tradeJournalEntries)
      .where(
        and(
          eq(tradeJournalEntries.id, entryId),
          eq(tradeJournalEntries.userId, userId)
        )
      )
      .limit(1);
    
    if (!entry) {
      throw new Error('Journal entry not found or access denied');
    }
    
    return await db
      .update(tradeJournalEntries)
      .set({
        userNotes: notes,
        tags: tags ? JSON.stringify(tags) : null,
      })
      .where(
        and(
          eq(tradeJournalEntries.id, entryId),
          eq(tradeJournalEntries.userId, userId)
        )
      );
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

  /**
   * Helper: Infer market condition from recent trades
   */
  inferMarketCondition(trades: any[], symbol: string): string {
    // Simplified - would integrate with actual market data
    if (trades.length < 3) return 'unknown';
    
    const symbolTrades = trades.filter((t: any) => t.symbol === symbol);
    if (symbolTrades.length >= 3) {
      return 'volatile'; // Simplified inference
    }
    
    return 'stable';
  },
};
