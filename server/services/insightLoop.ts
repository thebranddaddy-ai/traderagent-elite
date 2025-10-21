/**
 * Insight Loop Service - Freedom Engine Phase A
 * 
 * North Star Mission: Transform trading from stress to calm guidance
 * Purpose: Generate daily AI insights (Morning Brief, Midday Pulse, Evening Reflection)
 * 
 * Peace of Mind Features:
 * - Morning Brief: Set intention, market overview, prepare for the day
 * - Midday Pulse: Quick check-in, portfolio status, emotion check
 * - Evening Reflection: Review performance, extract lessons, calculate peace
 * 
 * Outputs:
 * - Summary: Plain English overview
 * - Emotion Score: 0-100 (fear to greed)
 * - Peace Index: 0-100 (stress to calm)
 * - Insights: Key observations (JSON array)
 * - Recommendations: Actionable next steps (JSON array)
 */

import OpenAI from "openai";
import type { IStorage } from "../storage";
import type { InsertAIDailyInsight, AIDailyInsight } from "../../shared/schema";
import { logAIDecision } from "./aiAuditService";
import { calculateTradingDNA } from "./tradingDNA";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Strip markdown code blocks from JSON response
 * OpenAI sometimes wraps JSON in ```json...``` blocks
 */
function stripMarkdownJson(response: string): string {
  const trimmed = response.trim();
  
  // Check if wrapped in markdown code blocks
  if (trimmed.startsWith('```json') || trimmed.startsWith('```')) {
    // Remove opening ```json or ``` and closing ```
    return trimmed
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }
  
  return trimmed;
}

/**
 * Determine insight type based on current hour (server time)
 * Morning: 6-11 AM
 * Midday: 11 AM - 4 PM  
 * Evening: 4 PM - 11 PM
 * Night: 11 PM - 6 AM (no insights - time to rest)
 */
function getInsightType(): 'morning' | 'midday' | 'evening' | 'rest' {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 23) return 'evening';
  return 'rest'; // No insights during night hours - rest is important
}

/**
 * Fetch current market prices for context
 */
async function getMarketContext(): Promise<{
  btc: number;
  eth: number;
  sol: number;
}> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd'
    );
    const data = await response.json();
    
    return {
      btc: data.bitcoin?.usd || 0,
      eth: data.ethereum?.usd || 0,
      sol: data.solana?.usd || 0,
    };
  } catch (error) {
    console.error('[Insight Loop] Failed to fetch market prices:', error);
    // Return fallback prices
    return { btc: 0, eth: 0, sol: 0 };
  }
}

/**
 * Calculate simple emotion score based on portfolio performance
 * 0 = extreme fear (large losses)
 * 50 = neutral
 * 100 = extreme greed (large gains)
 */
function calculateEmotionScore(totalPnL: number, portfolioValue: number): number {
  if (portfolioValue === 0) return 50; // Neutral if no portfolio
  
  const pnlPercent = (totalPnL / portfolioValue) * 100;
  
  // Map -20% to +20% range to 0-100 emotion score
  // Clamp at extremes
  const emotionScore = 50 + (pnlPercent * 2.5);
  return Math.max(0, Math.min(100, emotionScore));
}

/**
 * Calculate peace index based on multiple factors
 * 0 = high stress (many risks, losses, volatility)
 * 100 = total peace (no positions or very safe, profitable portfolio)
 */
function calculatePeaceIndex(params: {
  totalPnL: number;
  portfolioValue: number;
  openPositions: number;
  winRate: number;
  riskScore: number;
}): number {
  const { totalPnL, portfolioValue, openPositions, winRate, riskScore } = params;
  
  // Factor 1: P&L health (40% weight)
  const pnlPercent = portfolioValue > 0 ? (totalPnL / portfolioValue) * 100 : 0;
  const pnlScore = Math.max(0, Math.min(100, 50 + pnlPercent * 5));
  
  // Factor 2: Position count (20% weight) - fewer positions = more peace
  const positionScore = Math.max(0, 100 - (openPositions * 10));
  
  // Factor 3: Win rate (20% weight)
  const winRateScore = winRate;
  
  // Factor 4: Inverse risk score (20% weight) - lower risk = more peace
  const riskPeaceScore = Math.max(0, 100 - riskScore);
  
  // Weighted average
  const peaceIndex = (
    pnlScore * 0.4 +
    positionScore * 0.2 +
    winRateScore * 0.2 +
    riskPeaceScore * 0.2
  );
  
  return Math.max(0, Math.min(100, peaceIndex));
}

/**
 * Generate Morning Brief (6-11 AM)
 * Sets intention for the day
 */
