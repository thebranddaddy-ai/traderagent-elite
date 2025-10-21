/**
 * AI Outcome Tracking Service - Phase B
 * 
 * Purpose: Track what actually happens after AI suggestions
 * Critical for learning loop - AI learns from real outcomes
 * 
 * Features:
 * - Record user actions (followed/ignored AI advice)
 * - Track actual trade results vs AI predictions
 * - Calculate prediction accuracy
 * - Feed data into personalization metrics
 */

import { db } from "../db";
import { aiSuggestionOutcomes, personalizationMetrics } from "@shared/schema";
import type { InsertAISuggestionOutcome, AISuggestionOutcome } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export class AIOutcomeTracker {
  
  /**
   * Record that user followed or ignored an AI suggestion
   */
  async recordUserAction(params: {
    userId: string;
    auditLogId?: string;
    suggestionId?: string;
    featureType: string;
    userFollowed: boolean;
    actionTaken: 'executed_trade' | 'ignored' | 'modified' | 'partial_follow';
    modificationDetails?: Record<string, any>;
    aiPredictedOutcome?: string;
  }) {
    const outcome: InsertAISuggestionOutcome = {
      userId: params.userId,
      auditLogId: params.auditLogId,
      suggestionId: params.suggestionId,
      featureType: params.featureType,
      userFollowed: params.userFollowed,
      actionTaken: params.actionTaken,
      modificationDetails: params.modificationDetails ? JSON.stringify(params.modificationDetails) : undefined,
      aiPredictedOutcome: params.aiPredictedOutcome,
      suggestionTimestamp: new Date(),
    };

    const [created] = await db.insert(aiSuggestionOutcomes).values(outcome).returning();
    
    // Update personalization metrics - increment interactions
    await this.updatePersonalizationMetrics(params.userId, { totalInteractions: 1 });
    
    console.log(`[AI Outcome] Recorded ${params.actionTaken} for ${params.featureType}`);
    return created;
  }

  /**
   * Update outcome with actual trade results
   */
  async recordTradeOutcome(params: {
    outcomeId: string;
    userId: string;
    actualOutcome: 'profit' | 'loss' | 'break_even' | 'still_open';
    profitLossAmount?: number;
    profitLossPercent?: number;
    aiPredictedOutcome?: string;
  }): Promise<AISuggestionOutcome> {
    const { outcomeId, actualOutcome, profitLossAmount, profitLossPercent, aiPredictedOutcome } = params;
    
    // Calculate prediction accuracy
    let predictionAccuracy: number | undefined;
    if (aiPredictedOutcome) {
      // Simple accuracy: did AI predict profit/loss correctly?
      const predicted = aiPredictedOutcome.toLowerCase();
      const actual = actualOutcome.toLowerCase();
      
      if (predicted === actual) {
        predictionAccuracy = 100;
      } else if (
        (predicted.includes('profit') && actual === 'profit') ||
        (predicted.includes('loss') && actual === 'loss')
      ) {
        predictionAccuracy = 80;
      } else if (actual === 'break_even') {
        predictionAccuracy = 50;
      } else {
        predictionAccuracy = 0;
      }
    }

    const wasSuccessful = actualOutcome === 'profit' || actualOutcome === 'break_even';

    const [updated] = await db.update(aiSuggestionOutcomes)
      .set({
        actualOutcome,
        profitLossAmount: profitLossAmount?.toString(),
        profitLossPercent: profitLossPercent?.toString(),
        predictionAccuracy: predictionAccuracy?.toString(),
        wasSuccessful,
        outcomeTimestamp: new Date(),
      })
      .where(eq(aiSuggestionOutcomes.id, outcomeId))
      .returning();

    // Update personalization metrics - increment outcomes
    await this.updatePersonalizationMetrics(params.userId, { 
      totalOutcomes: 1,
      predictionAccuracy
    });

    console.log(`[AI Outcome] Recorded ${actualOutcome} for outcome ${outcomeId}`);
    
    return updated;
  }

  /**
   * Add learning notes to an outcome
   */
  async addLearningNotes(outcomeId: string, notes: Record<string, any>) {
    await db.update(aiSuggestionOutcomes)
      .set({
        learningNotes: JSON.stringify(notes),
      })
      .where(eq(aiSuggestionOutcomes.id, outcomeId));
  }

  /**
   * Get all outcomes for a user
   */
  async getUserOutcomes(userId: string, limit: number = 50): Promise<AISuggestionOutcome[]> {
    return db.query.aiSuggestionOutcomes.findMany({
      where: eq(aiSuggestionOutcomes.userId, userId),
      orderBy: [desc(aiSuggestionOutcomes.timestamp)],
      limit,
    });
  }

  /**
   * Get outcomes by feature type
   */
  async getOutcomesByFeature(userId: string, featureType: string): Promise<AISuggestionOutcome[]> {
    return db.query.aiSuggestionOutcomes.findMany({
      where: and(
        eq(aiSuggestionOutcomes.userId, userId),
        eq(aiSuggestionOutcomes.featureType, featureType)
      ),
      orderBy: [desc(aiSuggestionOutcomes.timestamp)],
    });
  }

  /**
   * Calculate AI accuracy for a specific feature
   */
  async calculateFeatureAccuracy(userId: string, featureType: string): Promise<number> {
    const outcomes = await this.getOutcomesByFeature(userId, featureType);
    
    if (outcomes.length === 0) return 0;

    const withAccuracy = outcomes.filter((o: AISuggestionOutcome) => o.predictionAccuracy !== null);
    if (withAccuracy.length === 0) return 0;

    const totalAccuracy = withAccuracy.reduce((sum: number, o: AISuggestionOutcome) => 
      sum + (parseFloat(o.predictionAccuracy || '0')), 0
    );

    return Math.round(totalAccuracy / withAccuracy.length);
  }

  /**
   * Update personalization metrics incrementally
   */
  private async updatePersonalizationMetrics(
    userId: string, 
    updates: { 
      totalInteractions?: number; 
      totalOutcomes?: number;
      totalFeedback?: number;
      predictionAccuracy?: number;
    }
  ) {
    // Get current metrics or create if doesn't exist
    const existing = await db.query.personalizationMetrics.findFirst({
      where: eq(personalizationMetrics.userId, userId),
    });

    if (!existing) {
      // Initialize metrics for new user
      await db.insert(personalizationMetrics).values({
        userId,
        personalizationScore: '0',
        dataCollectionProgress: '0',
        totalInteractions: updates.totalInteractions || 0,
        totalOutcomes: updates.totalOutcomes || 0,
        totalFeedback: updates.totalFeedback || 0,
      });
    } else {
      // Update existing metrics
      const newInteractions = existing.totalInteractions + (updates.totalInteractions || 0);
      const newOutcomes = existing.totalOutcomes + (updates.totalOutcomes || 0);
      const newFeedback = existing.totalFeedback + (updates.totalFeedback || 0);

      // Calculate data collection progress (0-100%)
      const dataPoints = newInteractions + newOutcomes + newFeedback;
      const progress = Math.min(100, Math.round((dataPoints / 100) * 100)); // Need 100 data points for 100%

      // Calculate personalization score (0-100%)
      // Higher score when we have more data and better accuracy
      const personalScore = Math.min(100, Math.round(
        (progress * 0.6) + // 60% weight on data collection
        ((updates.predictionAccuracy || 0) * 0.4) // 40% weight on accuracy
      ));

      await db.update(personalizationMetrics)
        .set({
          totalInteractions: newInteractions,
          totalOutcomes: newOutcomes,
          totalFeedback: newFeedback,
          dataCollectionProgress: progress.toString(),
          personalizationScore: personalScore.toString(),
          lastUpdated: new Date(),
        })
        .where(eq(personalizationMetrics.userId, userId));
    }
  }

  /**
   * Get user's follow rate (% of AI suggestions they actually follow)
   */
  async getUserFollowRate(userId: string): Promise<number> {
    const outcomes = await this.getUserOutcomes(userId, 1000);
    
    if (outcomes.length === 0) return 0;

    const followed = outcomes.filter((o: AISuggestionOutcome) => o.userFollowed).length;
    return Math.round((followed / outcomes.length) * 100);
  }

  /**
   * Get user's success rate when following AI
   */
  async getSuccessRateWhenFollowingAI(userId: string): Promise<{
    winRate: number;
    totalFollowed: number;
    profitable: number;
  }> {
    const outcomes = await this.getUserOutcomes(userId, 1000);
    
    const followedOutcomes = outcomes.filter((o: AISuggestionOutcome) => 
      o.userFollowed && o.actualOutcome !== null
    );

    if (followedOutcomes.length === 0) {
      return { winRate: 0, totalFollowed: 0, profitable: 0 };
    }

    const profitable = followedOutcomes.filter((o: AISuggestionOutcome) => 
      o.wasSuccessful === true
    ).length;

    const winRate = Math.round((profitable / followedOutcomes.length) * 100);

    return {
      winRate,
      totalFollowed: followedOutcomes.length,
      profitable,
    };
  }
}

export const aiOutcomeTracker = new AIOutcomeTracker();
