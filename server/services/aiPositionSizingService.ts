import { db } from '../db';
import { positionSizing, trades, paperWallets, riskGuardSettings } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PositionSizeRecommendation {
  symbol: string;
  suggestedSize: number; // USD amount
  suggestedPercentage: number; // % of portfolio
  kellyPercentage?: number;
  winRate: number;
  riskRewardRatio: number;
  reasoning: string;
  maxRiskAmount: number;
}

function calculateKellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss === 0) return 0;
  
  const winProbability = winRate / 100;
  const lossProbability = 1 - winProbability;
  const winLossRatio = avgWin / Math.abs(avgLoss);
  
  // Kelly Formula: (Win% * WinLossRatio - Loss%) / WinLossRatio
  const kelly = (winProbability * winLossRatio - lossProbability) / winLossRatio;
  
  // Use fractional Kelly (50%) for safety
  return Math.max(0, Math.min(kelly * 0.5, 0.25)) * 100; // Return as percentage, max 25%
}

export async function calculateOptimalPositionSize(
  userId: string,
  symbol: string,
  entryPrice: number,
  stopLoss?: number
) {
  try {
    // Get user's wallet
    const wallet = await db.query.paperWallets.findFirst({
      where: eq(paperWallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Get risk guard settings
    const riskSettings = await db.query.riskGuardSettings.findFirst({
      where: eq(riskGuardSettings.userId, userId),
    });

    // Get trading history for this symbol
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const symbolTrades = await db.query.trades.findMany({
      where: and(
        eq(trades.userId, userId),
        eq(trades.symbol, symbol),
        gte(trades.timestamp, ninetyDaysAgo)
      ),
    });

    // Calculate win rate and average win/loss
    const wins = symbolTrades.filter(t => parseFloat(t.profit || '0') > 0);
    const losses = symbolTrades.filter(t => parseFloat(t.profit || '0') < 0);
    
    const winRate = symbolTrades.length > 0 ? (wins.length / symbolTrades.length) * 100 : 50;
    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + parseFloat(t.profit || '0'), 0) / wins.length
      : 0;
    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + parseFloat(t.profit || '0'), 0) / losses.length)
      : 0;

    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 2;

    // Calculate Kelly Criterion percentage
    const kellyPercentage = calculateKellyCriterion(winRate, avgWin, avgLoss);

    // Get portfolio value
    const portfolioValue = parseFloat(wallet.balance); // Simplified - should include positions

    // Calculate max risk per trade (from risk settings or default 2%)
    const maxRiskPercent = riskSettings && riskSettings.maxPositionSizePercent
      ? Math.min(parseFloat(riskSettings.maxPositionSizePercent), 5) // Cap at 5%
      : 2;

    // Calculate position size based on stop loss risk
    let suggestedPercentage = kellyPercentage || maxRiskPercent;
    let maxRiskAmount = portfolioValue * (maxRiskPercent / 100);

    if (stopLoss && stopLoss < entryPrice) {
      // Calculate position size based on stop loss distance
      const riskPerShare = entryPrice - stopLoss;
      const riskPercentOfEntry = (riskPerShare / entryPrice) * 100;
      
      // Adjust position size based on stop loss distance
      if (riskPercentOfEntry > 5) {
        // Wider stop = smaller position
        suggestedPercentage = Math.min(suggestedPercentage, maxRiskPercent * 0.5);
      }
    }

    // Ensure position size respects risk limits
    suggestedPercentage = Math.min(suggestedPercentage, maxRiskPercent);
    const suggestedSize = portfolioValue * (suggestedPercentage / 100);

    // Use AI to validate and enhance recommendation
    const positionSizePrompt = `As a risk management expert, validate this position sizing recommendation:

Symbol: ${symbol}
Portfolio Value: $${portfolioValue.toFixed(2)}
Suggested Position Size: ${suggestedPercentage.toFixed(1)}% ($${suggestedSize.toFixed(2)})

Trading Statistics:
- Win Rate: ${winRate.toFixed(1)}%
- Risk/Reward Ratio: ${riskRewardRatio.toFixed(2)}:1
- Kelly Criterion: ${kellyPercentage.toFixed(1)}%
- Max Risk Setting: ${maxRiskPercent}%

Entry Price: $${entryPrice}
Stop Loss: ${stopLoss ? '$' + stopLoss : 'Not set'}

Provide:
1. Final recommendation (approve, reduce, or increase with reasoning)
2. Specific risk management advice

Format as JSON:
{
  "approved": true/false,
  "adjustment_factor": 1.0,
  "reasoning": "...",
  "risk_advice": "..."
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: positionSizePrompt }],
      max_tokens: 350,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    // Apply AI adjustment
    const adjustmentFactor = aiResponse.adjustment_factor || 1.0;
    const finalSuggestedSize = suggestedSize * adjustmentFactor;
    const finalSuggestedPercentage = suggestedPercentage * adjustmentFactor;

    const recommendation: PositionSizeRecommendation = {
      symbol,
      suggestedSize: finalSuggestedSize,
      suggestedPercentage: finalSuggestedPercentage,
      kellyPercentage,
      winRate,
      riskRewardRatio,
      reasoning: aiResponse.reasoning || `Based on ${winRate.toFixed(1)}% win rate and Kelly Criterion, recommended size is ${finalSuggestedPercentage.toFixed(1)}% of portfolio`,
      maxRiskAmount,
    };

    // Save to database
    await db.insert(positionSizing).values({
      userId,
      symbol,
      suggestedSize: finalSuggestedSize.toString(),
      suggestedPercentage: finalSuggestedPercentage.toString(),
      kellyPercentage: kellyPercentage.toString(),
      winRate: winRate.toString(),
      riskRewardRatio: riskRewardRatio.toString(),
      reasoning: recommendation.reasoning,
      maxRiskAmount: maxRiskAmount.toString(),
    });

    return recommendation;
  } catch (error) {
    console.error('Error calculating optimal position size:', error);
    throw error;
  }
}

export async function getPositionSizingHistory(userId: string, symbol?: string) {
  try {
    const conditions = symbol
      ? and(eq(positionSizing.userId, userId), eq(positionSizing.symbol, symbol))
      : eq(positionSizing.userId, userId);

    const history = await db.query.positionSizing.findMany({
      where: conditions,
      orderBy: [desc(positionSizing.timestamp)],
      limit: 20,
    });

    return history;
  } catch (error) {
    console.error('Error fetching position sizing history:', error);
    throw error;
  }
}

export async function getQuickPositionSize(userId: string, symbol: string, riskAmount: number) {
  try {
    // Quick calculation without full analysis
    const wallet = await db.query.paperWallets.findFirst({
      where: eq(paperWallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const portfolioValue = parseFloat(wallet.balance);
    const riskPercentage = (riskAmount / portfolioValue) * 100;

    // Simple 2% rule
    const maxRiskPercent = 2;
    const recommendedRisk = Math.min(riskPercentage, maxRiskPercent);
    const recommendedSize = portfolioValue * (recommendedRisk / 100);

    return {
      symbol,
      suggestedSize: recommendedSize,
      suggestedPercentage: recommendedRisk,
      reasoning: `Quick sizing based on ${recommendedRisk.toFixed(1)}% risk rule`,
    };
  } catch (error) {
    console.error('Error calculating quick position size:', error);
    throw error;
  }
}

export async function validatePositionSize(
  userId: string,
  symbol: string,
  proposedSize: number,
  entryPrice: number,
  stopLoss?: number
) {
  try {
    const optimal = await calculateOptimalPositionSize(userId, symbol, entryPrice, stopLoss);
    
    const percentageDiff = Math.abs(proposedSize - optimal.suggestedSize) / optimal.suggestedSize * 100;

    return {
      isOptimal: percentageDiff < 20, // Within 20% of optimal
      proposedSize,
      optimalSize: optimal.suggestedSize,
      difference: proposedSize - optimal.suggestedSize,
      percentageDiff,
      recommendation: percentageDiff > 20
        ? proposedSize > optimal.suggestedSize
          ? 'Position size too large - consider reducing to optimal size'
          : 'Position size conservative - could increase to optimal size'
        : 'Position size is within optimal range',
    };
  } catch (error) {
    console.error('Error validating position size:', error);
    throw error;
  }
}
