import { db } from "../db";
import { aiAuditLogs } from "../../shared/schema";
import { desc, eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * AI Audit Service
 * 
 * North Star Mission: Transparency & Accountability
 * Purpose: Log every AI decision for full explainability and auditability
 * 
 * Usage: Call logAIDecision() after every AI feature execution
 */

interface LogAIDecisionParams {
  userId: string;
  featureType: 'suggestion' | 'risk_check' | 'prediction' | 'optimization' | 'coaching' | 'correlation' | 'volatility' | 'position_sizing' | 'briefing' | 'news' | 'pattern';
  modelVersion: string;
  prompt?: string; // Optional: the full prompt sent to AI
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  explanation: string;
  confidence?: number; // 0-100
  outcome?: string; // Actual result for learning loop
}

/**
 * Log an AI decision to the audit trail
 * 
 * Supports North Star goals:
 * - Understand the User: Track AI analysis of user behavior
 * - Teach the User: Store explanations for transparency
 * - Evolve the Intelligence: Capture outcomes for learning loop
 */
export async function logAIDecision(params: LogAIDecisionParams) {
  try {
    const {
      userId,
      featureType,
      modelVersion,
      prompt,
      inputData,
      outputData,
      explanation,
      confidence,
      outcome,
    } = params;

    // Generate hash of prompt for auditability (if prompt provided)
    const promptHash = prompt 
      ? crypto.createHash('sha256').update(prompt).digest('hex')
      : null;

    // Validate confidence score
    const validatedConfidence = confidence !== undefined && Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, confidence))
      : null;

    await db.insert(aiAuditLogs).values({
      userId,
      featureType,
      modelVersion,
      promptHash,
      inputData: JSON.stringify(inputData),
      outputData: JSON.stringify(outputData),
      explanation,
      confidence: validatedConfidence?.toString(),
      outcome,
    });

    console.log(`[AI Audit] Logged ${featureType} decision for user ${userId}`);
  } catch (error) {
    console.error('[AI Audit] Error logging AI decision:', error);
    // Don't throw - audit logging should never break the main flow
  }
}

/**
 * Get audit trail for a user
 * 
 * Returns last N AI decisions with full explainability data
 * Supports North Star: "Never hide AI logic"
 */
export async function getUserAuditTrail(userId: string, limit: number = 50) {
  try {
    const logs = await db.query.aiAuditLogs.findMany({
      where: eq(aiAuditLogs.userId, userId),
      orderBy: [desc(aiAuditLogs.timestamp)],
      limit,
    });

    return logs.map(log => ({
      id: log.id,
      featureType: log.featureType,
      modelVersion: log.modelVersion,
      promptHash: log.promptHash,
      inputData: JSON.parse(log.inputData || '{}'),
      outputData: JSON.parse(log.outputData || '{}'),
      explanation: log.explanation,
      confidence: log.confidence ? parseFloat(log.confidence) : null,
      outcome: log.outcome,
      timestamp: log.timestamp,
    }));
  } catch (error) {
    console.error('[AI Audit] Error fetching audit trail:', error);
    throw new Error('Failed to fetch audit trail');
  }
}

/**
 * Get audit logs by feature type
 * 
 * Useful for analyzing specific AI feature performance
 * SECURITY: Only returns logs for the requesting user
 */
export async function getAuditLogsByFeature(
  userId: string, 
  featureType: string, 
  limit: number = 20
) {
  try {
    const logs = await db.query.aiAuditLogs.findMany({
      where: and(
        eq(aiAuditLogs.userId, userId),
        eq(aiAuditLogs.featureType, featureType)
      ),
      orderBy: [desc(aiAuditLogs.timestamp)],
      limit,
    });

    return logs.map(log => ({
      id: log.id,
      userId: log.userId,
      modelVersion: log.modelVersion,
      explanation: log.explanation,
      confidence: log.confidence ? parseFloat(log.confidence) : null,
      outcome: log.outcome,
      timestamp: log.timestamp,
    }));
  } catch (error) {
    console.error('[AI Audit] Error fetching feature logs:', error);
    throw new Error('Failed to fetch feature audit logs');
  }
}

/**
 * Update audit log with actual outcome
 * 
 * Called after trade completes to enable learning loop
 * Supports North Star: "Evolve the Intelligence"
 */
export async function updateAuditOutcome(logId: string, outcome: string) {
  try {
    await db.update(aiAuditLogs)
      .set({ outcome })
      .where(eq(aiAuditLogs.id, logId));

    console.log(`[AI Audit] Updated outcome for log ${logId}`);
  } catch (error) {
    console.error('[AI Audit] Error updating outcome:', error);
    // Don't throw - outcome updates are supplementary
  }
}
