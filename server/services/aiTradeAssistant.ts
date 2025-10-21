import OpenAI from "openai";
import { calculateTradingDNA } from "./tradingDNA";
import { storage } from "../storage";
import { aiAuditLogger } from "./aiAuditLogger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TradeContext {
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  availableBalance: number;
}

export async function generateTradeAdvice(
  userId: string,
  question: string,
  tradeContext: TradeContext
): Promise<string> {
  try {
    // Get user's trading DNA for personalized advice
    const dna = await calculateTradingDNA(userId);
    
    // Get recent trades to understand user's trading style
    const recentTrades = await storage.getTradesByUserId(userId);
    const last5Trades = recentTrades.slice(0, 5);
    
    // Calculate potential P/L
    let potentialProfit = 0;
    let potentialLoss = 0;
    let riskRewardRatio = 0;
    
    if (tradeContext.takeProfit && tradeContext.quantity > 0) {
      if (tradeContext.side === "buy") {
        potentialProfit = (tradeContext.takeProfit - tradeContext.currentPrice) * tradeContext.quantity;
      } else {
        potentialProfit = (tradeContext.currentPrice - tradeContext.takeProfit) * tradeContext.quantity;
      }
    }
    
    if (tradeContext.stopLoss && tradeContext.quantity > 0) {
      if (tradeContext.side === "buy") {
        potentialLoss = (tradeContext.currentPrice - tradeContext.stopLoss) * tradeContext.quantity;
      } else {
        potentialLoss = (tradeContext.stopLoss - tradeContext.currentPrice) * tradeContext.quantity;
      }
    }
    
    if (potentialLoss > 0) {
      riskRewardRatio = potentialProfit / potentialLoss;
    }

    const tradeTotal = tradeContext.quantity * tradeContext.currentPrice;
    const balanceAfterTrade = tradeContext.availableBalance - tradeTotal;
    const positionSize = (tradeTotal / tradeContext.availableBalance) * 100;

    // Build AI prompt with trading context
    const prompt = `You are an expert AI trading advisor helping a trader make better decisions. Analyze their trade setup and answer their question.

TRADER'S QUESTION:
${question}

CURRENT TRADE SETUP:
- Asset: ${tradeContext.symbol}
- Side: ${tradeContext.side.toUpperCase()}
- Type: ${tradeContext.orderType}
- Quantity: ${tradeContext.quantity}
- Entry Price: $${tradeContext.currentPrice.toLocaleString()}
- Total Cost: $${tradeTotal.toLocaleString()}
${tradeContext.stopLoss ? `- Stop Loss: $${tradeContext.stopLoss.toLocaleString()}` : '- Stop Loss: Not Set'}
${tradeContext.takeProfit ? `- Take Profit: $${tradeContext.takeProfit.toLocaleString()}` : '- Take Profit: Not Set'}

RISK METRICS:
- Available Balance: $${tradeContext.availableBalance.toLocaleString()}
- Balance After Trade: $${balanceAfterTrade.toLocaleString()}
- Position Size: ${positionSize.toFixed(1)}%
${potentialProfit > 0 ? `- Potential Profit: +$${potentialProfit.toLocaleString()}` : ''}
${potentialLoss > 0 ? `- Potential Loss: -$${potentialLoss.toLocaleString()}` : ''}
${riskRewardRatio > 0 ? `- Risk/Reward Ratio: 1:${riskRewardRatio.toFixed(2)}` : ''}

TRADER'S DNA:
- Win Rate: ${dna.winRate.toFixed(1)}%
- Profit Factor: ${dna.profitFactor.toFixed(2)}
- Recent Performance: ${last5Trades.length > 0 ? `Last ${last5Trades.length} trades recorded` : 'No recent trades'}

INSTRUCTIONS:
1. Answer the trader's specific question directly and clearly
2. Provide actionable insights based on the trade setup
3. Assess risk level (Low/Medium/High) based on position size and R:R ratio
4. If stop-loss or take-profit is missing, recommend setting them
5. Highlight any red flags (e.g., position too large, poor R:R ratio)
6. Keep response concise but informative (max 200 words)
7. Be supportive but honest - protect the trader from bad decisions
8. Use everyday language, avoid excessive jargon

Response format: Direct answer, then brief analysis with clear recommendations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional trading advisor focused on risk management and helping traders make informed decisions. Provide clear, actionable advice that prioritizes capital preservation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const advice = response.choices[0].message.content || "Unable to generate advice at this time.";
    
    // Log AI interaction for transparency
    await aiAuditLogger.logAIInteraction({
      userId,
      featureType: 'trade_assistant',
      modelVersion: 'gpt-4o-mini',
      inputData: {
        question,
        tradeContext,
        tradingDNA: dna,
        recentTrades: last5Trades
      },
      outputData: { advice },
      explanation: advice.substring(0, 200) + (advice.length > 200 ? '...' : ''),
      confidence: 75 // Default confidence for text-based advice
    });
    
    return advice;
  } catch (error) {
    console.error("Error generating trade advice:", error);
    throw new Error("Failed to generate AI trade advice");
  }
}
