/**
 * Adaptive Refinement Loop (Phase 5)
 * 
 * Links mistake predictions to actual trade outcomes
 * Automatically adjusts prediction thresholds for individual traders
 * Feeds positive outcomes into DNA evolution
 */

import { db } from '../db';
import { mistakePredictions, aiPersonalExamples, aiAgentHealth, users } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

interface OutcomeData {
  predictionId: string;
  userId: string;
  tradeId: string;
  actualPnL: number;
  expectedPnL?: number;
  userHeededWarning: boolean;
  finalDecision: 'modified_trade' | 'cancelled' | 'proceeded_anyway' | 'dismissed';
}

export const adaptiveRefinement = {
  /**
   * Record trade outcome and update AI learning
   */
  async recordTradeOutcome(data: OutcomeData) {
    const { predictionId, userId, tradeId, actualPnL, userHeededWarning, finalDecision } = data;

    // 1. Verify prediction ownership
    const [prediction] = await db
      .select()
      .from(mistakePredictions)
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      )
      .limit(1);

    if (!prediction) {
      throw new Error('Prediction not found or access denied');
    }

    // 2. Determine if prediction was accurate
    const wasLoss = actualPnL < 0;
    const wasCriticalLoss = actualPnL < -100; // Loss > $100
    
    // Prediction was correct if:
    // - AI warned AND user lost money OR
    // - AI warned critically AND user lost significantly
    const predictionCorrect = 
      (prediction.severity === 'critical' && wasCriticalLoss) ||
      (prediction.severity === 'high' && wasLoss) ||
      (prediction.severity === 'medium' && wasLoss);

    // 3. Update prediction record with outcome
    await db
      .update(mistakePredictions)
      .set({
        tradeExecuted: true,
        tradeId,
        actualOutcome: predictionCorrect ? 'prediction_correct' : 'prediction_wrong',
        outcomeDetails: JSON.stringify({
          actualPnL,
          wasLoss,
          wasCriticalLoss,
          userHeededWarning,
          finalDecision,
        }),
        predictionAccurate: predictionCorrect,
        wasHeeded: userHeededWarning,
        userResponse: finalDecision,
      })
      .where(
        and(
          eq(mistakePredictions.id, predictionId),
          eq(mistakePredictions.userId, userId)
        )
      );

    // 4. Create learning example based on outcome
    await this.createLearningExample({
      userId,
      predictionId,
      wasCorrect: predictionCorrect,
      userHeeded: userHeededWarning,
      actualPnL,
      prediction,
    });

    // 5. Update agent health metrics
    await this.updateAgentHealth(userId, predictionCorrect);

    // 6. If user ignored warning and lost money, create negative example
    if (!userHeededWarning && wasLoss) {
      await this.recordIgnoredWarningLoss(userId, predictionId, actualPnL);
    }

    // 7. If prediction was correct, reinforce the pattern in DNA
    if (predictionCorrect && userHeededWarning) {
      await this.reinforceSuccessPattern(userId, prediction);
    }

    return {
      outcome: predictionCorrect ? 'prediction_correct' : 'prediction_wrong',
      learningCreated: true,
      agentUpdated: true,
    };
  },

  /**
   * Create learning example from prediction outcome
   */
  async createLearningExample({ userId, predictionId, wasCorrect, userHeeded, actualPnL, prediction }: any) {
    const feedbackType = wasCorrect ? 'thumbs_up' : 'thumbs_down';

    await db.insert(aiPersonalExamples).values({
      userId,
      contextType: 'mistake_prediction',
      contextId: predictionId,
      aiInput: {
        predictionType: prediction.predictionType,
        severity: prediction.severity,
        confidence: prediction.confidence,
      },
      aiOutput: {
        reasoning: prediction.reasoning,
        alternativeSuggestion: prediction.alternativeSuggestion,
      },
      aiReasoning: prediction.reasoning,
      feedbackType,
      feedbackNotes: wasCorrect 
        ? `AI correctly predicted ${prediction.predictionType}. User ${userHeeded ? 'heeded warning' : 'proceeded anyway'}.`
        : `AI predicted ${prediction.predictionType} but trade outcome was different.`,
      userAction: userHeeded ? 'accepted' : 'ignored',
      outcomeTracked: true,
      outcomePositive: wasCorrect,
      outcomePnL: actualPnL.toString(),
      // Privacy: defaults to isPrivate=true, only shared if user opted in
    });
  },

  /**
   * Update agent health based on prediction accuracy
   */
  async updateAgentHealth(userId: string, predictionWasCorrect: boolean) {
    const [health] = await db
      .select()
      .from(aiAgentHealth)
      .where(eq(aiAgentHealth.userId, userId))
      .limit(1);

    if (!health) {
      // Initialize if doesn't exist
      await db.insert(aiAgentHealth).values({
        userId,
        confidenceScore: predictionWasCorrect ? '55' : '45',
        readinessLevel: 'learning',
        totalExamples: 1,
        positiveExamples: predictionWasCorrect ? 1 : 0,
        negativeExamples: predictionWasCorrect ? 0 : 1,
        updatedAt: new Date(),
      });
      return;
    }

    // Calculate new confidence score
    const currentConfidence = parseFloat(health.confidenceScore);
    const totalExamples = health.totalExamples + 1;
    const positiveExamples = health.positiveExamples + (predictionWasCorrect ? 1 : 0);
    const negativeExamples = health.negativeExamples + (predictionWasCorrect ? 0 : 1);
    
    // Accuracy rate
    const accuracyRate = (positiveExamples / totalExamples) * 100;
    
    // Adjust confidence: blend current confidence with accuracy rate (70-30 weight)
    const newConfidence = (currentConfidence * 0.7 + accuracyRate * 0.3);
    
    // Determine readiness level
    let readinessLevel: 'learning' | 'training' | 'ready' | 'expert' = 'learning';
    if (totalExamples >= 50 && newConfidence >= 75) readinessLevel = 'expert';
    else if (totalExamples >= 25 && newConfidence >= 65) readinessLevel = 'ready';
    else if (totalExamples >= 10 && newConfidence >= 55) readinessLevel = 'training';

    await db
      .update(aiAgentHealth)
      .set({
        confidenceScore: newConfidence.toFixed(1),
        readinessLevel,
        totalExamples,
        positiveExamples,
        negativeExamples,
        updatedAt: new Date(),
      })
      .where(eq(aiAgentHealth.userId, userId));
  },

  /**
   * Record when user ignored warning and lost money (important negative feedback)
   */
  async recordIgnoredWarningLoss(userId: string, predictionId: string, lossAmount: number) {
    // This is a critical learning moment - store as high-priority negative example
    await db.insert(aiPersonalExamples).values({
      userId,
      contextType: 'risk_warning',
      contextId: predictionId,
      aiInput: {
        predictionId,
        lossAmount,
        ignored: true,
      },
      aiOutput: {
        warning: 'Risk warning was issued',
      },
      aiReasoning: 'User ignored AI risk warning',
      feedbackType: 'thumbs_down',
      feedbackNotes: `User ignored warning and lost $${Math.abs(lossAmount).toFixed(2)}. This pattern should be reinforced.`,
      userAction: 'ignored',
      outcomeTracked: true,
      outcomePositive: false,
      outcomePnL: lossAmount.toString(),
    });
  },

  /**
   * Reinforce successful prediction patterns in user's DNA
   */
  async reinforceSuccessPattern(userId: string, prediction: any) {
    // When AI correctly predicts AND user heeds warning, this is ideal behavior
    // Store as positive example with high weight for future predictions
    await db.insert(aiPersonalExamples).values({
      userId,
      contextType: 'success_pattern',
      contextId: prediction.id,
      aiInput: {
        predictionType: prediction.predictionType,
        severity: prediction.severity,
        confidence: prediction.confidence,
        triggerFactors: prediction.triggerFactors,
      },
      aiOutput: {
        reasoning: prediction.reasoning,
        alternativeSuggestion: prediction.alternativeSuggestion,
      },
      aiReasoning: prediction.reasoning,
      feedbackType: 'thumbs_up',
      feedbackNotes: 'Successful prediction - user heeded warning and avoided loss',
      userAction: 'accepted',
      outcomeTracked: true,
      outcomePositive: true,
    });
  },

  /**
   * Get adaptive threshold adjustments for user
   * Returns personalized confidence thresholds based on past accuracy
   */
  async getAdaptiveThresholds(userId: string) {
    const [health] = await db
      .select()
      .from(aiAgentHealth)
      .where(eq(aiAgentHealth.userId, userId))
      .limit(1);

    if (!health) {
      return {
        minConfidenceToWarn: 60, // Default threshold
        severityMultiplier: 1.0,
      };
    }

    const confidence = parseFloat(health.confidenceScore);
    const accuracy = health.totalExamples > 0 
      ? (health.positiveExamples / health.totalExamples) * 100 
      : 50;

    // If AI is highly accurate, lower threshold (show more warnings)
    // If AI is less accurate, raise threshold (show fewer, higher-confidence warnings)
    const minConfidenceToWarn = accuracy >= 70 ? 50 : accuracy >= 60 ? 60 : 70;
    
    // Severity multiplier: increase severity if user tends to ignore warnings
    const recentIgnored = await this.getRecentIgnoredCount(userId);
    const severityMultiplier = recentIgnored > 3 ? 1.2 : 1.0;

    return {
      minConfidenceToWarn,
      severityMultiplier,
      agentConfidence: confidence,
      readinessLevel: health.readinessLevel,
    };
  },

  /**
   * Get count of recently ignored warnings
   */
  async getRecentIgnoredCount(userId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const ignored = await db
      .select()
      .from(aiPersonalExamples)
      .where(
        and(
          eq(aiPersonalExamples.userId, userId),
          eq(aiPersonalExamples.userAction, 'ignored'),
          eq(aiPersonalExamples.contextType, 'risk_warning'),
          sql`${aiPersonalExamples.timestamp} > ${sevenDaysAgo}`
        )
      );

    return ignored.length;
  },
};
