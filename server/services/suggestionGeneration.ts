import { db } from "../db";
import { adaptiveSuggestions, InsertAdaptiveSuggestion } from "@shared/schema";
import { BehaviorMappingService, type BehaviorPattern, type TradingDNAProfile } from "./behaviorMapping";
import { eq, and, desc, sql } from "drizzle-orm";

export interface GeneratedSuggestion {
  title: string;
  message: string;
  reasoning: string;
  actionType: "add_module" | "remove_module" | "switch_mode" | "enable_feature" | "adjust_setting";
  actionData: Record<string, any>;
  confidence: number;
  priority: "high" | "medium" | "low";
  suggestionType: "module_preference" | "layout_optimization" | "workflow_improvement" | "feature_recommendation";
  basedOnPattern: string;
  dataPoints: number;
}

export class SuggestionGenerationService {
  /**
   * Generate personalized suggestions based on user's Trading DNA and behavior patterns
   */
  static async generateSuggestions(userId: string): Promise<GeneratedSuggestion[]> {
    // Get comprehensive profile
    const profile = await BehaviorMappingService.generateTradingDNAProfile(userId);
    
    const suggestions: GeneratedSuggestion[] = [];

    // Generate module usage suggestions
    suggestions.push(...this.generateModuleUsageSuggestions(profile));

    // Generate workflow optimization suggestions
    suggestions.push(...this.generateWorkflowSuggestions(profile));

    // Generate mode preference suggestions
    suggestions.push(...this.generateModeSuggestions(profile));

    // Generate focus mode suggestions
    suggestions.push(...this.generateFocusModeSuggestions(profile));

    // Generate chart preference suggestions (if data available)
    if (profile.behaviorPatterns.chartPreferences) {
      suggestions.push(...this.generateChartSuggestions(profile));
    }

    // Filter and prioritize suggestions
    return this.prioritizeSuggestions(suggestions, profile);
  }

