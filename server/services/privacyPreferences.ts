import { db } from "../db";
import { privacyPreferences, type InsertPrivacyPreferences, type PrivacyPreferences } from "@shared/schema";
import { eq } from "drizzle-orm";

export class PrivacyPreferencesService {
  async getPreferences(userId: string): Promise<PrivacyPreferences | null> {
    const result = await db
      .select()
      .from(privacyPreferences)
      .where(eq(privacyPreferences.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  async getOrCreatePreferences(userId: string): Promise<PrivacyPreferences> {
    let prefs = await this.getPreferences(userId);
    
    if (!prefs) {
      const defaults: InsertPrivacyPreferences = {
        userId,
        shareTradeHistory: false,
        sharePerformanceMetrics: false,
        shareAIInteractions: false,
        enableAISuggestions: true,
        enableAIExitAdvisor: true,
        enableAITradeAssistant: true,
        enableDailyInsights: true,
        enableAnalytics: true,
        enablePersonalization: true,
        viewAuditLogs: true,
      };

      const inserted = await db
        .insert(privacyPreferences)
        .values(defaults)
        .returning();
      
      prefs = inserted[0];
    }

    return prefs;
  }

  async updatePreferences(
    userId: string,
    updates: Partial<InsertPrivacyPreferences>
  ): Promise<PrivacyPreferences> {
    await this.getOrCreatePreferences(userId);

    // Filter to only include valid preference fields (exclude metadata fields)
    const validFields: Partial<InsertPrivacyPreferences> = {};
    const allowedKeys: (keyof InsertPrivacyPreferences)[] = [
      'shareTradeHistory',
      'sharePerformanceMetrics',
      'shareAIInteractions',
      'enableAISuggestions',
      'enableAIExitAdvisor',
      'enableAITradeAssistant',
      'enableDailyInsights',
      'enableAnalytics',
      'enablePersonalization',
      'viewAuditLogs',
    ];

    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        (validFields as any)[key] = updates[key];
      }
    }

    const updated = await db
      .update(privacyPreferences)
      .set({
        ...validFields,
        updatedAt: new Date(),
      })
      .where(eq(privacyPreferences.userId, userId))
      .returning();

    return updated[0];
  }

  async checkFeatureEnabled(userId: string, feature: keyof PrivacyPreferences): Promise<boolean> {
    const prefs = await this.getOrCreatePreferences(userId);
    return Boolean(prefs[feature]);
  }
}

export const privacyPreferencesService = new PrivacyPreferencesService();
