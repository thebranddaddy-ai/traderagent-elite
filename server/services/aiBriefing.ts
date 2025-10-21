import OpenAI from "openai";
import { storage } from "../storage";
import { getPaperWalletWithPositions, getMarketPrice } from "./paperTrading";
import type { AIBriefing } from "@shared/schema";

// Simple Trading DNA calculation for AI briefing
function calculateBasicTradingDNA(trades: any[]) {
  if (trades.length === 0) {
    return {
      winRate: 0,
      avgProfit: 0,
      totalTrades: 0,
      riskScore: 50,
      tradingStyle: "Balanced" as const
    };
  }

  const profitableTrades = trades.filter(t => t.profit && parseFloat(t.profit) > 0);
  const winRate = (profitableTrades.length / trades.length) * 100;
  const totalProfit = trades.reduce((sum, t) => sum + (t.profit ? parseFloat(t.profit) : 0), 0);
  const avgProfit = totalProfit / trades.length;
  
  const tradeSizes = trades.map(t => parseFloat(t.total));
  const avgSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
  const variance = tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / tradeSizes.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgSize > 0 ? (stdDev / avgSize) * 100 : 0;
  const riskScore = Math.min(trades.length * 2 + coefficientOfVariation, 100);
  
  const tradingStyle = riskScore > 70 ? "Aggressive" : riskScore < 30 ? "Conservative" : "Balanced";
  
  return {
    winRate,
    avgProfit,
    totalTrades: trades.length,
    riskScore: Math.round(riskScore),
    tradingStyle: tradingStyle as "Aggressive" | "Conservative" | "Balanced"
  };
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

interface Insight {
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  title: string;
  description: string;
}

interface Recommendation {
  action: string;
  symbol: string;
  reasoning: string;
  confidence: number;
}

interface BriefingResponse {
  summary: string;
  insights: Insight[];
  recommendations: Recommendation[];
}

export async function generateDailyBriefing(userId: string): Promise<AIBriefing> {
  // Get user's trading DNA and recent trades
  const trades = await storage.getTradesByUserId(userId);
  const tradingDNA = calculateBasicTradingDNA(trades);
  
  // Get user's paper wallet positions
  const { wallet, positions } = await getPaperWalletWithPositions(userId);
  
  // Calculate current position values
  const positionsWithValue = positions.map(pos => ({
    symbol: pos.symbol,
    quantity: parseFloat(pos.quantity),
    avgPrice: parseFloat(pos.avgPrice),
    currentPrice: getMarketPrice(pos.symbol),
    value: parseFloat(pos.quantity) * getMarketPrice(pos.symbol),
    profitLoss: (getMarketPrice(pos.symbol) - parseFloat(pos.avgPrice)) * parseFloat(pos.quantity)
  }));
  
  // Get real-time market prices and calculate market conditions
  const btcPrice = getMarketPrice('BTC');
  const ethPrice = getMarketPrice('ETH');
  const solPrice = getMarketPrice('SOL');
  
  // Calculate portfolio concentration
  const totalPortfolioValue = positionsWithValue.reduce((sum, p) => sum + p.value, 0) + parseFloat(wallet.balance);
  const portfolioConcentration = positionsWithValue.map(p => ({
    symbol: p.symbol,
    percentage: (p.value / totalPortfolioValue * 100).toFixed(2)
  }));
  
  // Calculate total P/L
  const totalPL = positionsWithValue.reduce((sum, p) => sum + p.profitLoss, 0);
  const totalPLPercentage = totalPortfolioValue > 0 ? (totalPL / totalPortfolioValue * 100) : 0;
  
  // Create comprehensive prompt for OpenAI with enhanced analysis
  const prompt = `You are an expert trading analyst with deep knowledge of technical analysis, risk management, and portfolio optimization. Analyze the trader's profile and provide a comprehensive daily briefing with advanced insights.

TRADER PROFILE:
- Trading Style: ${tradingDNA.tradingStyle}
- Win Rate: ${tradingDNA.winRate.toFixed(2)}%
- Average Profit per Trade: $${tradingDNA.avgProfit.toFixed(2)}
- Total Trades: ${tradingDNA.totalTrades}
- Risk Score: ${tradingDNA.riskScore}/100

CURRENT POSITIONS & PORTFOLIO ANALYSIS:
${positionsWithValue.length > 0 ? positionsWithValue.map(p => 
  `- ${p.symbol}: ${p.quantity} units @ $${p.avgPrice} avg (Current: $${p.currentPrice}, P/L: $${p.profitLoss.toFixed(2)})`
).join('\n') : 'No open positions'}

PORTFOLIO METRICS:
- Cash Balance: $${wallet.balance}
- Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}
- Total P/L: $${totalPL.toFixed(2)} (${totalPLPercentage.toFixed(2)}%)
- Portfolio Concentration: ${portfolioConcentration.length > 0 ? portfolioConcentration.map(c => `${c.symbol} ${c.percentage}%`).join(', ') : 'All cash'}

REAL-TIME MARKET PRICES:
- BTC: $${btcPrice.toFixed(2)}
- ETH: $${ethPrice.toFixed(2)}
- SOL: $${solPrice.toFixed(2)}

ANALYSIS REQUIREMENTS:
Please provide a comprehensive briefing including:

1. SUMMARY: Brief overview of trader's performance, current portfolio status, and market outlook

2. INSIGHTS (5-7 detailed insights covering):
   - Market sentiment analysis (bullish/bearish trends)
   - Technical indicators (trend strength, support/resistance levels)
   - Risk warnings (portfolio concentration, overexposure, volatility alerts)
   - Portfolio health (diversification, cash position, P/L analysis)
   - Sector trends (crypto market dynamics, correlations)
   - Opportunity identification (undervalued assets, entry points)

3. RECOMMENDATIONS (3-5 actionable items):
   - Specific trading actions (buy/sell/hold with entry/exit points)
   - Risk management adjustments (position sizing, stop-loss suggestions)
   - Portfolio rebalancing (diversification improvements)
   - Each with clear reasoning and confidence level (0-100)

Consider the trader's ${tradingDNA.tradingStyle} style and risk score (${tradingDNA.riskScore}/100) when providing recommendations. Be specific, data-driven, and actionable.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Comprehensive overview of trader's current situation, performance, and market outlook",
  "insights": [
    {
      "type": "bullish|bearish|neutral|warning",
      "title": "Specific, actionable insight title",
      "description": "Detailed analysis with data points, technical indicators, or risk metrics"
    }
  ],
  "recommendations": [
    {
      "action": "buy|sell|hold|rebalance|reduce",
      "symbol": "BTC|ETH|SOL|PORTFOLIO",
      "reasoning": "Specific reasoning with technical/fundamental justification",
      "confidence": 0-100
    }
  ]
}`;

  // Call OpenAI API with enhanced system prompt
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an elite cryptocurrency trading analyst with expertise in:
- Technical analysis (RSI, MACD, Bollinger Bands, Moving Averages, Volume Analysis)
- Risk management and portfolio optimization
- Market sentiment and macro trends
- Behavioral finance and trading psychology

Provide data-driven, actionable insights with specific price levels, percentages, and risk metrics. Consider both technical and fundamental factors. Be direct, professional, and focused on helping traders make informed decisions. Always respond with valid JSON only.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 2000
  });

  // Parse the response
  const briefingData: BriefingResponse = JSON.parse(response.choices[0].message.content || "{}");
  
  // Save briefing to database
  const briefing = await storage.createAIBriefing({
    userId,
    summary: briefingData.summary,
    insights: JSON.stringify(briefingData.insights),
    recommendations: JSON.stringify(briefingData.recommendations)
  });

  return briefing;
}
