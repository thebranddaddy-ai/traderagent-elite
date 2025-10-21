import { db } from "../db";
import { peaceIndex, focusSessions, stressIndicators, paperOrders, paperWallets } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export class PeaceIndexService {
  // Calculate daily peace score for a user
  async calculatePeaceScore(userId: string): Promise<{
    score: number;
    stressLevel: number;
    tradeFrequency: number;
    lossStreak: number;
    winStreak: number;
    dailyPnL: string;
    insights?: { message: string; recommendation: string };
    recommendsFocus: boolean;
    recommendsBreak: boolean;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First, get the user's paper wallet
    const [wallet] = await db
      .select()
      .from(paperWallets)
      .where(eq(paperWallets.userId, userId))
      .limit(1);

    if (!wallet) {
      // No wallet means no trades, return default peaceful state
      return {
        score: 100,
        stressLevel: 0,
        tradeFrequency: 0,
        lossStreak: 0,
        winStreak: 0,
        dailyPnL: "0.00",
        recommendsFocus: false,
        recommendsBreak: false,
      };
    }

    // Get today's trades using the wallet ID
    const todayTrades = await db
      .select()
      .from(paperOrders)
      .where(
        and(
          eq(paperOrders.walletId, wallet.id),
          gte(paperOrders.timestamp, today),
          eq(paperOrders.status, "completed")
        )
      );

    // Calculate metrics
    const tradeFrequency = todayTrades.length;
    
    // Calculate P&L
    let dailyPnL = 0;
    let winStreak = 0;
    let lossStreak = 0;
    let currentStreak = 0;
    let streakType: 'win' | 'loss' | null = null;

    for (const trade of todayTrades.reverse()) {
      const profit = parseFloat(trade.profit || "0");
      dailyPnL += profit;

      if (profit > 0) {
        if (streakType === 'win') {
          currentStreak++;
        } else {
          streakType = 'win';
          currentStreak = 1;
        }
        winStreak = Math.max(winStreak, currentStreak);
      } else if (profit < 0) {
        if (streakType === 'loss') {
          currentStreak++;
        } else {
          streakType = 'loss';
          currentStreak = 1;
        }
        lossStreak = Math.max(lossStreak, currentStreak);
      }
    }

    // Calculate stress level (0-100)
    let stressLevel = 0;
    
    // High trade frequency adds stress
    if (tradeFrequency > 15) stressLevel += 30;
    else if (tradeFrequency > 10) stressLevel += 20;
    else if (tradeFrequency > 5) stressLevel += 10;

    // Loss streak adds stress
    if (lossStreak >= 5) stressLevel += 40;
    else if (lossStreak >= 3) stressLevel += 25;
    else if (lossStreak >= 2) stressLevel += 15;

    // Negative P&L adds stress
    if (dailyPnL < -500) stressLevel += 30;
    else if (dailyPnL < -200) stressLevel += 20;
    else if (dailyPnL < 0) stressLevel += 10;

    stressLevel = Math.min(100, stressLevel);

    // Calculate peace score (inverse of stress, with positive factors)
    let peaceScore = 100 - stressLevel;

    // Win streak increases peace
    if (winStreak >= 3) peaceScore = Math.min(100, peaceScore + 15);
    
    // Positive P&L increases peace
    if (dailyPnL > 0) peaceScore = Math.min(100, peaceScore + 10);

    // Low trade frequency (controlled trading) increases peace
    if (tradeFrequency > 0 && tradeFrequency <= 5) peaceScore = Math.min(100, peaceScore + 10);

    peaceScore = Math.max(0, Math.min(100, Math.round(peaceScore)));

    // Generate insights
    const insights = this.generateInsights(peaceScore, stressLevel, lossStreak, tradeFrequency, dailyPnL);

    // Recommendations
    const recommendsFocus = stressLevel > 60 || lossStreak >= 3;
    const recommendsBreak = stressLevel > 70 || tradeFrequency > 15 || lossStreak >= 5;

    return {
      score: peaceScore,
      stressLevel,
      tradeFrequency,
      lossStreak,
      winStreak,
      dailyPnL: dailyPnL.toFixed(2),
      insights,
      recommendsFocus,
      recommendsBreak,
    };
  }

  private generateInsights(
    score: number,
    stress: number,
    lossStreak: number,
    frequency: number,
    pnl: number
  ): { message: string; recommendation: string } | undefined {
    if (score >= 80) {
      return {
        message: "You're trading with clarity and control.",
        recommendation: "Keep this rhythm. Your disciplined approach is working.",
      };
    }

    if (stress > 70) {
      return {
        message: "Stress levels are elevated. Your mind needs rest.",
        recommendation: "Consider taking a break or entering Focus Mode to reduce distractions.",
      };
    }

    if (lossStreak >= 3) {
      return {
        message: "You're in a loss streak. This is the time for patience, not action.",
        recommendation: "Step away for 20 minutes. Review what's not working before the next trade.",
      };
    }

    if (frequency > 15) {
      return {
        message: "High trading frequency detected. Are you reacting or planning?",
        recommendation: "Slow down. Quality trades outperform quantity every time.",
      };
    }

    if (score < 40) {
      return {
        message: "Your trading balance feels unstable.",
        recommendation: "Focus Mode can help you trade with intention. Consider activating it.",
      };
    }

    return undefined;
  }

  // Save peace index to database
  async savePeaceIndex(userId: string) {
    const metrics = await this.calculatePeaceScore(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [existing] = await db
      .select()
      .from(peaceIndex)
      .where(and(eq(peaceIndex.userId, userId), eq(peaceIndex.date, today)))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(peaceIndex)
        .set({
          score: metrics.score,
          stressLevel: metrics.stressLevel,
          tradeFrequency: metrics.tradeFrequency,
          lossStreak: metrics.lossStreak,
          winStreak: metrics.winStreak,
          dailyPnL: metrics.dailyPnL,
          insights: metrics.insights || null,
          recommendsFocus: metrics.recommendsFocus,
          recommendsBreak: metrics.recommendsBreak,
        })
        .where(eq(peaceIndex.id, existing.id));
    } else {
      // Insert new
      await db.insert(peaceIndex).values({
        userId,
        score: metrics.score,
        stressLevel: metrics.stressLevel,
        tradeFrequency: metrics.tradeFrequency,
        lossStreak: metrics.lossStreak,
        winStreak: metrics.winStreak,
        dailyPnL: metrics.dailyPnL,
        insights: metrics.insights || null,
        recommendsFocus: metrics.recommendsFocus,
        recommendsBreak: metrics.recommendsBreak,
        date: today,
      });
    }

    return metrics;
  }

  // Log focus session
  async logFocusSession(userId: string, duration: number, completed: boolean, tradesExecuted: number = 0) {
    const startTime = new Date(Date.now() - duration * 1000);
    
    await db.insert(focusSessions).values({
      userId,
      startTime,
      endTime: new Date(),
      duration,
      completed,
      tradesExecuted,
    });
  }

  // Log stress indicator
  async logStressIndicator(
    userId: string,
    type: string,
    severity: 'low' | 'medium' | 'high',
    description: string,
    triggerData?: any,
    aiSuggestion?: string
  ) {
    await db.insert(stressIndicators).values({
      userId,
      type,
      severity,
      description,
      triggerData: triggerData || null,
      aiSuggestion: aiSuggestion || null,
    });
  }

  // Get peace history
  async getPeaceHistory(userId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await db
      .select()
      .from(peaceIndex)
      .where(and(eq(peaceIndex.userId, userId), gte(peaceIndex.date, since)))
      .orderBy(desc(peaceIndex.date));
  }
}

export const peaceIndexService = new PeaceIndexService();
