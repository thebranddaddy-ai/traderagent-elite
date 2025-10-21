import { TelemetryService } from "./telemetryService";
import { calculateTradingDNA, type TradingDNAMetrics } from "./tradingDNA";
import { storage } from "../storage";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { focusSessions, layoutTelemetry } from "@shared/schema";

export interface BehaviorPattern {
  moduleUsage: {
    mostUsed: Array<{ moduleId: string; count: number; lastUsed: Date }>;
    leastUsed: Array<{ moduleId: string; count: number; lastUsed: Date }>;
    neverUsed: string[];
  };
  sessionPatterns: {
    avgSessionDuration: number; // in minutes
    totalSessions: number;
    longestSession: number;
    preferredTimeOfDay: "morning" | "afternoon" | "evening" | "night";
    focusModeUsage: number; // percentage of time in focus mode
  };
  customizationBehavior: {
    modeSwitchFrequency: number; // times per week
    layoutSaveFrequency: number; // times per week
    customizationActivity: "high" | "moderate" | "low";
    preferredMode: "simple" | "power" | "mixed";
  };
  chartPreferences?: {
    preferredTimeframe?: string;
    preferredChartType?: string;
    indicatorsUsed?: string[];
  };
}

export interface TradingDNAProfile {
  classification: "Aggressive" | "Balanced" | "Defensive";
  confidence: number; // 0-100
  characteristics: string[];
  tradingMetrics: TradingDNAMetrics;
  behaviorPatterns: BehaviorPattern;
}

export class BehaviorMappingService {
  /**
   * Analyze user behavior patterns from telemetry data
   */
  static async analyzeBehaviorPatterns(userId: string, days = 30): Promise<BehaviorPattern> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get telemetry analytics
    const telemetryAnalytics = await TelemetryService.getUserAnalytics(userId, days);
    const allEvents = await TelemetryService.getEventsByTimeRange(userId, startDate, 1000);

    // Analyze module usage
    const moduleAddEvents = allEvents.filter((e) => e.eventType === "module_add");
    const moduleRemoveEvents = allEvents.filter((e) => e.eventType === "module_remove");

    // Calculate module usage frequency
    const moduleUsageMap = new Map<string, { count: number; lastUsed: Date }>();
    
    moduleAddEvents.forEach((event) => {
      if (event.moduleId) {
        const existing = moduleUsageMap.get(event.moduleId);
        moduleUsageMap.set(event.moduleId, {
          count: (existing?.count || 0) + 1,
          lastUsed: new Date(event.timestamp),
        });
      }
    });

