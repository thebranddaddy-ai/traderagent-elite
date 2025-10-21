/**
 * User Feedback Service - Phase B
 * 
 * Purpose: Capture explicit user feedback on AI recommendations
 * Critical for learning - understand what users find helpful
 * 
 * Features:
 * - Record thumbs up/down ratings
 * - Collect detailed feedback (helpfulness, accuracy)
 * - Capture emotional context
 * - Feed data into personalization
 */

import { db } from "../db";
import { userFeedback, personalizationMetrics } from "@shared/schema";
import type { InsertUserFeedback, UserFeedback as UserFeedbackType } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export class UserFeedbackService {
  
  /**
   * Submit feedback on an AI recommendation
   */
  async submitFeedback(params: {
    userId: string;
    feedbackType: 'suggestion' | 'exit_advice' | 'risk_assessment' | 'insight' | 'coaching' | 'prediction';
    referenceId?: string;
    auditLogId?: string;
    rating: number; // 1-5 stars or -1 (thumbs down), 1 (thumbs up)
    helpfulness?: number; // 1-5
    accuracy?: number; // 1-5
    comment?: string;
    tags?: string[]; // ['too_aggressive', 'perfect_timing', 'missed_context']
    marketCondition?: 'volatile' | 'stable' | 'trending';
    userEmotionalState?: 'calm' | 'stressed' | 'confident' | 'uncertain';
  }): Promise<UserFeedbackType> {
    const feedback: InsertUserFeedback = {
      userId: params.userId,
      feedbackType: params.feedbackType,
      referenceId: params.referenceId,
      auditLogId: params.auditLogId,
      rating: params.rating,
      helpfulness: params.helpfulness,
      accuracy: params.accuracy,
      comment: params.comment,
      tags: params.tags ? JSON.stringify(params.tags) : undefined,
      marketCondition: params.marketCondition,
      userEmotionalState: params.userEmotionalState,
    };

    const [created] = await db.insert(userFeedback).values(feedback).returning();

    // Update personalization metrics
    await this.updatePersonalizationMetrics(params.userId, {
      totalFeedback: 1,
      feedbackRating: params.rating,
    });

    console.log(`[User Feedback] Received ${params.rating}-star rating for ${params.feedbackType}`);
    return created;
  }

  /**
   * Quick thumbs up/down feedback
   */
  async quickFeedback(params: {
    userId: string;
    feedbackType: 'suggestion' | 'exit_advice' | 'risk_assessment' | 'insight' | 'coaching' | 'prediction';
    referenceId?: string;
    auditLogId?: string;
    thumbsUp: boolean;
  }): Promise<UserFeedbackType> {
    return this.submitFeedback({
      userId: params.userId,
      feedbackType: params.feedbackType,
      referenceId: params.referenceId,
      auditLogId: params.auditLogId,
      rating: params.thumbsUp ? 1 : -1, // 1 for thumbs up, -1 for thumbs down
    });
  }

  /**
   * Get all feedback for a user
   */
  async getUserFeedback(userId: string, limit: number = 50): Promise<UserFeedbackType[]> {
    return db.query.userFeedback.findMany({
      where: eq(userFeedback.userId, userId),
      orderBy: [desc(userFeedback.timestamp)],
      limit,
    });
  }

  /**
   * Get feedback by feature type
   */
  async getFeedbackByType(userId: string, feedbackType: string): Promise<UserFeedbackType[]> {
    return db.query.userFeedback.findMany({
      where: and(
        eq(userFeedback.userId, userId),
        eq(userFeedback.feedbackType, feedbackType)
      ),
      orderBy: [desc(userFeedback.timestamp)],
    });
  }

  /**
   * Calculate average rating for a feature
   */
  async getAverageRating(userId: string, feedbackType: string): Promise<number> {
    const feedback = await this.getFeedbackByType(userId, feedbackType);
    
    if (feedback.length === 0) return 0;

    const total = feedback.reduce((sum: number, f: UserFeedbackType) => sum + f.rating, 0);
    return Math.round((total / feedback.length) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get positive feedback percentage
   */
  async getPositiveFeedbackRate(userId: string): Promise<number> {
    const allFeedback = await this.getUserFeedback(userId, 1000);
    
    if (allFeedback.length === 0) return 0;

    const positive = allFeedback.filter((f: UserFeedbackType) => f.rating > 0).length;
    return Math.round((positive / allFeedback.length) * 100);
  }

  /**
   * Get common feedback tags
   */
  async getCommonTags(userId: string, feedbackType?: string): Promise<Record<string, number>> {
    const feedback = feedbackType 
      ? await this.getFeedbackByType(userId, feedbackType)
      : await this.getUserFeedback(userId, 1000);

    const tagCounts: Record<string, number> = {};

    feedback.forEach((f: UserFeedbackType) => {
      if (f.tags) {
        try {
          const tags: string[] = JSON.parse(f.tags);
          tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    return tagCounts;
  }

  /**
   * Update personalization metrics with feedback data
   */
  private async updatePersonalizationMetrics(
    userId: string,
    updates: {
      totalFeedback?: number;
      feedbackRating?: number;
    }
  ) {
    const existing = await db.query.personalizationMetrics.findFirst({
      where: eq(personalizationMetrics.userId, userId),
    });

    if (!existing) {
      // Initialize if doesn't exist
      await db.insert(personalizationMetrics).values({
        userId,
        personalizationScore: '0',
        dataCollectionProgress: '0',
        totalFeedback: updates.totalFeedback || 0,
      });
    } else {
      // Update existing
      const newFeedback = existing.totalFeedback + (updates.totalFeedback || 0);
      
      // Calculate data collection progress
      const dataPoints = existing.totalInteractions + existing.totalOutcomes + newFeedback;
      const progress = Math.min(100, Math.round((dataPoints / 100) * 100));

      await db.update(personalizationMetrics)
        .set({
          totalFeedback: newFeedback,
          dataCollectionProgress: progress.toString(),
          lastUpdated: new Date(),
        })
        .where(eq(personalizationMetrics.userId, userId));
    }
  }

  /**
   * Analyze feedback patterns for a user
   */
  async analyzeFeedbackPatterns(userId: string): Promise<{
    mostHelpfulFeature: string | null;
    leastHelpfulFeature: string | null;
    averageRating: number;
    totalFeedbackCount: number;
    positiveFeedbackRate: number;
    commonTags: Record<string, number>;
  }> {
    const allFeedback = await this.getUserFeedback(userId, 1000);

    if (allFeedback.length === 0) {
      return {
        mostHelpfulFeature: null,
        leastHelpfulFeature: null,
        averageRating: 0,
        totalFeedbackCount: 0,
        positiveFeedbackRate: 0,
        commonTags: {},
      };
    }

    // Calculate average rating by feature
    const featureRatings: Record<string, { total: number; count: number }> = {};
    
    allFeedback.forEach((f: UserFeedbackType) => {
      if (!featureRatings[f.feedbackType]) {
        featureRatings[f.feedbackType] = { total: 0, count: 0 };
      }
      featureRatings[f.feedbackType].total += f.rating;
      featureRatings[f.feedbackType].count += 1;
    });

    const averagesByFeature = Object.entries(featureRatings).map(([feature, data]) => ({
      feature,
      avg: data.total / data.count,
    }));

    averagesByFeature.sort((a, b) => b.avg - a.avg);

    const mostHelpful = averagesByFeature[0]?.feature || null;
    const leastHelpful = averagesByFeature[averagesByFeature.length - 1]?.feature || null;

    const totalRating = allFeedback.reduce((sum: number, f: UserFeedbackType) => sum + f.rating, 0);
    const avgRating = totalRating / allFeedback.length;

    const positive = allFeedback.filter((f: UserFeedbackType) => f.rating > 0).length;
    const positiveRate = (positive / allFeedback.length) * 100;

    const commonTags = await this.getCommonTags(userId);

    return {
      mostHelpfulFeature: mostHelpful,
      leastHelpfulFeature: leastHelpful,
      averageRating: Math.round(avgRating * 10) / 10,
      totalFeedbackCount: allFeedback.length,
      positiveFeedbackRate: Math.round(positiveRate),
      commonTags,
    };
  }
}

export const userFeedbackService = new UserFeedbackService();