  /**
   * Generate module usage suggestions based on patterns
   */
  private static generateModuleUsageSuggestions(profile: TradingDNAProfile): GeneratedSuggestion[] {
    const suggestions: GeneratedSuggestion[] = [];
    const { moduleUsage } = profile.behaviorPatterns;

    // Suggest adding never-used but relevant modules
    if (moduleUsage.neverUsed.length > 0) {
      const relevantModules = this.getRelevantModulesForProfile(profile);
      
      relevantModules.forEach((moduleId) => {
        if (moduleUsage.neverUsed.includes(moduleId)) {
          const moduleInfo = this.getModuleInfo(moduleId);
          suggestions.push({
            title: `Try ${moduleInfo.name}`,
            message: `Based on your ${profile.classification.toLowerCase()} trading style, ${moduleInfo.name} could enhance your workflow.`,
            reasoning: `Your trading DNA shows ${this.getDNACharacteristic(profile)} - ${moduleInfo.name} is designed for traders with this approach.`,
            actionType: "add_module",
            actionData: { moduleId },
            confidence: this.calculateModuleRelevanceConfidence(profile, moduleId),
            priority: this.getModulePriority(profile, moduleId),
            suggestionType: "module_preference",
            basedOnPattern: "unused_relevant_module",
            dataPoints: profile.tradingMetrics.totalTrades + moduleUsage.mostUsed.length,
          });
        }
      });
    }

    // Suggest removing rarely used modules
    const leastUsedThreshold = 2;
    moduleUsage.leastUsed.forEach((module) => {
      if (module.count <= leastUsedThreshold && !this.isEssentialModule(module.moduleId)) {
        const daysSinceUse = Math.floor((Date.now() - module.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceUse > 14) {
          suggestions.push({
            title: "Simplify your dashboard",
            message: `You haven't used ${this.getModuleInfo(module.moduleId).name} in ${daysSinceUse} days. Consider removing it for a cleaner view.`,
            reasoning: `Keeping only actively used modules reduces visual clutter and helps you focus on what matters.`,
            actionType: "remove_module",
            actionData: { moduleId: module.moduleId },
            confidence: 70,
            priority: "low",
            suggestionType: "layout_optimization",
            basedOnPattern: "rarely_used_module",
            dataPoints: module.count,
          });
        }
      }
    });

    return suggestions;
  }

  /**
   * Generate workflow optimization suggestions
   */
  private static generateWorkflowSuggestions(profile: TradingDNAProfile): GeneratedSuggestion[] {
    const suggestions: GeneratedSuggestion[] = [];
    const { customizationBehavior, moduleUsage } = profile.behaviorPatterns;

    // High customization activity - suggest pinning favorite layout
    if (customizationBehavior.customizationActivity === "high") {
      suggestions.push({
        title: "Save your perfect setup",
        message: "You customize frequently - consider saving your current layout as a preset for quick switching.",
        reasoning: "With your high customization activity, having saved presets saves time and ensures consistency.",
        actionType: "enable_feature",
        actionData: { feature: "layout_presets" },
        confidence: 85,
        priority: "medium",
        suggestionType: "workflow_improvement",
        basedOnPattern: "high_customization_activity",
        dataPoints: Math.floor(customizationBehavior.layoutSaveFrequency * 4),
      });
    }

    // Suggest module grouping for frequently used modules
    if (moduleUsage.mostUsed.length >= 3) {
      const analyticsModules = moduleUsage.mostUsed.filter((m) =>
        ["trading-dna", "scenario-simulator", "timeframe-analysis"].includes(m.moduleId)
      );

      if (analyticsModules.length >= 2) {
        suggestions.push({
          title: "Analytics-focused workflow",
          message: "You frequently use analytics tools - they work great together in Power Mode.",
          reasoning: "Combining analytical modules gives you a comprehensive view of your performance metrics.",
          actionType: "switch_mode",
          actionData: { mode: "power", highlightModules: analyticsModules.map((m) => m.moduleId) },
          confidence: 80,
          priority: "medium",
          suggestionType: "workflow_improvement",
          basedOnPattern: "analytics_focus",
          dataPoints: analyticsModules.reduce((sum, m) => sum + m.count, 0),
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate mode preference suggestions
   */
  private static generateModeSuggestions(profile: TradingDNAProfile): GeneratedSuggestion[] {
    const suggestions: GeneratedSuggestion[] = [];
    const { customizationBehavior } = profile.behaviorPatterns;

    // Suggest mode based on usage patterns
    if (customizationBehavior.preferredMode === "mixed" && customizationBehavior.modeSwitchFrequency > 3) {
      const recommendedMode = profile.classification === "Defensive" ? "simple" : "power";
      
      suggestions.push({
        title: `${recommendedMode === "simple" ? "Simple" : "Power"} Mode might suit you`,
        message: `You switch modes often. Based on your ${profile.classification.toLowerCase()} style, ${recommendedMode === "simple" ? "Simple Mode" : "Power Mode"} could be your go-to.`,
        reasoning: `${profile.classification} traders often prefer ${recommendedMode === "simple" ? "focused, distraction-free" : "comprehensive, data-rich"} interfaces.`,
        actionType: "switch_mode",
        actionData: { mode: recommendedMode },
        confidence: 75,
        priority: "medium",
        suggestionType: "layout_optimization",
        basedOnPattern: "mode_switching_pattern",
        dataPoints: Math.floor(customizationBehavior.modeSwitchFrequency * 4),
      });
    }

    return suggestions;
  }

  /**
   * Generate focus mode suggestions
   */
  private static generateFocusModeSuggestions(profile: TradingDNAProfile): GeneratedSuggestion[] {
    const suggestions: GeneratedSuggestion[] = [];
    const { sessionPatterns } = profile.behaviorPatterns;

    // Long sessions without focus mode - suggest trying it
    if (sessionPatterns.avgSessionDuration > 60 && sessionPatterns.focusModeUsage < 20) {
      suggestions.push({
        title: "Try Focus Mode for long sessions",
        message: `Your sessions average ${Math.round(sessionPatterns.avgSessionDuration)} minutes. Focus Mode can help maintain concentration.`,
        reasoning: "Extended trading sessions benefit from distraction-free Focus Mode - it helps prevent impulsive decisions.",
        actionType: "enable_feature",
        actionData: { feature: "focus_mode", autoTrigger: sessionPatterns.avgSessionDuration },
        confidence: 85,
        priority: "high",
        suggestionType: "feature_recommendation",
        basedOnPattern: "long_sessions_no_focus",
        dataPoints: sessionPatterns.totalSessions,
      });
    }

    // High focus mode usage - acknowledge good habit
    if (sessionPatterns.focusModeUsage > 60) {
      suggestions.push({
        title: "Your focus discipline is excellent",
        message: `You use Focus Mode ${Math.round(sessionPatterns.focusModeUsage)}% of the time - this disciplined approach supports better decisions.`,
        reasoning: "High focus mode usage correlates with reduced emotional trading and improved consistency.",
        actionType: "adjust_setting",
        actionData: { setting: "focus_mode_default", value: true },
        confidence: 90,
        priority: "low",
        suggestionType: "workflow_improvement",
        basedOnPattern: "high_focus_usage",
        dataPoints: sessionPatterns.totalSessions,
      });
    }

    return suggestions;
  }

  /**
   * Generate chart preference suggestions
   */
  private static generateChartSuggestions(profile: TradingDNAProfile): GeneratedSuggestion[] {
    const suggestions: GeneratedSuggestion[] = [];
    const { chartPreferences } = profile.behaviorPatterns;

    if (!chartPreferences) return suggestions;

    // Suggest making preferred settings default
    if (chartPreferences.preferredTimeframe && chartPreferences.indicatorsUsed && chartPreferences.indicatorsUsed.length >= 2) {
      suggestions.push({
        title: "Set your chart preferences as default",
        message: `You often use ${chartPreferences.preferredTimeframe} with ${chartPreferences.indicatorsUsed.join(" + ")}. Make this your default?`,
        reasoning: "Setting your frequently used chart configuration as default saves time and ensures consistency.",
        actionType: "adjust_setting",
        actionData: {
          setting: "chart_defaults",
          timeframe: chartPreferences.preferredTimeframe,
          indicators: chartPreferences.indicatorsUsed,
          chartType: chartPreferences.preferredChartType,
        },
        confidence: 85,
        priority: "medium",
        suggestionType: "workflow_improvement",
        basedOnPattern: "chart_preference_pattern",
        dataPoints: 20, // Estimate from chart events
      });
    }

    return suggestions;
  }

  /**
   * Prioritize and filter suggestions
   */
  private static prioritizeSuggestions(
    suggestions: GeneratedSuggestion[],
    profile: TradingDNAProfile
  ): GeneratedSuggestion[] {
    // Filter low confidence suggestions if we have enough data
    const minConfidence = profile.confidence > 70 ? 65 : 50;
    const filtered = suggestions.filter((s) => s.confidence >= minConfidence);

    // Sort by priority and confidence
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    // Return top 5 suggestions
    return filtered.slice(0, 5);
  }

  /**
   * Save suggestions to database
   */
  static async saveSuggestions(userId: string, suggestions: GeneratedSuggestion[]): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire after 7 days

    for (const suggestion of suggestions) {
      await db.insert(adaptiveSuggestions).values({
        userId,
        suggestionType: suggestion.suggestionType,
        title: suggestion.title,
        message: suggestion.message,
        reasoning: suggestion.reasoning,
        actionType: suggestion.actionType,
        actionData: suggestion.actionData,
        confidence: suggestion.confidence.toString(),
        priority: suggestion.priority,
        basedOnPattern: suggestion.basedOnPattern,
        dataPoints: suggestion.dataPoints,
        expiresAt,
      });
    }
  }

  /**
   * Get active suggestions for user
   */
  static async getActiveSuggestions(userId: string) {
    return await db
      .select()
      .from(adaptiveSuggestions)
      .where(
        and(
          eq(adaptiveSuggestions.userId, userId),
          eq(adaptiveSuggestions.status, "active")
        )
      )
      .orderBy(desc(adaptiveSuggestions.createdAt));
  }

  // Helper methods
  private static getRelevantModulesForProfile(profile: TradingDNAProfile): string[] {
    const { classification } = profile;
    
    if (classification === "Aggressive") {
      return ["trading-chart", "ai-suggestions", "scenario-simulator", "open-positions"];
    } else if (classification === "Defensive") {
      return ["risk-guard", "ai-exit-advisor", "peace-index", "ai-trade-journal"];
    } else {
      return ["trading-dna", "scenario-simulator", "ai-suggestions", "timeframe-analysis"];
    }
  }

  private static getModuleInfo(moduleId: string): { name: string; description: string } {
    const moduleMap: Record<string, { name: string; description: string }> = {
      "ai-briefing": { name: "AI Briefing", description: "Daily market insights" },
      "trading-dna": { name: "Trading DNA", description: "Performance analytics" },
      "risk-guard": { name: "Risk Guard", description: "Risk management" },
      "peace-index": { name: "Peace Index", description: "Stress monitoring" },
      "portfolio-overview": { name: "Portfolio Overview", description: "Holdings summary" },
      "recent-trades": { name: "Recent Trades", description: "Trade history" },
      "open-positions": { name: "Open Positions", description: "Active trades" },
      "watchlist": { name: "Watchlist", description: "Tracked assets" },
      "price-alerts": { name: "Price Alerts", description: "Alert notifications" },
      "trading-chart": { name: "Trading Chart", description: "Price charts" },
      "ai-suggestions": { name: "AI Suggestions", description: "Trade ideas" },
      "ai-exit-advisor": { name: "AI Exit Advisor", description: "Exit guidance" },
      "ai-trade-journal": { name: "AI Trade Journal", description: "Performance insights" },
      "scenario-simulator": { name: "Scenario Simulator", description: "What-if analysis" },
      "timeframe-analysis": { name: "Timeframe Analysis", description: "Period performance" },
      "focus-mode": { name: "Focus Mode", description: "Distraction-free trading" },
    };

    return moduleMap[moduleId] || { name: moduleId, description: "" };
  }

  private static getDNACharacteristic(profile: TradingDNAProfile): string {
    if (profile.characteristics.length > 0) {
      return profile.characteristics[0].toLowerCase();
    }
    return `a ${profile.classification.toLowerCase()} approach`;
  }

  private static calculateModuleRelevanceConfidence(profile: TradingDNAProfile, moduleId: string): number {
    let confidence = 60; // Base confidence

    // Increase confidence based on data availability
    if (profile.confidence > 80) confidence += 15;
    else if (profile.confidence > 60) confidence += 10;

    // Increase for specific patterns
    if (profile.classification === "Aggressive" && moduleId === "scenario-simulator") confidence += 10;
    if (profile.classification === "Defensive" && moduleId === "risk-guard") confidence += 15;

    return Math.min(confidence, 95);
  }

  private static getModulePriority(profile: TradingDNAProfile, moduleId: string): "high" | "medium" | "low" {
    const essentialModules = ["risk-guard", "peace-index"];
    const improvementModules = ["ai-trade-journal", "scenario-simulator"];

    if (essentialModules.includes(moduleId)) return "high";
    if (improvementModules.includes(moduleId)) return "medium";
    return "low";
  }

  private static isEssentialModule(moduleId: string): boolean {
    const essential = ["portfolio-overview", "recent-trades", "trading-chart"];
    return essential.includes(moduleId);
  }
}