    const mostUsed = Array.from(moduleUsageMap.entries())
      .map(([moduleId, data]) => ({ moduleId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const leastUsed = Array.from(moduleUsageMap.entries())
      .map(([moduleId, data]) => ({ moduleId, ...data }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 5);

    // Determine never-used modules (basic set - can be enhanced)
    const allModuleIds = [
      "ai-briefing",
      "trading-dna",
      "risk-guard",
      "peace-index",
      "portfolio-overview",
      "recent-trades",
      "open-positions",
      "watchlist",
      "price-alerts",
      "trading-chart",
      "ai-suggestions",
      "ai-exit-advisor",
      "ai-trade-journal",
      "scenario-simulator",
      "timeframe-analysis",
      "focus-mode",
    ];
    
    const usedModuleIds = new Set(moduleUsageMap.keys());
    const neverUsed = allModuleIds.filter((id) => !usedModuleIds.has(id));

    // Analyze session patterns
    const focusSessionsData = await db
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startTime, startDate)
        )
      )
      .orderBy(desc(focusSessions.startTime));

    const totalFocusDuration = focusSessionsData.reduce(
      (sum, session) => sum + (session.duration || 0),
      0
    );

    const longestSession = focusSessionsData.reduce(
      (max, session) => Math.max(max, session.duration || 0),
      0
    );

    // Estimate total session time (focus + regular)
    const avgSessionDuration = focusSessionsData.length > 0
      ? totalFocusDuration / focusSessionsData.length
      : 30; // Default 30 minutes

    // Calculate preferred time of day from all events
    const timeOfDayCounts = {
      morning: 0,   // 6am-12pm
      afternoon: 0, // 12pm-6pm
      evening: 0,   // 6pm-12am
      night: 0,     // 12am-6am
    };

    allEvents.forEach((event) => {
      const hour = new Date(event.timestamp).getHours();
      if (hour >= 6 && hour < 12) timeOfDayCounts.morning++;
      else if (hour >= 12 && hour < 18) timeOfDayCounts.afternoon++;
      else if (hour >= 18 && hour < 24) timeOfDayCounts.evening++;
      else timeOfDayCounts.night++;
    });

    const preferredTimeOfDay = (Object.entries(timeOfDayCounts).reduce((a, b) =>
      timeOfDayCounts[a[0] as keyof typeof timeOfDayCounts] > 
      timeOfDayCounts[b[0] as keyof typeof timeOfDayCounts] ? a : b
    )[0] as "morning" | "afternoon" | "evening" | "night");

    // Calculate focus mode usage percentage
    const totalSessionTime = avgSessionDuration * (allEvents.length > 0 ? allEvents.length / 10 : 1);
    const focusModeUsage = totalSessionTime > 0
      ? (totalFocusDuration / totalSessionTime) * 100
      : 0;

    // Analyze customization behavior
    const modeSwitchEvents = allEvents.filter((e) => e.eventType === "mode_switch");
    const layoutSaveEvents = allEvents.filter((e) => e.eventType === "layout_save");

    const modeSwitchFrequency = (modeSwitchEvents.length / days) * 7; // per week
    const layoutSaveFrequency = (layoutSaveEvents.length / days) * 7; // per week

    // Determine customization activity level
    const totalCustomizationEvents = 
      telemetryAnalytics.moduleAdds + 
      telemetryAnalytics.moduleRemoves + 
      modeSwitchEvents.length;

    let customizationActivity: "high" | "moderate" | "low";
    if (totalCustomizationEvents > 50) customizationActivity = "high";
    else if (totalCustomizationEvents > 20) customizationActivity = "moderate";
    else customizationActivity = "low";

    // Determine preferred mode from metadata
    const modePreferences = { simple: 0, power: 0 };
    modeSwitchEvents.forEach((event) => {
      const metadata = event.metadata as Record<string, any> | null;
      const mode = metadata?.mode || metadata?.to;
      if (mode === "simple") modePreferences.simple++;
      else if (mode === "power") modePreferences.power++;
    });

    let preferredMode: "simple" | "power" | "mixed";
    if (modePreferences.simple > modePreferences.power * 1.5) {
      preferredMode = "simple";
    } else if (modePreferences.power > modePreferences.simple * 1.5) {
      preferredMode = "power";
    } else {
      preferredMode = "mixed";
    }

    // Extract chart preferences from metadata (if available)
    const chartEvents = allEvents.filter((e) => {
      const metadata = e.metadata as Record<string, any> | null;
      return metadata?.chartType || metadata?.timeframe || metadata?.indicators;
    });

    let chartPreferences: BehaviorPattern["chartPreferences"];
    if (chartEvents.length > 0) {
      const chartTypes: Record<string, number> = {};
      const timeframes: Record<string, number> = {};
      const indicators = new Set<string>();

      chartEvents.forEach((event) => {
        const metadata = event.metadata as Record<string, any> | null;
        if (metadata?.chartType) {
          chartTypes[metadata.chartType] = (chartTypes[metadata.chartType] || 0) + 1;
        }
        if (metadata?.timeframe) {
          timeframes[metadata.timeframe] = (timeframes[metadata.timeframe] || 0) + 1;
        }
        if (metadata?.indicators && Array.isArray(metadata.indicators)) {
          metadata.indicators.forEach((ind: string) => indicators.add(ind));
        }
      });

      chartPreferences = {
        preferredChartType: Object.keys(chartTypes).length > 0
          ? Object.entries(chartTypes).sort((a, b) => b[1] - a[1])[0][0]
          : undefined,
        preferredTimeframe: Object.keys(timeframes).length > 0
          ? Object.entries(timeframes).sort((a, b) => b[1] - a[1])[0][0]
          : undefined,
        indicatorsUsed: indicators.size > 0 ? Array.from(indicators) : undefined,
      };
    }

    return {
      moduleUsage: {
        mostUsed,
        leastUsed,
        neverUsed,
      },
      sessionPatterns: {
        avgSessionDuration,
        totalSessions: focusSessionsData.length + Math.floor(allEvents.length / 10),
        longestSession,
        preferredTimeOfDay,
        focusModeUsage: Math.min(focusModeUsage, 100),
      },
      customizationBehavior: {
        modeSwitchFrequency,
        layoutSaveFrequency,
        customizationActivity,
        preferredMode,
      },
      chartPreferences,
    };
  }

  /**
   * Generate complete Trading DNA profile with behavior patterns
   */
  static async generateTradingDNAProfile(userId: string): Promise<TradingDNAProfile> {
    // Get trading metrics from existing Trading DNA service
    const tradingMetrics = await calculateTradingDNA(userId);

    // Get behavior patterns from telemetry
    const behaviorPatterns = await this.analyzeBehaviorPatterns(userId);

    // Classify user based on combined analysis
    const classification = this.classifyTrader(tradingMetrics, behaviorPatterns);

    // Generate characteristics description
    const characteristics = this.generateCharacteristics(
      classification,
      tradingMetrics,
      behaviorPatterns
    );

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(tradingMetrics, behaviorPatterns);

    return {
      classification,
      confidence,
      characteristics,
      tradingMetrics,
      behaviorPatterns,
    };
  }

