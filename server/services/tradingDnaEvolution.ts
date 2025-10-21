/**
 * Trading DNA Evolution Tracker - Phase B
 * 
 * Purpose: Track how user's trading style evolves over time
 * Shows progress and improvement visually
 * 
 * Features:
 * - Create periodic DNA snapshots
 * - Compare current vs historical performance
 * - Identify improvement trends
 * - Highlight milestones and achievements
 */

import { db } from "../db";
import { tradingDnaSnapshots } from "@shared/schema";
import type { InsertTradingDnaSnapshot, TradingDnaSnapshot } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { calculateTradingDNA } from "./tradingDNA";
import type { TradingDNAMetrics } from "./tradingDNA";

export class TradingDnaEvolutionTracker {
  
  /**
   * Create a snapshot of current Trading DNA
   */
  async createSnapshot(params: {
    userId: string;
    snapshotType: 'daily' | 'weekly' | 'monthly' | 'milestone';
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<TradingDnaSnapshot> {
    const { userId, snapshotType, periodStart, periodEnd } = params;

    // Calculate current Trading DNA
    const dnaMetrics = await calculateTradingDNA(userId);

    // Get previous snapshot for comparison
    const previousSnapshot = await this.getLatestSnapshot(userId);
    
    // Calculate improvement vs previous
    const improvement = previousSnapshot 
      ? this.calculateImprovement(dnaMetrics, previousSnapshot)
      : 0;

    // Identify key changes
    const keyChanges = previousSnapshot
      ? this.identifyKeyChanges(dnaMetrics, previousSnapshot)
      : ['First snapshot - establishing baseline'];

    // Check for milestones
    const milestones = this.checkMilestones(dnaMetrics, previousSnapshot);

    // Determine period if not provided
    const now = new Date();
    const start = periodStart || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
    const end = periodEnd || now;

    const snapshot: InsertTradingDnaSnapshot = {
      userId,
      snapshotType,
      periodStart: start,
      periodEnd: end,
      winRate: dnaMetrics.winRate.toString(),
      avgProfit: dnaMetrics.avgProfit.toString(),
      avgLoss: dnaMetrics.avgLoss.toString(),
      totalTrades: dnaMetrics.totalTrades,
      totalProfitLoss: dnaMetrics.totalProfitLoss.toString(),
      riskScore: dnaMetrics.riskScore.toString(),
      maxDrawdown: dnaMetrics.maxDrawdown.toString(),
      sharpeRatio: dnaMetrics.sharpeRatio.toString(),
      profitFactor: dnaMetrics.profitFactor.toString(),
      tradingStyle: dnaMetrics.tradingStyle,
      revengeTradeScore: dnaMetrics.revengeTradeScore.toString(),
      volatilitySensitivity: dnaMetrics.volatilitySensitivity.toString(),
      improvementVsPrevious: improvement.toString(),
      keyChanges: JSON.stringify(keyChanges),
      milestones: milestones.length > 0 ? JSON.stringify(milestones) : undefined,
    };

    const [created] = await db.insert(tradingDnaSnapshots).values(snapshot).returning();
    
    console.log(`[DNA Evolution] Created ${snapshotType} snapshot for user ${userId}`);
    return created;
  }

  /**
   * Calculate improvement percentage vs previous snapshot
   */
  private calculateImprovement(
    current: TradingDNAMetrics, 
    previous: TradingDnaSnapshot
  ): number {
    // Focus on key metrics: win rate, profit factor, and risk score
    const currentScore = (
      current.winRate * 0.4 + 
      (current.profitFactor * 20) * 0.3 + // Normalize profit factor to 0-100
      (100 - current.riskScore) * 0.3 // Lower risk is better
    );

    const previousScore = (
      parseFloat(previous.winRate) * 0.4 +
      (parseFloat(previous.profitFactor || '0') * 20) * 0.3 +
      (100 - parseFloat(previous.riskScore)) * 0.3
    );

    // Guard against division by zero or NaN
    if (previousScore <= 0 || !Number.isFinite(previousScore) || !Number.isFinite(currentScore)) {
      return 0; // No meaningful comparison possible
    }

    const improvement = ((currentScore - previousScore) / previousScore) * 100;
    
    // Ensure result is finite
    if (!Number.isFinite(improvement)) {
      return 0;
    }

    return Math.round(improvement * 10) / 10; // Round to 1 decimal
  }

  /**
   * Identify key changes between snapshots
   */
  private identifyKeyChanges(
    current: TradingDNAMetrics,
    previous: TradingDnaSnapshot
  ): string[] {
    const changes: string[] = [];

    // Check win rate change
    const winRateDiff = current.winRate - parseFloat(previous.winRate);
    if (Math.abs(winRateDiff) >= 5) {
      changes.push(winRateDiff > 0 
        ? `Win rate improved by ${winRateDiff.toFixed(1)}%`
        : `Win rate decreased by ${Math.abs(winRateDiff).toFixed(1)}%`
      );
    }

    // Check trading style change
    if (current.tradingStyle !== previous.tradingStyle) {
      changes.push(`Trading style shifted from ${previous.tradingStyle} to ${current.tradingStyle}`);
    }

    // Check risk score change
    const riskDiff = current.riskScore - parseFloat(previous.riskScore);
    if (Math.abs(riskDiff) >= 10) {
      changes.push(riskDiff > 0 
        ? `Risk-taking increased (${riskDiff.toFixed(1)} points)`
        : `Risk management improved (${Math.abs(riskDiff).toFixed(1)} points lower)`
      );
    }

    // Check revenge trading
    const revengeDiff = current.revengeTradeScore - parseFloat(previous.revengeTradeScore || '0');
    if (Math.abs(revengeDiff) >= 10) {
      changes.push(revengeDiff > 0
        ? `More emotional trading detected`
        : `Better emotional discipline`
      );
    }

    // Check total trades
    const tradesDiff = current.totalTrades - previous.totalTrades;
    if (tradesDiff >= 10) {
      changes.push(`Trading activity increased (+${tradesDiff} trades)`);
    }

    if (changes.length === 0) {
      changes.push('Consistent trading performance maintained');
    }

    return changes;
  }

  /**
   * Check for achievement milestones
   */
  private checkMilestones(
    current: TradingDNAMetrics,
    previous: TradingDnaSnapshot | undefined
  ): string[] {
    const milestones: string[] = [];

    // Win rate milestones
    if (current.winRate >= 70 && (!previous || parseFloat(previous.winRate) < 70)) {
      milestones.push('🎯 Achieved 70%+ win rate');
    }
    if (current.winRate >= 80 && (!previous || parseFloat(previous.winRate) < 80)) {
      milestones.push('🏆 Exceptional 80%+ win rate');
    }

    // Trade count milestones
    if (current.totalTrades >= 50 && (!previous || previous.totalTrades < 50)) {
      milestones.push('📈 Completed 50 trades');
    }
    if (current.totalTrades >= 100 && (!previous || previous.totalTrades < 100)) {
      milestones.push('🚀 Reached 100 trades');
    }

    // Profit factor milestones
    if (current.profitFactor >= 2.0 && (!previous || parseFloat(previous.profitFactor || '0') < 2.0)) {
      milestones.push('💰 Profit factor above 2.0');
    }

    // Risk management milestones
    if (current.riskScore <= 30 && (!previous || parseFloat(previous.riskScore) > 30)) {
      milestones.push('🛡️ Excellent risk management (score below 30)');
    }

    // Consecutive wins milestone
    if (current.consecutiveWins >= 5 && (!previous || parseFloat(previous.winRate) < 60)) {
      milestones.push('🔥 Hot streak: 5+ consecutive wins');
    }

    // Revenge trading improvement
    if (current.revengeTradeScore <= 20 && (!previous || parseFloat(previous.revengeTradeScore || '50') > 40)) {
      milestones.push('🧘 Emotional discipline mastered');
    }

    return milestones;
  }

  /**
   * Get latest snapshot for a user
   */
  async getLatestSnapshot(userId: string): Promise<TradingDnaSnapshot | undefined> {
    const snapshots = await db.query.tradingDnaSnapshots.findMany({
      where: eq(tradingDnaSnapshots.userId, userId),
      orderBy: [desc(tradingDnaSnapshots.timestamp)],
      limit: 1,
    });

    return snapshots[0];
  }

  /**
   * Get snapshot history
   */
  async getSnapshotHistory(userId: string, limit: number = 30): Promise<TradingDnaSnapshot[]> {
    return db.query.tradingDnaSnapshots.findMany({
      where: eq(tradingDnaSnapshots.userId, userId),
      orderBy: [desc(tradingDnaSnapshots.timestamp)],
      limit,
    });
  }

  /**
   * Get evolution timeline - formatted for charts
   */
  async getEvolutionTimeline(userId: string): Promise<{
    dates: string[];
    winRates: number[];
    riskScores: number[];
    profitFactors: number[];
    totalTrades: number[];
    tradingStyles: string[];
  }> {
    const snapshots = await this.getSnapshotHistory(userId, 30);
    
    // Reverse to show oldest first
    snapshots.reverse();

    return {
      dates: snapshots.map(s => s.timestamp.toISOString().split('T')[0]),
      winRates: snapshots.map(s => parseFloat(s.winRate)),
      riskScores: snapshots.map(s => parseFloat(s.riskScore)),
      profitFactors: snapshots.map(s => parseFloat(s.profitFactor || '0')),
      totalTrades: snapshots.map(s => s.totalTrades),
      tradingStyles: snapshots.map(s => s.tradingStyle),
    };
  }

  /**
   * Get all milestones achieved
   */
  async getAllMilestones(userId: string): Promise<Array<{
    date: Date;
    milestone: string;
    snapshotType: string;
  }>> {
    const snapshots = await this.getSnapshotHistory(userId, 100);
    const allMilestones: Array<{ date: Date; milestone: string; snapshotType: string }> = [];

    snapshots.forEach(snapshot => {
      if (snapshot.milestones) {
        try {
          const milestones: string[] = JSON.parse(snapshot.milestones);
          milestones.forEach(m => {
            allMilestones.push({
              date: snapshot.timestamp,
              milestone: m,
              snapshotType: snapshot.snapshotType,
            });
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    return allMilestones;
  }

  /**
   * Automatically create periodic snapshots
   */
  async createPeriodicSnapshots(userId: string): Promise<void> {
    const latest = await this.getLatestSnapshot(userId);
    const now = new Date();

    if (!latest) {
      // First snapshot
      await this.createSnapshot({ 
        userId, 
        snapshotType: 'milestone',
        periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: now,
      });
      return;
    }

    const daysSinceLast = Math.floor(
      (now.getTime() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Daily snapshot (every 1 day)
    if (daysSinceLast >= 1) {
      await this.createSnapshot({ 
        userId, 
        snapshotType: 'daily',
        periodStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        periodEnd: now,
      });
    }

    // Weekly snapshot (every 7 days)
    if (daysSinceLast >= 7) {
      await this.createSnapshot({ 
        userId, 
        snapshotType: 'weekly',
        periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: now,
      });
    }

    // Monthly snapshot (every 30 days)
    if (daysSinceLast >= 30) {
      await this.createSnapshot({ 
        userId, 
        snapshotType: 'monthly',
        periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: now,
      });
    }
  }
}

export const tradingDnaEvolution = new TradingDnaEvolutionTracker();
