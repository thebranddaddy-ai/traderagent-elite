import OpenAI from "openai";
import { calculateTradingDNA } from "./tradingDNA";
import { storage } from "../storage";
import { aiAuditLogger } from "./aiAuditLogger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PositionContext {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number | null;
  takeProfit: number | null;
}

interface ExitAdvice {
  recommendation: "HOLD" | "EXIT_PARTIAL" | "EXIT_ALL" | "TIGHTEN_STOP";
  reasoning: string;
  confidence: number;
  keyPoints: string[];
  suggestedAction?: string;
}

export async function generateExitAdvice(
  userId: string,
  positionContext: PositionContext
): Promise<ExitAdvice> {
  try {
    // Get user's trading DNA
    const dna = await calculateTradingDNA(userId);
    
    // Get market sentiment for this asset from database
    let sentiment = null;
    try {
      const allSentiments = await storage.getAllLatestSentiments();
      sentiment = allSentiments.find((s: any) => s.symbol === positionContext.symbol);
    } catch (error) {
      console.log("Could not fetch sentiment, proceeding without it");
    }

    // Calculate position metrics
    const isProfit = positionContext.pnl > 0;
    const profitTarget = positionContext.takeProfit 
      ? ((positionContext.takeProfit - positionContext.avgPrice) / positionContext.avgPrice) * 100
      : null;
    const stopLossDistance = positionContext.stopLoss
      ? ((positionContext.avgPrice - positionContext.stopLoss) / positionContext.avgPrice) * 100
      : null;

    // Build AI prompt for exit decision
    const prompt = `You are an expert trading advisor helping a trader decide whether to exit their position. Analyze the position and provide a clear, logical recommendation.

POSITION DETAILS:
- Asset: ${positionContext.symbol}
- Entry Price: $${positionContext.avgPrice.toLocaleString()}
- Current Price: $${positionContext.currentPrice.toLocaleString()}
- Quantity: ${positionContext.quantity}
- P/L: ${isProfit ? '+' : ''}$${positionContext.pnl.toLocaleString()} (${positionContext.pnlPercent.toFixed(2)}%)
${positionContext.stopLoss ? `- Stop Loss: $${positionContext.stopLoss.toLocaleString()} (${stopLossDistance?.toFixed(2)}% away)` : '- Stop Loss: Not Set ⚠️'}
${positionContext.takeProfit ? `- Take Profit: $${positionContext.takeProfit.toLocaleString()} (${profitTarget?.toFixed(2)}% target)` : '- Take Profit: Not Set'}

TRADER'S DNA:
- Win Rate: ${dna.winRate.toFixed(1)}%
- Profit Factor: ${dna.profitFactor.toFixed(2)}
- Trading Style: ${dna.tradingStyle || 'Balanced'}
${sentiment ? `
MARKET SENTIMENT (${positionContext.symbol}):
- Sentiment: ${sentiment.sentiment}
- Analysis: ${sentiment.analysis}
` : ''}

YOUR TASK:
1. Analyze the position logically (ignore emotions)
2. Consider: P/L, market sentiment, stop-loss placement, take-profit distance
3. Make ONE clear recommendation: HOLD, EXIT_PARTIAL (take some profit), EXIT_ALL, or TIGHTEN_STOP (move stop-loss closer)
4. Provide 3-5 key bullet points explaining your reasoning
5. Assign confidence level (0-100)
6. Suggest specific action if applicable

GUIDELINES:
- If P/L > +15% with no take-profit set → Consider taking partial profit
- If position has no stop-loss → Recommend setting one (TIGHTEN_STOP)
- If near take-profit target → Consider exit strategy
- If losing position with negative sentiment → May suggest EXIT_ALL
- If winning position with positive momentum → May suggest HOLD or TIGHTEN_STOP
- Protect capital first, maximize profit second

Respond in JSON format:
{
  "recommendation": "HOLD" | "EXIT_PARTIAL" | "EXIT_ALL" | "TIGHTEN_STOP",
  "reasoning": "Brief explanation in 2-3 sentences",
  "confidence": 75,
  "keyPoints": [
    "Bullet point 1",
    "Bullet point 2",
    "Bullet point 3"
  ],
  "suggestedAction": "Optional: Specific action like 'Exit 50% at current price' or 'Set stop-loss at $X'"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional trading advisor focused on logical, non-emotional exit decisions. Provide clear recommendations that prioritize capital protection and profit-taking discipline."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 600,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{}';
    
    // Strip markdown formatting if present
    const cleanContent = content.replace(/^```json\n?/g, '').replace(/\n?```$/g, '').trim();
    
    const advice: ExitAdvice = JSON.parse(cleanContent);
    
    // Validate and sanitize
    if (!advice.recommendation || !['HOLD', 'EXIT_PARTIAL', 'EXIT_ALL', 'TIGHTEN_STOP'].includes(advice.recommendation)) {
      advice.recommendation = 'HOLD';
    }
    
    if (typeof advice.confidence !== 'number' || isNaN(advice.confidence)) {
      advice.confidence = 50;
    }
    
    advice.confidence = Math.max(0, Math.min(100, advice.confidence));
    
    if (!Array.isArray(advice.keyPoints)) {
      advice.keyPoints = [];
    }
    
    // Log AI interaction for transparency
    await aiAuditLogger.logAIInteraction({
      userId,
      featureType: 'exit_advisor',
      modelVersion: 'gpt-4o-mini',
      inputData: {
        position: positionContext,
        tradingDNA: dna,
        marketSentiment: sentiment
      },
      outputData: advice,
      explanation: advice.reasoning,
      confidence: advice.confidence
    });
    
    return advice;
  } catch (error) {
    console.error("Error generating exit advice:", error);
    throw new Error("Failed to generate AI exit advice");
  }
}