  /**
   * Classify trader into Aggressive/Balanced/Defensive
   */
  private static classifyTrader(
    metrics: TradingDNAMetrics,
    behavior: BehaviorPattern
  ): "Aggressive" | "Balanced" | "Defensive" {
    // Score various factors
    let aggressiveScore = 0;
    let defensiveScore = 0;

    // Trading metrics analysis
    if (metrics.riskScore > 60) aggressiveScore += 3;
    else if (metrics.riskScore < 40) defensiveScore += 3;

    if (metrics.averageTradeSize > 2000) aggressiveScore += 2;
    else if (metrics.averageTradeSize < 1000) defensiveScore += 2;

    if (metrics.revengeTradeScore > 50) aggressiveScore += 2;
    else if (metrics.revengeTradeScore < 20) defensiveScore += 1;

    // Behavior patterns analysis
    if (behavior.customizationBehavior.customizationActivity === "high") {
      aggressiveScore += 1;
    } else if (behavior.customizationBehavior.customizationActivity === "low") {
      defensiveScore += 1;
    }

    if (behavior.customizationBehavior.preferredMode === "power") {
      aggressiveScore += 1;
    } else if (behavior.customizationBehavior.preferredMode === "simple") {
      defensiveScore += 1;
    }

    if (behavior.sessionPatterns.focusModeUsage > 50) {
      defensiveScore += 2; // High focus mode usage = more defensive
    } else if (behavior.sessionPatterns.focusModeUsage < 20) {
      aggressiveScore += 1;
    }

    // Module usage patterns
    const analyticsModulesUsed = behavior.moduleUsage.mostUsed.filter((m) =>
      ["trading-dna", "scenario-simulator", "timeframe-analysis"].includes(m.moduleId)
    ).length;

    if (analyticsModulesUsed >= 2) defensiveScore += 1;

    // Final classification
    if (aggressiveScore > defensiveScore + 2) return "Aggressive";
    if (defensiveScore > aggressiveScore + 2) return "Defensive";
    return "Balanced";
  }

  /**
   * Generate human-readable characteristics
   */
  private static generateCharacteristics(
    classification: "Aggressive" | "Balanced" | "Defensive",
    metrics: TradingDNAMetrics,
    behavior: BehaviorPattern
  ): string[] {
    const characteristics: string[] = [];

    // Add classification-based characteristics
    if (classification === "Aggressive") {
      characteristics.push("High-frequency trader with bold position sizing");
      characteristics.push("Comfortable with elevated risk levels");
    } else if (classification === "Defensive") {
      characteristics.push("Conservative trader with careful risk management");
      characteristics.push("Prioritizes capital preservation");
    } else {
      characteristics.push("Balanced approach to risk and reward");
      characteristics.push("Adaptive strategy based on market conditions");
    }

    // Add behavior-specific characteristics
    if (behavior.sessionPatterns.focusModeUsage > 50) {
      characteristics.push("Highly focused trader who values concentration");
    }

    if (behavior.customizationBehavior.preferredMode === "power") {
      characteristics.push("Power user who leverages advanced features");
    } else if (behavior.customizationBehavior.preferredMode === "simple") {
      characteristics.push("Prefers streamlined, distraction-free interface");
    }

    // Add time-based characteristics
    if (behavior.sessionPatterns.preferredTimeOfDay === "morning") {
      characteristics.push("Early bird - most active during morning sessions");
    } else if (behavior.sessionPatterns.preferredTimeOfDay === "evening") {
      characteristics.push("Evening trader - active during night sessions");
    }

    // Add performance characteristics
    if (metrics.winRate > 60) {
      characteristics.push("Consistent winner with strong win rate");
    } else if (metrics.winRate < 40) {
      characteristics.push("Room for improvement in trade selection");
    }

    return characteristics.slice(0, 5); // Return top 5 characteristics
  }

  /**
   * Calculate confidence score based on data availability
   */
  private static calculateConfidence(
    metrics: TradingDNAMetrics,
    behavior: BehaviorPattern
  ): number {
    let confidence = 0;

    // Trading data confidence (max 60 points)
    if (metrics.totalTrades >= 50) confidence += 30;
    else if (metrics.totalTrades >= 20) confidence += 20;
    else if (metrics.totalTrades >= 10) confidence += 10;

    if (metrics.totalTrades > 0) confidence += 30; // Base confidence for any trades

    // Behavior data confidence (max 40 points)
    const totalEvents = 
      behavior.moduleUsage.mostUsed.reduce((sum, m) => sum + m.count, 0) +
      behavior.sessionPatterns.totalSessions;

    if (totalEvents >= 100) confidence += 20;
    else if (totalEvents >= 50) confidence += 15;
    else if (totalEvents >= 20) confidence += 10;
    else if (totalEvents >= 10) confidence += 5;

    if (behavior.sessionPatterns.totalSessions >= 10) confidence += 20;
    else if (behavior.sessionPatterns.totalSessions >= 5) confidence += 10;

    return Math.min(confidence, 100);
  }
}