async function generateMorningBrief(
  userId: string,
  storage: IStorage
): Promise<Omit<InsertAIDailyInsight, 'timestamp'>> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');
  
  const wallet = await storage.getPaperWalletByUserId(userId);
  const walletId = wallet?.id || '';
  const positions = walletId ? await storage.getPaperPositionsByWalletId(walletId) : [];
  const trades = await storage.getTradesByUserId(userId);
  const market = await getMarketContext();
  
  // Use Trading DNA service for accurate behavioral metrics
  const tradingDNA = await calculateTradingDNA(userId);
  
  // Calculate total P&L and portfolio value using current market prices
  let totalPnL = 0;
  let positionsValue = 0;
  for (const position of positions) {
    const currentPrice = market[position.symbol.toLowerCase() as keyof typeof market] || 0;
    const avgPrice = parseFloat(position.avgPrice);
    const quantity = parseFloat(position.quantity);
    const unrealizedPnL = (currentPrice - avgPrice) * quantity;
    totalPnL += unrealizedPnL;
    positionsValue += currentPrice * quantity; // Use current market price
  }
  
  const portfolioValue = parseFloat(wallet?.balance || '0') + positionsValue;
  
  const emotionScore = calculateEmotionScore(totalPnL, portfolioValue);
  const peaceIndex = calculatePeaceIndex({
    totalPnL,
    portfolioValue,
    openPositions: positions.length,
    winRate: tradingDNA.winRate || 50,
    riskScore: tradingDNA.riskScore || 50,
  });
  
  const prompt = `You are a calm, wise trading companion. Generate a Morning Brief for ${user.firstName || 'this trader'}.

Current Context:
- Market: BTC $${market.btc.toLocaleString()}, ETH $${market.eth.toLocaleString()}, SOL $${market.sol.toLocaleString()}
- Portfolio Value: $${portfolioValue.toFixed(2)}
- Open Positions: ${positions.length}
- P&L: $${totalPnL.toFixed(2)}
- Win Rate: ${(tradingDNA.winRate || 50).toFixed(1)}%
- Risk Score: ${(tradingDNA.riskScore || 50).toFixed(0)}/100
- User Archetype: ${user.archetype || 'guardian'}

Your Morning Brief should:
1. Set a calm, focused intention for the day
2. Provide brief market context (1-2 sentences)
3. Highlight one key opportunity or risk to watch
4. Remind the user of their strengths

Respond in JSON format:
{
  "summary": "2-3 sentence overview",
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": ["action1", "action2"]
}

Keep it brief, calm, and actionable. No hype. Focus on peace of mind.`;

  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const response = completion.choices[0].message.content || '{}';
    const cleanedResponse = stripMarkdownJson(response);
    const parsed = JSON.parse(cleanedResponse);
    
    const result = {
      userId,
      insightType: 'morning' as const,
      summary: parsed.summary || 'Morning brief generated',
      emotionScore: emotionScore.toString(),
      peaceIndex: peaceIndex.toString(),
      insights: JSON.stringify(parsed.insights || []),
      recommendations: JSON.stringify(parsed.recommendations || []),
      marketContext: JSON.stringify(market),
      portfolioSnapshot: JSON.stringify({ totalPnL, portfolioValue, positions: positions.length }),
    };
    
    // Log to audit trail
    await logAIDecision({
      userId,
      featureType: 'briefing',
      modelVersion: 'gpt-4o-mini',
      prompt,
      inputData: { market, portfolio: { totalPnL, portfolioValue }, positions: positions.length },
      outputData: JSON.parse(cleanedResponse),
      explanation: `Morning brief generated for ${user.firstName}. Peace index: ${peaceIndex.toFixed(0)}/100`,
      confidence: 85,
    });
    
    return result;
  } catch (error) {
    console.error('[Insight Loop] Morning brief generation failed:', error);
    throw new Error('Failed to generate morning brief');
  }
}

/**
 * Generate Midday Pulse (11 AM - 4 PM)
 * Quick emotional check-in
 */
