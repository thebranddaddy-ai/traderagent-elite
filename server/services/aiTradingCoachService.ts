import { db } from '../db';
import { coachingInsights, trades, tradingPatterns } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TradingMistake {
  type: string;
  description: string;
  impact: string;
  tradeIds: string[];
}

interface ImprovementArea {
  skill: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  targetLevel: 'intermediate' | 'advanced' | 'expert';
  learningPath: string[];
}

export async function generateCoachingInsights(userId: string) {
  try {
    // Get recent trading history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrades = await db.query.trades.findMany({
      where: and(
        eq(trades.userId, userId),
        gte(trades.timestamp, thirtyDaysAgo)
      ),
      orderBy: [desc(trades.timestamp)],
    });

    if (recentTrades.length === 0) {
      return null; // No trades to analyze
    }

    // Get detected patterns
    const patterns = await db.query.tradingPatterns.findMany({
      where: eq(tradingPatterns.userId, userId),
      orderBy: [desc(tradingPatterns.detectedAt)],
      limit: 10,
    });

    // Analyze mistakes and areas for improvement
    const mistakes: TradingMistake[] = [];
    const improvements: ImprovementArea[] = [];

    // 1. Analyze loss patterns
    const losses = recentTrades.filter(t => parseFloat(t.profit || '0') < 0);
    const wins = recentTrades.filter(t => parseFloat(t.profit || '0') > 0);
    const winRate = (wins.length / recentTrades.length) * 100;

    // 2. Find consecutive losses
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    const lossStreakTrades: string[] = [];

    for (const trade of recentTrades) {
      if (parseFloat(trade.profit || '0') < 0) {
        consecutiveLosses++;
        lossStreakTrades.push(trade.id);
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      } else {
        consecutiveLosses = 0;
        lossStreakTrades.length = 0;
      }
    }

    if (maxConsecutiveLosses >= 3) {
      mistakes.push({
        type: 'poor_loss_management',
        description: `${maxConsecutiveLosses} consecutive losses detected - possible revenge trading`,
        impact: 'High - emotional trading leads to larger losses',
        tradeIds: lossStreakTrades,
      });
    }

    // 3. Analyze average loss size vs average win size
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, t) => sum + Math.abs(parseFloat(t.profit || '0')), 0) / losses.length
      : 0;
    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + parseFloat(t.profit || '0'), 0) / wins.length
      : 0;

    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    if (riskRewardRatio < 1.5) {
      mistakes.push({
        type: 'poor_risk_reward',
        description: `Risk/Reward ratio is ${riskRewardRatio.toFixed(2)}:1 - losses are too large relative to wins`,
        impact: 'High - need 67%+ win rate to be profitable with this ratio',
        tradeIds: [],
      });

      improvements.push({
        skill: 'Risk Management',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        learningPath: [
          'Always set stop-loss before entering trade',
          'Target at least 2:1 reward-to-risk ratio',
          'Never risk more than 2% of portfolio on single trade',
        ],
      });
    }

    // 4. Check for overtrading
    if (recentTrades.length > 50) {
      mistakes.push({
        type: 'overtrading',
        description: `${recentTrades.length} trades in 30 days - excessive trading frequency`,
        impact: 'Medium - quality suffers when trading too frequently',
        tradeIds: [],
      });

      improvements.push({
        skill: 'Trade Selection',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        learningPath: [
          'Focus on high-probability setups only',
          'Use a trading checklist before each trade',
          'Aim for 1-2 quality trades per week instead of daily trading',
        ],
      });
    }

    // 5. Analyze pattern-based mistakes from existing patterns
    const negativePatterns = patterns.filter(p => p.impact === 'negative');
    for (const pattern of negativePatterns) {
      mistakes.push({
        type: pattern.patternType,
        description: pattern.description,
        impact: 'Pattern detected - ' + pattern.recommendation,
        tradeIds: [],
      });
    }

    // 6. Determine skill level based on win rate and patterns
    let overallLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
    if (winRate >= 60 && riskRewardRatio >= 1.5) {
      overallLevel = 'advanced';
    } else if (winRate >= 50 && riskRewardRatio >= 1.2) {
      overallLevel = 'intermediate';
    }

    // Use AI to generate personalized coaching insights
    const coachingPrompt = `As a professional trading coach, analyze this trader's performance and provide personalized coaching:

Trading Statistics (Last 30 days):
- Total Trades: ${recentTrades.length}
- Win Rate: ${winRate.toFixed(1)}%
- Risk/Reward Ratio: ${riskRewardRatio.toFixed(2)}:1
- Max Consecutive Losses: ${maxConsecutiveLosses}
- Current Skill Level: ${overallLevel}

Identified Mistakes:
${mistakes.map(m => `- ${m.type}: ${m.description}`).join('\n')}

Detected Patterns:
${patterns.slice(0, 3).map(p => `- ${p.patternType}: ${p.description}`).join('\n')}

Provide 3 specific, actionable coaching insights with:
1. Category (mistake_analysis, improvement_tip, pattern_alert, or achievement)
2. Title
3. Message (2-3 sentences)
4. Priority (high/medium/low)
5. Action items (2-3 specific steps)

Format as JSON array:
[
  {
    "category": "...",
    "title": "...",
    "message": "...",
    "priority": "...",
    "actionItems": ["...", "..."]
  }
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: coachingPrompt }],
      max_tokens: 600,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
    const insights = aiResponse.insights || [];

    // Save coaching insights to database
    for (const insight of insights) {
      await db.insert(coachingInsights).values({
        userId,
        category: insight.category || 'improvement_tip',
        title: insight.title || 'Trading Tip',
        message: insight.message || '',
        priority: insight.priority || 'medium',
        actionItems: JSON.stringify(insight.actionItems || []),
        relatedTrades: null,
      });
    }

    // Also create insights for critical mistakes
    if (mistakes.length > 0) {
      for (const mistake of mistakes.slice(0, 2)) { // Top 2 mistakes
        await db.insert(coachingInsights).values({
          userId,
          category: 'mistake_analysis',
          title: mistake.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          message: mistake.description + ' - ' + mistake.impact,
          priority: 'high',
          actionItems: JSON.stringify(improvements.length > 0 ? improvements[0].learningPath : ['Review trading plan', 'Analyze mistakes']),
          relatedTrades: JSON.stringify(mistake.tradeIds),
        });
      }
    }

    return {
      insights,
      mistakes,
      improvements,
      overallLevel,
    };
  } catch (error) {
    console.error('Error generating coaching insights:', error);
    throw error;
  }
}

export async function getUnacknowledgedInsights(userId: string) {
  try {
    const insights = await db.query.coachingInsights.findMany({
      where: and(
        eq(coachingInsights.userId, userId),
        eq(coachingInsights.acknowledged, false)
      ),
      orderBy: [desc(coachingInsights.timestamp)],
      limit: 10,
    });

    return insights.map(insight => ({
      ...insight,
      actionItems: JSON.parse(insight.actionItems),
      relatedTrades: insight.relatedTrades ? JSON.parse(insight.relatedTrades) : null,
    }));
  } catch (error) {
    console.error('Error fetching coaching insights:', error);
    throw error;
  }
}

export async function acknowledgeInsight(insightId: string) {
  try {
    await db.update(coachingInsights)
      .set({ acknowledged: true })
      .where(eq(coachingInsights.id, insightId));
  } catch (error) {
    console.error('Error acknowledging insight:', error);
    throw error;
  }
}

export async function getWeeklyProgressReport(userId: string) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weekTrades = await db.query.trades.findMany({
      where: and(
        eq(trades.userId, userId),
        gte(trades.timestamp, sevenDaysAgo)
      ),
    });

    const weekInsights = await db.query.coachingInsights.findMany({
      where: and(
        eq(coachingInsights.userId, userId),
        gte(coachingInsights.timestamp, sevenDaysAgo)
      ),
    });

    const wins = weekTrades.filter(t => parseFloat(t.profit || '0') > 0).length;
    const losses = weekTrades.filter(t => parseFloat(t.profit || '0') < 0).length;
    const totalProfit = weekTrades.reduce((sum, t) => sum + parseFloat(t.profit || '0'), 0);

    return {
      weekTrades: weekTrades.length,
      winRate: weekTrades.length > 0 ? (wins / weekTrades.length) * 100 : 0,
      totalProfit,
      insightsGenerated: weekInsights.length,
      insightsAcknowledged: weekInsights.filter(i => i.acknowledged).length,
    };
  } catch (error) {
    console.error('Error generating weekly progress report:', error);
    throw error;
  }
}
