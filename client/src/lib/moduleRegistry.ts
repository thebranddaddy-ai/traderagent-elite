/**
 * Phase 2: Dashboard Module Registry
 * Central source of truth for all available dashboard modules
 */

export interface DashboardModule {
  id: string;
  name: string;
  description: string;
  category: "core" | "trading" | "ai" | "analytics" | "tools";
  icon: string; // lucide-react icon name
  component: string; // Component name for dynamic rendering
  defaultVisible: boolean;
  powerModeOnly: boolean; // Only visible in Power Mode
  order: number; // Default display order
  size?: "sm" | "md" | "lg" | "full"; // Suggested size
}

/**
 * All available dashboard modules
 * Organized by display order and categorized for easy management
 */
export const DASHBOARD_MODULES: DashboardModule[] = [
  // Core modules - always visible essentials
  {
    id: "risk-status",
    name: "Risk Status",
    description: "Trading status and risk level indicator",
    category: "core",
    icon: "Shield",
    component: "RiskStatusBanner",
    defaultVisible: true,
    powerModeOnly: false,
    order: 1,
    size: "full",
  },
  {
    id: "stats-overview",
    name: "Performance Stats",
    description: "Key trading metrics at a glance",
    category: "core",
    icon: "BarChart3",
    component: "StatsOverview",
    defaultVisible: true,
    powerModeOnly: false,
    order: 2,
    size: "full",
  },
  {
    id: "live-prices",
    name: "Live Prices",
    description: "Real-time market price ticker",
    category: "core",
    icon: "Activity",
    component: "LivePricesTicker",
    defaultVisible: true,
    powerModeOnly: false,
    order: 3,
    size: "full",
  },
  
  // Trading modules
  {
    id: "paper-wallet",
    name: "Paper Wallet",
    description: "View balance and manage positions",
    category: "trading",
    icon: "Wallet",
    component: "PaperWalletCard",
    defaultVisible: true,
    powerModeOnly: false,
    order: 4,
    size: "md",
  },
  {
    id: "order-form",
    name: "Quick Order",
    description: "Place trades quickly",
    category: "trading",
    icon: "Zap",
    component: "PaperOrderForm",
    defaultVisible: true,
    powerModeOnly: false,
    order: 5,
    size: "md",
  },
  {
    id: "trading-chart",
    name: "Trading Chart",
    description: "Professional charting with indicators",
    category: "trading",
    icon: "LineChart",
    component: "TradingChart",
    defaultVisible: true,
    powerModeOnly: false,
    order: 6,
    size: "full",
  },
  {
    id: "watchlist",
    name: "Watchlist",
    description: "Track favorite assets",
    category: "trading",
    icon: "Eye",
    component: "WatchlistCard",
    defaultVisible: true,
    powerModeOnly: false,
    order: 7,
    size: "sm",
  },
  {
    id: "price-alerts",
    name: "Price Alerts",
    description: "Set price notifications",
    category: "trading",
    icon: "Bell",
    component: "PriceAlertsCard",
    defaultVisible: false,
    powerModeOnly: true,
    order: 8,
    size: "sm",
  },

  // AI modules
  {
    id: "trading-dna",
    name: "Trading DNA",
    description: "Your behavioral trading profile",
    category: "ai",
    icon: "Brain",
    component: "TradingDnaCard",
    defaultVisible: true,
    powerModeOnly: false,
    order: 9,
    size: "md",
  },
  {
    id: "ai-briefing",
    name: "AI Briefing",
    description: "Daily market insights",
    category: "ai",
    icon: "Lightbulb",
    component: "AIBriefingCard",
    defaultVisible: true,
    powerModeOnly: false,
    order: 10,
    size: "md",
  },
  {
    id: "ai-insights",
    name: "Daily Insights",
    description: "Morning, midday, evening analysis",
    category: "ai",
    icon: "Sparkles",
    component: "AIInsightsCard",
    defaultVisible: false,
    powerModeOnly: true,
    order: 11,
    size: "md",
  },
  {
    id: "ai-features-hub",
    name: "AI Features Hub",
    description: "Advanced AI tools and analytics",
    category: "ai",
    icon: "Cpu",
    component: "AIFeaturesHub",
    defaultVisible: false,
    powerModeOnly: true,
    order: 12,
    size: "full",
  },
  {
    id: "peace-index",
    name: "Peace Index",
    description: "Trading stress monitor",
    category: "ai",
    icon: "Heart",
    component: "PeaceIndexCard",
    defaultVisible: true,
    powerModeOnly: false,
    order: 13,
    size: "md",
  },
  {
    id: "adaptive-insights",
    name: "Adaptive Insights",
    description: "Personalized suggestions based on your Trading DNA",
    category: "ai",
    icon: "Lightbulb",
    component: "AdaptiveInsightsPanel",
    defaultVisible: true,
    powerModeOnly: false,
    order: 13.5,
    size: "md",
  },

  // Analytics modules
  {
    id: "trade-journal",
    name: "Trade Journal",
    description: "Auto-logged trades with AI insights",
    category: "analytics",
    icon: "BookOpen",
    component: "TradeJournal",
    defaultVisible: false,
    powerModeOnly: true,
    order: 14,
    size: "full",
  },
  {
    id: "range-analysis",
    name: "Range Analysis",
    description: "Performance over custom timeframes",
    category: "analytics",
    icon: "Calendar",
    component: "RangeAnalysisCard",
    defaultVisible: false,
    powerModeOnly: true,
    order: 15,
    size: "md",
  },

  // Tools
  {
    id: "daily-insights",
    name: "Daily Insights Section",
    description: "Combined Peace Index and AI Briefing",
    category: "tools",
    icon: "Sun",
    component: "DailyInsightsSection",
    defaultVisible: false,
    powerModeOnly: false,
    order: 16,
    size: "full",
  },
];

/**
 * Get modules by category
 */
export function getModulesByCategory(category: DashboardModule["category"]): DashboardModule[] {
  return DASHBOARD_MODULES.filter((m) => m.category === category);
}

/**
 * Get modules available for a specific mode
 */
export function getModulesByMode(mode: "simple" | "power"): DashboardModule[] {
  if (mode === "simple") {
    return DASHBOARD_MODULES.filter((m) => !m.powerModeOnly);
  }
  return DASHBOARD_MODULES; // Power mode shows all
}

/**
 * Get default visible modules for initial setup
 */
export function getDefaultVisibleModules(): DashboardModule[] {
  return DASHBOARD_MODULES.filter((m) => m.defaultVisible).sort((a, b) => a.order - b.order);
}

/**
 * Get module by ID
 */
export function getModuleById(id: string): DashboardModule | undefined {
  return DASHBOARD_MODULES.find((m) => m.id === id);
}

/**
 * Module categories for organization
 */
export const MODULE_CATEGORIES = [
  { id: "core", label: "Core", description: "Essential trading information" },
  { id: "trading", label: "Trading", description: "Order placement and chart tools" },
  { id: "ai", label: "AI", description: "AI-powered insights and analysis" },
  { id: "analytics", label: "Analytics", description: "Performance tracking and journals" },
  { id: "tools", label: "Tools", description: "Utility modules and helpers" },
] as const;
