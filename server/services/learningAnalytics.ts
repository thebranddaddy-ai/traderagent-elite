/**
 * Learning Analytics Service - Phase B
 * 
 * Purpose: Calculate AI accuracy metrics and track learning progress
 * Shows users how the AI is getting better at understanding them
 * 
 * Features:
 * - Calculate overall AI accuracy
 * - Track accuracy improvements over time
 * - Generate learning checkpoints
 * - Identify personalization trends
 */

import { db } from "../db";
import { 
  learningCheckpoints, 
  aiSuggestionOutcomes, 
  userFeedback,
  personalizationMetrics 
} from "@shared/schema";
import type { 
  InsertLearningCheckpoint, 
  LearningCheckpoint,
  PersonalizationMetrics 
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export class LearningAnalyticsService {
  
  /**
   * Create a learning checkpoint - snapshot of AI performance
   */
  async createCheckpoint(params: {
    userId: string;
    checkpointType: 'weekly' | 'monthly' | 'milestone' | 'manual';
    modelVersion: string;
  }): Promise<LearningCheckpoint> {
    const { userId, checkpointType, modelVersion } = params;

    // Calculate current AI accuracy metrics
    const accuracyMetrics = await this.calculateAccuracyMetrics(userId);
    
    // Get user engagement stats
    const engagementStats = await this.calculateEngagementStats(userId);
    
    // Get previous checkpoint for improvement calculation
    const previousCheckpoint = await this.getLatestCheckpoint(userId);
    const improvement = previousCheckpoint 
      ? parseFloat(accuracyMetrics.overallAccuracy) - parseFloat(previousCheckpoint.overallAccuracy)
      : 0;

    // Determine personalization level
    const personalLevel = this.determinePersonalizationLevel(
      engagementStats.totalDataPoints,
      parseFloat(accuracyMetrics.overallAccuracy)
    );

    const checkpoint: InsertLearningCheckpoint = {
      userId,
      checkpointType,
      modelVersion,
      overallAccuracy: accuracyMetrics.overallAccuracy,
      suggestionAccuracy: accuracyMetrics.suggestionAccuracy,
      riskAssessmentAccuracy: accuracyMetrics.riskAssessmentAccuracy,
      exitTimingAccuracy: accuracyMetrics.exitTimingAccuracy,
      totalSuggestions: engagementStats.totalSuggestions,
      suggestionsFollowed: engagementStats.suggestionsFollowed,
      followRate: engagementStats.followRate,
      dataPointsCollected: engagementStats.totalDataPoints,
      confidenceImprovement: improvement.toString(),
      profitWhenFollowed: engagementStats.profitWhenFollowed,
      lossWhenFollowed: engagementStats.lossWhenFollowed,
      winRateWhenFollowed: engagementStats.winRateWhenFollowed,
      personalizationLevel: personalLevel,
      keyLearnings: JSON.stringify(accuracyMetrics.keyLearnings || []),
    };

    const [created] = await db.insert(learningCheckpoints).values(checkpoint).returning();
    
    console.log(`[Learning Analytics] Created ${checkpointType} checkpoint for user ${userId}`);
    return created;
  }

  /**
   * Calculate comprehensive accuracy metrics
   */
  async calculateAccuracyMetrics(userId: string): Promise<{
    overallAccuracy: string;
    suggestionAccuracy: string | undefined;
    riskAssessmentAccuracy: string | undefined;
    exitTimingAccuracy: string | undefined;
    keyLearnings: string[];
  }> {
    // Get all outcomes with accuracy data
    const outcomes = await db.query.aiSuggestionOutcomes.findMany({
      where: and(
        eq(aiSuggestionOutcomes.userId, userId),
        // Only outcomes with accuracy scores
      ),
      limit: 500,
    });

    const withAccuracy = outcomes.filter(o => o.predictionAccuracy !== null);
    
    if (withAccuracy.length === 0) {
      return {
        overallAccuracy: '0',
        suggestionAccuracy: undefined,
        riskAssessmentAccuracy: undefined,
        exitTimingAccuracy: undefined,
        keyLearnings: ['Not enough data yet - keep using AI features'],
      };
    }

    // Calculate overall accuracy
    const totalAccuracy = withAccuracy.reduce((sum, o) => 
      sum + parseFloat(o.predictionAccuracy || '0'), 0
    );
    const overallAccuracy = Math.round(totalAccuracy / withAccuracy.length);

    // Calculate per-feature accuracy
    const byFeature: Record<string, number[]> = {};
    withAccuracy.forEach(o => {
      if (!byFeature[o.featureType]) {
        byFeature[o.featureType] = [];
      }
      byFeature[o.featureType].push(parseFloat(o.predictionAccuracy || '0'));
    });

    const calculateAvg = (arr: number[]) => 
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : undefined;

    // Generate key learnings
    const keyLearnings: string[] = [];
    
    if (overallAccuracy >= 80) {
      keyLearnings.push('AI is highly accurate for your trading style');
    } else if (overallAccuracy >= 60) {
      keyLearnings.push('AI is learning your preferences - keep providing feedback');
    } else {
      keyLearnings.push('AI needs more data to personalize to your style');
    }

    // Identify strongest feature
    const featureAccuracies = Object.entries(byFeature).map(([feature, scores]) => ({
      feature,
      accuracy: calculateAvg(scores) || 0,
    }));
    featureAccuracies.sort((a, b) => b.accuracy - a.accuracy);
    
    if (featureAccuracies.length > 0 && featureAccuracies[0].accuracy >= 75) {
      keyLearnings.push(`Best at: ${featureAccuracies[0].feature.replace('_', ' ')}`);
    }

    return {
      overallAccuracy: overallAccuracy.toString(),
      suggestionAccuracy: calculateAvg(byFeature['trade_suggestion'] || [])?.toString(),
      riskAssessmentAccuracy: calculateAvg(byFeature['risk_assessment'] || [])?.toString(),
      exitTimingAccuracy: calculateAvg(byFeature['exit_advisor'] || [])?.toString(),
      keyLearnings,
    };
  }

  /**
   * Calculate user engagement statistics
   */
  async calculateEngagementStats(userId: string): Promise<{
    totalSuggestions: number;
    suggestionsFollowed: number;
    followRate: string;
    totalDataPoints: number;
    profitWhenFollowed: string | undefined;
    lossWhenFollowed: string | undefined;
    winRateWhenFollowed: string | undefined;
  }> {
    const outcomes = await db.query.aiSuggestionOutcomes.findMany({
      where: eq(aiSuggestionOutcomes.userId, userId),
      limit: 1000,
    });

    const feedback = await db.query.userFeedback.findMany({
      where: eq(userFeedback.userId, userId),
      limit: 1000,
    });

    const totalSuggestions = outcomes.length;
    const suggestionsFollowed = outcomes.filter(o => o.userFollowed).length;
    const followRate = totalSuggestions > 0 
      ? ((suggestionsFollowed / totalSuggestions) * 100).toFixed(1)
      : '0';

    const totalDataPoints = outcomes.length + feedback.length;

    // Calculate P/L when following AI
    const followedWithOutcome = outcomes.filter(o => 
      o.userFollowed && o.profitLossAmount !== null
    );

    let totalProfit = 0;
    let totalLoss = 0;
    let wins = 0;

    followedWithOutcome.forEach(o => {
      const pnl = parseFloat(o.profitLossAmount || '0');
      if (pnl > 0) {
        totalProfit += pnl;
        wins++;
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl);
      }
    });

    const winRate = followedWithOutcome.length > 0
      ? ((wins / followedWithOutcome.length) * 100).toFixed(1)
      : undefined;

    return {
      totalSuggestions,
      suggestionsFollowed,
      followRate,
      totalDataPoints,
      profitWhenFollowed: totalProfit > 0 ? totalProfit.toFixed(2) : undefined,
      lossWhenFollowed: totalLoss > 0 ? totalLoss.toFixed(2) : undefined,
      winRateWhenFollowed: winRate,
    };
  }

  /**
   * Determine personalization level based on data and accuracy
   */
  private determinePersonalizationLevel(
    dataPoints: number, 
    accuracy: number
  ): 'learning' | 'personalizing' | 'optimized' {
    if (dataPoints < 20) {
      return 'learning'; // Still collecting initial data
    } else if (dataPoints < 50 || accuracy < 70) {
      return 'personalizing'; // Have some data, refining predictions
    } else {
      return 'optimized'; // Enough data and good accuracy
    }
  }

  /**
   * Get latest checkpoint for a user
   */
  async getLatestCheckpoint(userId: string): Promise<LearningCheckpoint | undefined> {
    const checkpoints = await db.query.learningCheckpoints.findMany({
      where: eq(learningCheckpoints.userId, userId),
      orderBy: [desc(learningCheckpoints.timestamp)],
      limit: 1,
    });

    return checkpoints[0];
  }

  /**
   * Get checkpoint history for a user
   */
  async getCheckpointHistory(userId: string, limit: number = 10): Promise<LearningCheckpoint[]> {
    return db.query.learningCheckpoints.findMany({
      where: eq(learningCheckpoints.userId, userId),
      orderBy: [desc(learningCheckpoints.timestamp)],
      limit,
    });
  }

  /**
   * Get learning progress summary
   */
  async getProgressSummary(userId: string): Promise<{
    currentAccuracy: number;
    accuracyTrend: 'improving' | 'stable' | 'declining';
    dataCollectionProgress: number;
    personalizationLevel: string;
    checkpointsCount: number;
    latestCheckpoint: LearningCheckpoint | undefined;
  }> {
    const metrics = await db.query.personalizationMetrics.findFirst({
      where: eq(personalizationMetrics.userId, userId),
    });

    const checkpoints = await this.getCheckpointHistory(userId, 2);
    const latest = checkpoints[0];
    const previous = checkpoints[1];

    let accuracyTrend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (latest && previous) {
      const latestAcc = parseFloat(latest.overallAccuracy);
      const prevAcc = parseFloat(previous.overallAccuracy);
      
      if (latestAcc > prevAcc + 5) accuracyTrend = 'improving';
      else if (latestAcc < prevAcc - 5) accuracyTrend = 'declining';
    }

    return {
      currentAccuracy: latest ? parseFloat(latest.overallAccuracy) : 0,
      accuracyTrend,
      dataCollectionProgress: metrics ? parseFloat(metrics.dataCollectionProgress) : 0,
      personalizationLevel: latest?.personalizationLevel || 'learning',
      checkpointsCount: checkpoints.length,
      latestCheckpoint: latest,
    };
  }

  /**
   * Automatically create periodic checkpoints
   */
  async createPeriodicCheckpoints(userId: string, modelVersion: string = 'gpt-4o-mini'): Promise<void> {
    const latest = await this.getLatestCheckpoint(userId);
    
    if (!latest) {
      // First checkpoint
      await this.createCheckpoint({ 
        userId, 
        checkpointType: 'manual', 
        modelVersion 
      });
      return;
    }

    const daysSinceLastCheckpoint = Math.floor(
      (Date.now() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Create weekly checkpoint if 7+ days since last
    if (daysSinceLastCheckpoint >= 7) {
      await this.createCheckpoint({ 
        userId, 
        checkpointType: 'weekly', 
        modelVersion 
      });
    }

    // Create monthly checkpoint if 30+ days since last
    if (daysSinceLastCheckpoint >= 30) {
      await this.createCheckpoint({ 
        userId, 
        checkpointType: 'monthly', 
        modelVersion 
      });
    }
  }
}

export const learningAnalytics = new LearningAnalyticsService();
