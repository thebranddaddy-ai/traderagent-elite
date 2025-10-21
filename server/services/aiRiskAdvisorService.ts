import { db } from '../db';
import { riskAssessments, paperPositions, paperWallets, trades } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PortfolioAnalysis {
  positions: Array<{
    symbol: string;
    value: number;
    percentage: number;
    quantity: number;
    avgPrice: number;
  }>;
  totalValue: number;
  cashBalance: number;
}

interface RiskWarning {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface RiskRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  description: string;
}

export async function generateRiskAssessment(userId: string, currentPrices: Record<string, number>) {
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

    // Calculate portfolio analysis
    const portfolioAnalysis: PortfolioAnalysis = {
      positions: [],
      totalValue: 0,
      cashBalance: parseFloat(wallet.balance),
    };

    for (const position of positions) {
      const currentPrice = currentPrices[position.symbol] || parseFloat(position.avgPrice);
      const positionValue = parseFloat(position.quantity) * currentPrice;
      
      portfolioAnalysis.positions.push({
        symbol: position.symbol,
        value: positionValue,
        percentage: 0, // Will calculate after total
        quantity: parseFloat(position.quantity),
        avgPrice: parseFloat(position.avgPrice),
      });

      portfolioAnalysis.totalValue += positionValue;
    }

    // Add cash to total portfolio value
    const totalPortfolioValue = portfolioAnalysis.totalValue + portfolioAnalysis.cashBalance;

    // Calculate percentages
    portfolioAnalysis.positions.forEach(pos => {
      pos.percentage = (pos.value / totalPortfolioValue) * 100;
    });

    // Analyze risk factors
    const warnings: RiskWarning[] = [];
    const recommendations: RiskRecommendation[] = [];

    // 1. Concentration risk
    const maxConcentration = Math.max(...portfolioAnalysis.positions.map(p => p.percentage));
    if (maxConcentration > 40) {
      warnings.push({
        type: 'concentration_risk',
        severity: maxConcentration > 60 ? 'critical' : 'high',
        message: `${maxConcentration.toFixed(1)}% of portfolio in single asset - excessive concentration!`,
      });
      recommendations.push({
        action: 'diversify',
        priority: 'high',
        description: 'Reduce position size in dominant asset to below 40% of portfolio',
      });
    }

    // 2. Portfolio diversification
    if (portfolioAnalysis.positions.length === 1 && portfolioAnalysis.positions.length > 0) {
      warnings.push({
        type: 'lack_of_diversification',
        severity: 'high',
        message: 'Portfolio contains only one asset - no diversification',
      });
      recommendations.push({
        action: 'add_positions',
        priority: 'high',
        description: 'Add 2-3 uncorrelated assets to improve diversification',
      });
    }

    // 3. Cash allocation
    const cashPercentage = (portfolioAnalysis.cashBalance / totalPortfolioValue) * 100;
    if (cashPercentage < 5) {
      warnings.push({
        type: 'low_cash_reserve',
        severity: 'medium',
        message: `Only ${cashPercentage.toFixed(1)}% cash - limited flexibility for opportunities`,
      });
      recommendations.push({
        action: 'increase_cash',
        priority: 'medium',
        description: 'Consider taking profits to maintain 5-10% cash reserve',
      });
    }

    // 4. Overexposure (all positions above 80% of portfolio)
    const totalInvestedPercentage = (portfolioAnalysis.totalValue / totalPortfolioValue) * 100;
    if (totalInvestedPercentage > 90) {
      warnings.push({
        type: 'overexposure',
        severity: 'high',
        message: `${totalInvestedPercentage.toFixed(1)}% of portfolio invested - very high exposure`,
      });
      recommendations.push({
        action: 'reduce_exposure',
        priority: 'high',
        description: 'Consider reducing positions to maintain adequate cash buffer',
      });
    }

    // Get recent trading history for pattern analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrades = await db.query.trades.findMany({
      where: and(
        eq(trades.userId, userId),
        gte(trades.timestamp, thirtyDaysAgo)
      ),
      orderBy: [desc(trades.timestamp)],
      limit: 50,
    });

    // 5. Trading frequency risk
    if (recentTrades.length > 30) {
      warnings.push({
        type: 'overtrading',
        severity: 'medium',
        message: `${recentTrades.length} trades in 30 days - potential overtrading`,
      });
      recommendations.push({
        action: 'reduce_frequency',
        priority: 'medium',
        description: 'Focus on quality over quantity - fewer, well-researched trades',
      });
    }

    // Calculate risk score (0-100, higher is riskier)
    let riskScore = 0;
    
    // Concentration adds up to 40 points
    riskScore += Math.min((maxConcentration / 100) * 40, 40);
    
    // Lack of diversification adds 20 points
    if (portfolioAnalysis.positions.length <= 2) {
      riskScore += 20;
    } else if (portfolioAnalysis.positions.length <= 3) {
      riskScore += 10;
    }
    
    // Low cash adds 15 points
    if (cashPercentage < 5) {
      riskScore += 15;
    } else if (cashPercentage < 10) {
      riskScore += 8;
    }
    
    // High exposure adds 15 points
    if (totalInvestedPercentage > 90) {
      riskScore += 15;
    } else if (totalInvestedPercentage > 80) {
      riskScore += 8;
    }
    
    // Overtrading adds 10 points
    if (recentTrades.length > 30) {
      riskScore += 10;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 75) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 25) riskLevel = 'medium';
    else riskLevel = 'low';

    // Use AI to generate additional insights
    const aiPrompt = `As a risk management expert, analyze this trading portfolio:

Portfolio Overview:
- Total Value: $${totalPortfolioValue.toFixed(2)}
- Cash: ${cashPercentage.toFixed(1)}%
- Number of Positions: ${portfolioAnalysis.positions.length}
- Max Concentration: ${maxConcentration.toFixed(1)}%
- Recent Trades (30 days): ${recentTrades.length}

Current Warnings:
${warnings.map(w => `- ${w.message}`).join('\n')}

Provide 2-3 specific, actionable risk management recommendations based on this data. Be concise and practical.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: aiPrompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiRecommendations = completion.choices[0].message.content || '';

    // Parse AI recommendations into structured format
    const aiRecLines = aiRecommendations.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./));
    aiRecLines.forEach((line, idx) => {
      recommendations.push({
        action: `ai_recommendation_${idx + 1}`,
        priority: idx === 0 ? 'high' : 'medium',
        description: line.replace(/^[-\d.]\s*/, '').trim(),
      });
    });

    // Portfolio metrics for detailed analysis
    const portfolioMetrics = {
      diversification_score: Math.max(0, 100 - maxConcentration),
      cash_ratio: cashPercentage,
      exposure_ratio: totalInvestedPercentage,
      position_count: portfolioAnalysis.positions.length,
      trading_velocity: recentTrades.length / 30, // Trades per day
    };

    // Validate and sanitize numeric values before database insertion
    const sanitizedRiskScore = (!isFinite(riskScore) || isNaN(riskScore)) ? 0 : Math.max(0, Math.min(100, riskScore));
    
    // Save assessment to database
    await db.insert(riskAssessments).values({
      userId,
      riskLevel,
      riskScore: sanitizedRiskScore.toFixed(2),
      warnings: JSON.stringify(warnings),
      recommendations: JSON.stringify(recommendations),
      portfolioMetrics: JSON.stringify(portfolioMetrics),
    });

    return {
      riskLevel,
      riskScore: sanitizedRiskScore,
      warnings,
      recommendations,
      portfolioMetrics,
    };
  } catch (error) {
    console.error('Error generating risk assessment:', error);
    throw error;
  }
}

export async function getLatestRiskAssessment(userId: string) {
  try {
    const assessment = await db.query.riskAssessments.findFirst({
      where: eq(riskAssessments.userId, userId),
      orderBy: [desc(riskAssessments.timestamp)],
    });

    if (!assessment) {
      return null;
    }

    return {
      ...assessment,
      warnings: JSON.parse(assessment.warnings),
      recommendations: JSON.parse(assessment.recommendations),
      portfolioMetrics: JSON.parse(assessment.portfolioMetrics),
    };
  } catch (error) {
    console.error('Error fetching risk assessment:', error);
    throw error;
  }
}
