import { db } from "../db";
import { featureFlags, type InsertFeatureFlag, type FeatureFlag } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class FeatureFlagsService {
  async isFeatureEnabled(featureKey: string, userId?: string): Promise<boolean> {
    const flag = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey))
      .limit(1);

    if (!flag[0]) return false;

    const feature = flag[0];
    
    if (!feature.enabled) return false;

    if (userId) {
      const allowedUsers = feature.allowedUserIds ? JSON.parse(feature.allowedUserIds) : [];
      const excludedUsers = feature.excludedUserIds ? JSON.parse(feature.excludedUserIds) : [];

      if (excludedUsers.includes(userId)) return false;
      if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) return false;
    }

    const rolloutPercentage = parseFloat(feature.rolloutPercentage || "0");
    if (rolloutPercentage < 100 && userId) {
      const userHash = this.hashUserId(userId);
      if (userHash > rolloutPercentage) return false;
    }

    const isDev = process.env.NODE_ENV !== 'production';
    return isDev ? feature.enabledInDev : feature.enabledInProduction;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags);
  }

  async createFlag(flag: InsertFeatureFlag): Promise<FeatureFlag> {
    const inserted = await db.insert(featureFlags).values(flag).returning();
    return inserted[0];
  }

  async updateFlag(featureKey: string, updates: Partial<InsertFeatureFlag>): Promise<FeatureFlag> {
    const updated = await db
      .update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.featureKey, featureKey))
      .returning();
    return updated[0];
  }

  async initializeDefaultFlags() {
    const defaults: InsertFeatureFlag[] = [
      {
        featureKey: 'ai_exit_advisor',
        featureName: 'AI Exit Advisor',
        description: 'AI-powered exit recommendations for open positions',
        enabled: true,
        rolloutPercentage: "100",
        enabledInDev: true,
        enabledInProduction: true,
      },
      {
        featureKey: 'ai_trade_assistant',
        featureName: 'AI Trade Assistant',
        description: 'Real-time AI advice within trade modal',
        enabled: true,
        rolloutPercentage: "100",
        enabledInDev: true,
        enabledInProduction: true,
      },
      {
        featureKey: 'risk_precheck',
        featureName: 'Pre-Trade Risk Validation',
        description: 'Comprehensive risk checks before trade execution',
        enabled: true,
        rolloutPercentage: "100",
        enabledInDev: true,
        enabledInProduction: false,
      },
      {
        featureKey: 'live_trading',
        featureName: 'Live Exchange Trading',
        description: 'Real trading with Binance integration',
        enabled: true,
        rolloutPercentage: "50",
        enabledInDev: true,
        enabledInProduction: false,
      },
      {
        featureKey: 'binance_oauth',
        featureName: 'Binance OAuth Login',
        description: 'Login with Binance OAuth (disabled for demo mode)',
        enabled: false,
        rolloutPercentage: "0",
        enabledInDev: false,
        enabledInProduction: false,
      },
    ];

    for (const flag of defaults) {
      const existing = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.featureKey, flag.featureKey))
        .limit(1);

      if (!existing[0]) {
        await db.insert(featureFlags).values(flag);
      }
    }
  }
}

export const featureFlagsService = new FeatureFlagsService();