async function generateMiddayPulse(
  userId: string,
  storage: IStorage
): Promise<Omit<InsertAIDailyInsight, 'timestamp'>> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');
  
  const wallet = await storage.getPaperWalletByUserId(userId);
  const walletId = wallet?.id || '';
  const positions = walletId ? await storage.getPaperPositionsByWalletId(walletId) : [];
  const trades = await storage.getTradesByUserId(userId);
  const market = await getMarketContext();
  
  // Use Trading DNA service for accurate behavioral metrics
  const tradingDNA = await calculateTradingDNA(userId);
  
  // Calculate total P&L and portfolio value using current market prices
  let totalPnL = 0;
  let positionsValue = 0;
  for (const position of positions) {
    const currentPrice = market[position.symbol.toLowerCase() as keyof typeof market] || 0;
    const avgPrice = parseFloat(position.avgPrice);
    const quantity = parseFloat(position.quantity);
    const unrealizedPnL = (currentPrice - avgPrice) * quantity;
    totalPnL += unrealizedPnL;
    positionsValue += currentPrice * quantity; // Use current market price
  }
  
  const portfolioValue = parseFloat(wallet?.balance || '0') + positionsValue;
  
  const emotionScore = calculateEmotionScore(totalPnL, portfolioValue);
  const peaceIndex = calculatePeaceIndex({
    totalPnL,
    portfolioValue,
    openPositions: positions.length,
    winRate: tradingDNA.winRate || 50,
    riskScore: tradingDNA.riskScore || 50,
  });
  
  const prompt = `You are a supportive trading companion. Generate a Midday Pulse check-in for ${user.firstName || 'this trader'}.

Current Status:
- Portfolio: $${portfolioValue.toFixed(2)} (${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} today)
- Emotion Score: ${emotionScore.toFixed(0)}/100 (${emotionScore < 40 ? 'fearful' : emotionScore > 60 ? 'greedy' : 'balanced'})
- Open Positions: ${positions.length}

Your Midday Pulse should:
1. Acknowledge their current emotional state (1 sentence)
2. Provide a brief reality check if needed
3. Suggest ONE simple action to maintain balance

Respond in JSON format:
{
  "summary": "1-2 sentence check-in",
  "insights": ["emotional observation", "portfolio status"],
  "recommendations": ["one simple action"]
}

Be supportive but honest. If they're doing well, celebrate. If stressed, remind them to breathe.`;

  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });
    
    const response = completion.choices[0].message.content || '{}';
    const cleanedResponse = stripMarkdownJson(response);
    const parsed = JSON.parse(cleanedResponse);
    
    const result = {
      userId,
      insightType: 'midday' as const,
      summary: parsed.summary || 'Midday check-in',
      emotionScore: emotionScore.toString(),
      peaceIndex: peaceIndex.toString(),
      insights: JSON.stringify(parsed.insights || []),
      recommendations: JSON.stringify(parsed.recommendations || []),
      marketContext: JSON.stringify(market),
      portfolioSnapshot: JSON.stringify({ totalPnL, portfolioValue, positions: positions.length }),
    };
    
    await logAIDecision({
      userId,
      featureType: 'briefing',
      modelVersion: 'gpt-4o-mini',
      prompt,
      inputData: { emotionScore, peaceIndex, totalPnL },
      outputData: JSON.parse(cleanedResponse),
      explanation: `Midday pulse check-in. Emotion: ${emotionScore.toFixed(0)}, Peace: ${peaceIndex.toFixed(0)}`,
      confidence: 80,
    });
    
    return result;
  } catch (error) {
    console.error('[Insight Loop] Midday pulse generation failed:', error);
    throw new Error('Failed to generate midday pulse');
  }
}

/**
 * Generate Evening Reflection (4 PM - 11 PM)
 * Review and learn from the day
 */
