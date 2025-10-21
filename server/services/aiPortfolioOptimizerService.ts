import { db } from '../db';
import { portfolioOptimizations, paperPositions, paperWallets, trades } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AssetAllocation {
  symbol: string;
  currentPercentage: number;
  currentValue: number;
  suggestedPercentage: number;
  suggestedValue: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
}

interface RebalanceAction {
  symbol: string;
  action: 'buy' | 'sell';
  amount: number;
  reason: string;
}

export async function generatePortfolioOptimization(userId: string, currentPrices: Record<string, number>) {
  try {
    // Get user's wallet and positions
    const wallet = await db.query.paperWallets.findFirst({
      where: eq(paperWallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const positions = await db.query.paperPositions.findMany({
      where: eq(paperPositions.walletId, wallet.id),
    });

    if (positions.length === 0) {
      return null; // No portfolio to optimize
    }

    // Calculate current allocation
    const currentAllocation: AssetAllocation[] = [];
    let totalPortfolioValue = parseFloat(wallet.balance);

    for (const position of positions) {
      const currentPrice = currentPrices[position.symbol] || parseFloat(position.avgPrice);
      const positionValue = parseFloat(position.quantity) * currentPrice;
      totalPortfolioValue += positionValue;
    }

    // Calculate percentages and create allocation objects
    for (const position of positions) {
      const currentPrice = currentPrices[position.symbol] || parseFloat(position.avgPrice);
      const positionValue = parseFloat(position.quantity) * currentPrice;
      const percentage = (positionValue / totalPortfolioValue) * 100;

      currentAllocation.push({
        symbol: position.symbol,
        currentPercentage: percentage,
        currentValue: positionValue,
        suggestedPercentage: 0, // Will be calculated
        suggestedValue: 0,
        action: 'hold',
        amount: 0,
      });
    }

    // Get trading history for performance analysis
    const userTrades = await db.query.trades.findMany({
      where: eq(trades.userId, userId),
      orderBy: [desc(trades.timestamp)],
      limit: 100,
    });

    // Calculate win rates per asset
    const assetPerformance: Record<string, { wins: number; losses: number; totalProfit: number }> = {};
    
    for (const trade of userTrades) {
      if (!assetPerformance[trade.symbol]) {
        assetPerformance[trade.symbol] = { wins: 0, losses: 0, totalProfit: 0 };
      }
      
      const profit = parseFloat(trade.profit || '0');
      if (profit > 0) {
        assetPerformance[trade.symbol].wins++;
      } else if (profit < 0) {
        assetPerformance[trade.symbol].losses++;
      }
      assetPerformance[trade.symbol].totalProfit += profit;
    }

    // Use AI to suggest optimal allocation
    const allocationPrompt = `As a portfolio optimization expert, analyze this crypto portfolio and suggest optimal rebalancing:

Current Portfolio Value: $${totalPortfolioValue.toFixed(2)}

Current Allocation:
${currentAllocation.map(a => `- ${a.symbol}: ${a.currentPercentage.toFixed(1)}% ($${a.currentValue.toFixed(2)})`).join('\n')}

Asset Performance History:
${Object.entries(assetPerformance).map(([symbol, perf]) => {
  const winRate = perf.wins / (perf.wins + perf.losses) * 100 || 0;
  return `- ${symbol}: Win Rate ${winRate.toFixed(1)}%, Total P/L: $${perf.totalProfit.toFixed(2)}`;
}).join('\n')}

Provide:
1. Suggested allocation percentages for each asset (should total 100% including cash)
2. Reasoning for changes
3. Expected improvement potential

Format as JSON:
{
  "suggested_allocation": {"BTC": 30, "ETH": 25, "SOL": 20, "CASH": 25},
  "reasoning": "...",
  "expected_improvement": 15
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: allocationPrompt }],
      max_tokens: 500,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
    const suggestedAllocation = aiResponse.suggested_allocation || {};

    // Calculate rebalance actions
    const rebalanceActions: RebalanceAction[] = [];
    const suggestedAllocations: AssetAllocation[] = [];

    for (const asset of currentAllocation) {
      const suggestedPct = suggestedAllocation[asset.symbol] || asset.currentPercentage;
      const suggestedValue = (suggestedPct / 100) * totalPortfolioValue;
      const difference = suggestedValue - asset.currentValue;

      suggestedAllocations.push({
        ...asset,
        suggestedPercentage: suggestedPct,
        suggestedValue,
        action: difference > 100 ? 'buy' : difference < -100 ? 'sell' : 'hold',
        amount: Math.abs(difference),
      });

      if (Math.abs(difference) > 100) {
        rebalanceActions.push({
          symbol: asset.symbol,
          action: difference > 0 ? 'buy' : 'sell',
          amount: Math.abs(difference),
          reason: difference > 0 
            ? `Increase exposure from ${asset.currentPercentage.toFixed(1)}% to ${suggestedPct.toFixed(1)}%`
            : `Reduce exposure from ${asset.currentPercentage.toFixed(1)}% to ${suggestedPct.toFixed(1)}%`,
        });
      }
    }

    // Handle cash allocation suggestion
    const suggestedCashPct = suggestedAllocation['CASH'] || 0;
    if (suggestedCashPct > 0) {
      const currentCashPct = (parseFloat(wallet.balance) / totalPortfolioValue) * 100;
      if (Math.abs(suggestedCashPct - currentCashPct) > 5) {
        rebalanceActions.push({
          symbol: 'CASH',
          action: suggestedCashPct > currentCashPct ? 'sell' : 'buy',
          amount: Math.abs(suggestedCashPct - currentCashPct) * totalPortfolioValue / 100,
          reason: `Adjust cash reserve to ${suggestedCashPct.toFixed(1)}%`,
        });
      }
    }

    // Save optimization to database
    await db.insert(portfolioOptimizations).values({
      userId,
      currentAllocation: JSON.stringify(currentAllocation),
      suggestedAllocation: JSON.stringify(suggestedAllocations),
      reasoning: aiResponse.reasoning || 'AI-generated optimization based on performance and diversification',
      expectedImprovement: aiResponse.expected_improvement?.toString() || null,
      rebalanceActions: JSON.stringify(rebalanceActions),
    });

    return {
      currentAllocation,
      suggestedAllocation: suggestedAllocations,
      rebalanceActions,
      reasoning: aiResponse.reasoning,
      expectedImprovement: aiResponse.expected_improvement,
    };
  } catch (error) {
    console.error('Error generating portfolio optimization:', error);
    throw error;
  }
}

export async function getLatestOptimization(userId: string) {
  try {
    const optimization = await db.query.portfolioOptimizations.findFirst({
      where: eq(portfolioOptimizations.userId, userId),
      orderBy: [desc(portfolioOptimizations.timestamp)],
    });

    if (!optimization) {
      return null;
    }

    return {
      ...optimization,
      currentAllocation: JSON.parse(optimization.currentAllocation),
      suggestedAllocation: JSON.parse(optimization.suggestedAllocation),
      rebalanceActions: JSON.parse(optimization.rebalanceActions),
    };
  } catch (error) {
    console.error('Error fetching portfolio optimization:', error);
    throw error;
  }
}
