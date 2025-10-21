import { db } from "../db";
import { aiAuditLogs, type InsertAIAuditLog, type AIAuditLog } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export class AIAuditLoggerService {
  async logAIInteraction(data: {
    userId: string;
    featureType: string;
    modelVersion: string;
    inputData: any;
    outputData: any;
    explanation: string;
    confidence?: number;
  }): Promise<AIAuditLog> {
    const promptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.inputData))
      .digest('hex');

    const logData: InsertAIAuditLog = {
      userId: data.userId,
      featureType: data.featureType,
      modelVersion: data.modelVersion,
      promptHash,
      inputData: JSON.stringify(data.inputData),
      outputData: JSON.stringify(data.outputData),
      explanation: data.explanation,
      confidence: data.confidence?.toString(),
    };

    const inserted = await db.insert(aiAuditLogs).values(logData).returning();
    return inserted[0];
  }

  async getUserLogs(userId: string, limit: number = 50): Promise<AIAuditLog[]> {
    return await db
      .select()
      .from(aiAuditLogs)
      .where(eq(aiAuditLogs.userId, userId))
      .orderBy(desc(aiAuditLogs.timestamp))
      .limit(limit);
  }

  async getLogsByFeature(userId: string, featureType: string, limit: number = 20): Promise<AIAuditLog[]> {
    return await db
      .select()
      .from(aiAuditLogs)
      .where(eq(aiAuditLogs.userId, userId))
      .where(eq(aiAuditLogs.featureType, featureType))
      .orderBy(desc(aiAuditLogs.timestamp))
      .limit(limit);
  }

  async updateOutcome(logId: string, outcome: string): Promise<void> {
    await db
      .update(aiAuditLogs)
      .set({ outcome })
      .where(eq(aiAuditLogs.id, logId));
  }
}

export const aiAuditLogger = new AIAuditLoggerService();