async function generateEveningReflection(
  userId: string,
  storage: IStorage
): Promise<Omit<InsertAIDailyInsight, 'timestamp'>> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');
  
  const wallet = await storage.getPaperWalletByUserId(userId);
  const walletId = wallet?.id || '';
  const positions = walletId ? await storage.getPaperPositionsByWalletId(walletId) : [];
  const trades = await storage.getTradesByUserId(userId);
  const market = await getMarketContext();
  
  // Use Trading DNA service for accurate behavioral metrics
  const tradingDNA = await calculateTradingDNA(userId);
  
  // Get today's trades only
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTrades = trades.filter((t) => new Date(t.timestamp) >= today);
  
  // Calculate total P&L and portfolio value using current market prices
  let totalPnL = 0;
  let positionsValue = 0;
  for (const position of positions) {
    const currentPrice = market[position.symbol.toLowerCase() as keyof typeof market] || 0;
    const avgPrice = parseFloat(position.avgPrice);
    const quantity = parseFloat(position.quantity);
    const unrealizedPnL = (currentPrice - avgPrice) * quantity;
    totalPnL += unrealizedPnL;
    positionsValue += currentPrice * quantity; // Use current market price
  }
  
  const portfolioValue = parseFloat(wallet?.balance || '0') + positionsValue;
  
  const emotionScore = calculateEmotionScore(totalPnL, portfolioValue);
  const peaceIndex = calculatePeaceIndex({
    totalPnL,
    portfolioValue,
    openPositions: positions.length,
    winRate: tradingDNA.winRate || 50,
    riskScore: tradingDNA.riskScore || 50,
  });
  
  const prompt = `You are a reflective trading mentor. Generate an Evening Reflection for ${user.firstName || 'this trader'}.

Today's Activity:
- Trades Executed: ${todayTrades.length}
- Portfolio P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
- Peace Index: ${peaceIndex.toFixed(0)}/100
- Overall Win Rate: ${(tradingDNA.winRate || 50).toFixed(1)}%

Your Evening Reflection should:
1. Acknowledge what happened today (good or bad)
2. Extract ONE key lesson learned
3. Celebrate a win OR reframe a loss as growth
4. Set a peaceful intention for tomorrow

Respond in JSON format:
{
  "summary": "2-3 sentence reflection",
  "insights": ["what went well", "what could improve", "key lesson"],
  "recommendations": ["one intention for tomorrow"]
}

Be warm and encouraging. Focus on growth, not perfection. Help them end the day with peace.`;

  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });
    
    const response = completion.choices[0].message.content || '{}';
    const cleanedResponse = stripMarkdownJson(response);
    const parsed = JSON.parse(cleanedResponse);
    
    const result = {
      userId,
      insightType: 'evening' as const,
      summary: parsed.summary || 'Evening reflection',
      emotionScore: emotionScore.toString(),
      peaceIndex: peaceIndex.toString(),
      insights: JSON.stringify(parsed.insights || []),
      recommendations: JSON.stringify(parsed.recommendations || []),
      marketContext: JSON.stringify(market),
      portfolioSnapshot: JSON.stringify({ totalPnL, portfolioValue, tradesCount: todayTrades.length }),
    };
    
    await logAIDecision({
      userId,
      featureType: 'briefing',
      modelVersion: 'gpt-4o-mini',
      prompt,
      inputData: { todayTrades: todayTrades.length, totalPnL, peaceIndex },
      outputData: JSON.parse(cleanedResponse),
      explanation: `Evening reflection generated. Peace index: ${peaceIndex.toFixed(0)}/100. Trades today: ${todayTrades.length}`,
      confidence: 85,
    });
    
    return result;
  } catch (error) {
    console.error('[Insight Loop] Evening reflection generation failed:', error);
    throw new Error('Failed to generate evening reflection');
  }
}

/**
 * Main entry point: Generate insight for current time of day
 */
export async function generateDailyInsight(
  userId: string,
  storage: IStorage
): Promise<InsertAIDailyInsight> {
  const insightType = getInsightType();
  
  if (insightType === 'rest') {
    throw new Error('No insights during rest hours (11 PM - 6 AM). Time to recharge!');
  }
  
  let insight: Omit<InsertAIDailyInsight, 'timestamp'>;
  
  switch (insightType) {
    case 'morning':
      insight = await generateMorningBrief(userId, storage);
      break;
    case 'midday':
      insight = await generateMiddayPulse(userId, storage);
      break;
    case 'evening':
      insight = await generateEveningReflection(userId, storage);
      break;
    default:
      throw new Error(`Unknown insight type: ${insightType}`);
  }
  
  // Store in database
  const stored = await storage.createAIDailyInsight(insight);
  
  console.log(`[Insight Loop] Generated ${insightType} insight for user ${userId}. Peace index: ${insight.peaceIndex}`);
  
  return stored;
}

/**
 * Get today's insights for a user (all three types if available)
 */
export async function getTodayInsights(
  userId: string,
  storage: IStorage
): Promise<{
  morning?: any;
  midday?: any;
  evening?: any;
  currentPeaceIndex: number;
}> {
  const insights = await storage.getAIDailyInsights(userId);
  
  // Filter to today only
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayInsights = insights.filter((i: AIDailyInsight) => {
    const insightDate = new Date(i.timestamp);
    insightDate.setHours(0, 0, 0, 0);
    return insightDate.getTime() === today.getTime();
  });
  
  const morning = todayInsights.find((i: AIDailyInsight) => i.insightType === 'morning');
  const midday = todayInsights.find((i: AIDailyInsight) => i.insightType === 'midday');
  const evening = todayInsights.find((i: AIDailyInsight) => i.insightType === 'evening');
  
  // Calculate current peace index from most recent insight
  const mostRecent = todayInsights[0];
  const currentPeaceIndex = mostRecent 
    ? parseFloat(mostRecent.peaceIndex) 
    : 50;
  
  return {
    morning: morning ? {
      ...morning,
      insights: JSON.parse(morning.insights),
      recommendations: JSON.parse(morning.recommendations),
      marketContext: JSON.parse(morning.marketContext || '{}'),
    } : undefined,
    midday: midday ? {
      ...midday,
      insights: JSON.parse(midday.insights),
      recommendations: JSON.parse(midday.recommendations),
      marketContext: JSON.parse(midday.marketContext || '{}'),
    } : undefined,
    evening: evening ? {
      ...evening,
      insights: JSON.parse(evening.insights),
      recommendations: JSON.parse(evening.recommendations),
      marketContext: JSON.parse(evening.marketContext || '{}'),
    } : undefined,
    currentPeaceIndex,
  };
}
