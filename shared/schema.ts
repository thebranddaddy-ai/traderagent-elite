import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - updated for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Legacy fields (kept for existing data compatibility)
  username: text("username").unique(),
  password: text("password"),
  // Replit Auth fields
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Multi-factor authentication fields
  phone: varchar("phone").unique(),
  totpSecret: varchar("totp_secret"), // For Google Authenticator
  totpEnabled: boolean("totp_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Trading fields
  tradingPaused: boolean("trading_paused").default(false).notNull(),
  // North Star Mission Fields (Oct 2025)
  archetype: text("archetype").default("guardian"), // 'guardian', 'adaptive', 'custom'
  dataShareOptIn: boolean("data_share_opt_in").default(false).notNull(), // Global Ensemble consent
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 2 }).notNull(),
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 18, scale: 2 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const paperWallets = pgTable("paper_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  balance: decimal("balance", { precision: 18, scale: 2 }).default("10000").notNull(),
});

export const paperPositions = pgTable("paper_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => paperWallets.id),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 18, scale: 2 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 18, scale: 2 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 2 }),
});

export const paperOrders = pgTable("paper_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => paperWallets.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  orderType: text("order_type").notNull(), // 'market' or 'limit'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 2 }),
  status: text("status").default("pending").notNull(), // 'completed', 'pending', 'cancelled'
  stopLoss: decimal("stop_loss", { precision: 18, scale: 2 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 2 }),
  closedBy: text("closed_by"), // 'stop_loss', 'take_profit', 'manual', null
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const aiBriefings = pgTable("ai_briefings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  summary: text("summary").notNull(),
  insights: text("insights").notNull(), // JSON string
  recommendations: text("recommendations").notNull(), // JSON string
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const riskGuardSettings = pgTable("risk_guard_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Portfolio-level controls
  maxDailyLossPercent: decimal("max_daily_loss_percent", { precision: 5, scale: 2 }).default("10"), // 10%
  maxDailyLossAmount: decimal("max_daily_loss_amount", { precision: 18, scale: 2 }).default("1000"), // $1000
  maxPortfolioDrawdownPercent: decimal("max_portfolio_drawdown_percent", { precision: 5, scale: 2 }).default("20"), // 20%
  
  // Monthly loss limits (optional enforcement)
  maxMonthlyLossPercent: decimal("max_monthly_loss_percent", { precision: 5, scale: 2 }).default("25"), // 25%
  maxMonthlyLossAmount: decimal("max_monthly_loss_amount", { precision: 18, scale: 2 }).default("5000"), // $5000
  
  // Position-level controls
  maxPositionSizePercent: decimal("max_position_size_percent", { precision: 5, scale: 2 }).default("25"), // 25% of portfolio
  maxPositionSizeAmount: decimal("max_position_size_amount", { precision: 18, scale: 2 }).default("2500"), // $2500
  maxOpenPositions: integer("max_open_positions").default(5),
  
  // Concentration risk controls
  maxSingleAssetPercent: decimal("max_single_asset_percent", { precision: 5, scale: 2 }).default("40"), // Max 40% in one asset
  
  // Consecutive loss protection
  maxConsecutiveLosses: integer("max_consecutive_losses").default(3), // Pause after 3 consecutive losses
  consecutiveLossCooldownMinutes: integer("consecutive_loss_cooldown_minutes").default(60), // 1 hour cooldown
  
  // Optional limit enforcement (user must explicitly enable to block trades)
  enforceDailyLossLimit: boolean("enforce_daily_loss_limit").default(false).notNull(), // Default: warn only
  enforceMonthlyLossLimit: boolean("enforce_monthly_loss_limit").default(false).notNull(), // Default: warn only
  
  // Auto-pause settings
  autoPauseEnabled: boolean("auto_pause_enabled").default(true).notNull(),
  cooldownEndTime: timestamp("cooldown_end_time"), // When the cooldown period ends
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OTP Codes table for Email/Phone verification
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  identifier: varchar("identifier").notNull(), // email or phone number
  code: varchar("code", { length: 6 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // 'email' or 'phone'
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_otp_identifier").on(table.identifier),
  index("idx_otp_expires").on(table.expiresAt),
]);

// AI Trade Suggestions table
export const aiTradeSuggestions = pgTable("ai_trade_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(), // 'buy' or 'sell'
  suggestedQuantity: decimal("suggested_quantity", { precision: 18, scale: 8 }),
  suggestedPrice: decimal("suggested_price", { precision: 18, scale: 2 }),
  suggestedEntry: decimal("suggested_entry", { precision: 18, scale: 2 }), // Entry price
  targetPrice: decimal("target_price", { precision: 18, scale: 2 }), // Take profit target
  stopLoss: decimal("stop_loss", { precision: 18, scale: 2 }), // Stop loss price
  riskRewardRatio: decimal("risk_reward_ratio", { precision: 10, scale: 2 }), // Risk/reward ratio
  reasoning: text("reasoning").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  status: text("status").default("active").notNull(), // 'active', 'dismissed', 'executed'
  marketConditions: text("market_conditions"), // JSON string with market data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Market Sentiment table
export const marketSentiment = pgTable("market_sentiment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  sentiment: text("sentiment").notNull(), // 'bullish', 'bearish', 'neutral'
  score: decimal("score", { precision: 5, scale: 2 }).notNull(), // -100 to 100
  analysis: text("analysis").notNull(), // AI analysis text
  newsHeadlines: text("news_headlines"), // JSON array of recent headlines
  technicalFactors: text("technical_factors"), // JSON string with technical indicators
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_sentiment_symbol").on(table.symbol),
  index("idx_sentiment_timestamp").on(table.timestamp),
]);

// Trading Patterns table (detected patterns in user's trading history)
export const tradingPatterns = pgTable("trading_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  patternType: text("pattern_type").notNull(), // 'revenge_trading', 'overtrading', 'profit_taking', 'loss_cutting', etc.
  description: text("description").notNull(),
  frequency: integer("frequency").notNull(), // How many times detected
  impact: text("impact").notNull(), // 'positive', 'negative', 'neutral'
  recommendation: text("recommendation").notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  lastOccurrence: timestamp("last_occurrence").notNull(),
}, (table) => [
  index("idx_patterns_user").on(table.userId),
]);

// Watchlist table (assets user wants to track)
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  index("idx_watchlist_user").on(table.userId),
  index("idx_watchlist_symbol").on(table.symbol),
]);

// Price Alerts table (user-defined price notifications)
export const priceAlerts = pgTable("price_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  condition: text("condition").notNull(), // 'above' or 'below'
  targetPrice: decimal("target_price", { precision: 18, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  triggered: boolean("triggered").default(false).notNull(),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_alerts_user").on(table.userId),
  index("idx_alerts_active").on(table.isActive),
]);

// Exchange Connections table (encrypted API keys for live trading)
export const exchangeConnections = pgTable("exchange_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  exchange: text("exchange").notNull(), // 'binance', 'coinbase', etc.
  encryptedApiKey: text("encrypted_api_key").notNull(), // AES-256 encrypted
  encryptedApiSecret: text("encrypted_api_secret").notNull(), // AES-256 encrypted
  permissions: text("permissions").notNull(), // 'read' | 'trade' | 'trade_auto'
  isActive: boolean("is_active").default(true).notNull(),
  lastValidated: timestamp("last_validated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exchange_user").on(table.userId),
  index("idx_exchange_active").on(table.isActive),
]);

// Execution Tokens table (for 2-step confirmation of live trades)
export const executionTokens = pgTable("execution_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  orderPayload: text("order_payload").notNull(), // JSON stringified order details
  preCheckResult: text("pre_check_result").notNull(), // JSON with validation results
  status: text("status").default("pending").notNull(), // 'pending', 'confirmed', 'expired', 'rejected'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_token_user").on(table.userId),
  index("idx_token_status").on(table.status),
  index("idx_token_expires").on(table.expiresAt),
]);

// AI Risk Assessments table (real-time portfolio risk analysis)
export const riskAssessments = pgTable("risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  riskLevel: text("risk_level").notNull(), // 'low', 'medium', 'high', 'critical'
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  warnings: text("warnings").notNull(), // JSON array of warning messages
  recommendations: text("recommendations").notNull(), // JSON array of recommendations
  portfolioMetrics: text("portfolio_metrics").notNull(), // JSON with diversification, correlation, etc.
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_risk_user").on(table.userId),
  index("idx_risk_timestamp").on(table.timestamp),
]);

// AI News Analysis table (crypto market news summaries)
export const newsAnalysis = pgTable("news_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol"), // null for general market news
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  sentiment: text("sentiment").notNull(), // 'bullish', 'bearish', 'neutral'
  impact: text("impact").notNull(), // 'high', 'medium', 'low'
  actionableInsights: text("actionable_insights").notNull(), // JSON array
  sourceUrl: text("source_url"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_news_symbol").on(table.symbol),
  index("idx_news_timestamp").on(table.timestamp),
]);

// AI Portfolio Optimizations table (rebalancing suggestions)
export const portfolioOptimizations = pgTable("portfolio_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  currentAllocation: text("current_allocation").notNull(), // JSON
  suggestedAllocation: text("suggested_allocation").notNull(), // JSON
  reasoning: text("reasoning").notNull(),
  expectedImprovement: decimal("expected_improvement", { precision: 5, scale: 2 }), // % improvement
  rebalanceActions: text("rebalance_actions").notNull(), // JSON array of buy/sell actions
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_portfolio_opt_user").on(table.userId),
]);

// AI Coaching Insights table (personalized learning tips)
export const coachingInsights = pgTable("coaching_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // 'mistake_analysis', 'improvement_tip', 'pattern_alert', 'achievement'
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull(), // 'high', 'medium', 'low'
  actionItems: text("action_items").notNull(), // JSON array
  relatedTrades: text("related_trades"), // JSON array of trade IDs
  acknowledged: boolean("acknowledged").default(false).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_coaching_user").on(table.userId),
  index("idx_coaching_acknowledged").on(table.acknowledged),
]);

// AI Price Predictions table (short-term forecasts)
export const pricePredictions = pgTable("price_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(), // '1h', '4h', '24h'
  currentPrice: decimal("current_price", { precision: 18, scale: 2 }).notNull(),
  predictedPrice: decimal("predicted_price", { precision: 18, scale: 2 }).notNull(),
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }).notNull(), // 0-100
  priceRange: text("price_range").notNull(), // JSON with min/max
  factors: text("factors").notNull(), // JSON array of influencing factors
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }), // Updated after timeframe passes
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_predictions_symbol").on(table.symbol),
  index("idx_predictions_timestamp").on(table.timestamp),
]);

// AI Correlation Analysis table (portfolio correlation insights)
export const correlations = pgTable("correlations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  asset1: text("asset1").notNull(),
  asset2: text("asset2").notNull(),
  correlationScore: decimal("correlation_score", { precision: 5, scale: 2 }).notNull(), // -100 to 100
  riskLevel: text("risk_level").notNull(), // 'high', 'medium', 'low'
  recommendation: text("recommendation").notNull(),
  alternatives: text("alternatives").notNull(), // JSON array of uncorrelated alternatives
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_correlations_user").on(table.userId),
]);

// AI Volatility Forecasts table (market volatility predictions)
export const volatilityForecasts = pgTable("volatility_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  currentVolatility: decimal("current_volatility", { precision: 5, scale: 2 }).notNull(), // %
  predictedVolatility: decimal("predicted_volatility", { precision: 5, scale: 2 }).notNull(), // %
  timeframe: text("timeframe").notNull(), // '4h', '24h', '7d'
  volatilityTrend: text("volatility_trend").notNull(), // 'increasing', 'decreasing', 'stable'
  tradingRecommendation: text("trading_recommendation").notNull(), // 'reduce_exposure', 'normal', 'opportunity'
  bestTimeToTrade: text("best_time_to_trade"), // JSON with time windows
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_volatility_symbol").on(table.symbol),
  index("idx_volatility_timestamp").on(table.timestamp),
]);

// AI Position Sizing table (Kelly Criterion-based sizing recommendations)
export const positionSizing = pgTable("position_sizing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  suggestedSize: decimal("suggested_size", { precision: 18, scale: 2 }).notNull(), // USD amount
  suggestedPercentage: decimal("suggested_percentage", { precision: 5, scale: 2 }).notNull(), // % of portfolio
  kellyPercentage: decimal("kelly_percentage", { precision: 5, scale: 2 }), // Kelly Criterion result
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  riskRewardRatio: decimal("risk_reward_ratio", { precision: 5, scale: 2 }),
  reasoning: text("reasoning").notNull(),
  maxRiskAmount: decimal("max_risk_amount", { precision: 18, scale: 2 }), // Max $ to risk
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_position_sizing_user").on(table.userId),
]);

// AI Audit Logs table (North Star Mission: transparency & auditability)
// Stores every AI decision for full explainability and accountability
export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  featureType: text("feature_type").notNull(), // 'suggestion', 'risk_check', 'prediction', 'optimization', etc.
  modelVersion: text("model_version").notNull(), // 'gpt-4o-mini', 'gpt-4', etc.
  promptHash: text("prompt_hash"), // SHA-256 of prompt for auditability
  inputData: text("input_data"), // JSON of input parameters
  outputData: text("output_data").notNull(), // JSON of AI response
  explanation: text("explanation").notNull(), // Human-readable reasoning
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // 0-100 confidence score
  outcome: text("outcome"), // Actual result if available (for learning loop)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_user").on(table.userId),
  index("idx_audit_feature").on(table.featureType),
  index("idx_audit_timestamp").on(table.timestamp),
]);

// AI Daily Insights table (Freedom Engine: Morning Brief, Midday Pulse, Evening Reflection)
// North Star Mission: Transform trading from stress to calm guidance
export const aiDailyInsights = pgTable("ai_daily_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  insightType: text("insight_type").notNull(), // 'morning', 'midday', 'evening'
  summary: text("summary").notNull(),
  emotionScore: decimal("emotion_score", { precision: 5, scale: 2 }), // 0-100 (fear to greed)
  peaceIndex: decimal("peace_index", { precision: 5, scale: 2 }).notNull(), // 0-100 (stress to calm)
  insights: text("insights").notNull(), // JSON array of key insights
  recommendations: text("recommendations").notNull(), // JSON array of actionable recommendations
  marketContext: text("market_context"), // JSON with BTC, ETH, SOL prices and sentiment
  portfolioSnapshot: text("portfolio_snapshot"), // JSON with positions and P&L at time of insight
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_insights_user").on(table.userId),
  index("idx_daily_insights_type").on(table.insightType),
  index("idx_daily_insights_timestamp").on(table.timestamp),
]);

// ==================== PHASE A: North Star Critical Features ====================

// Privacy Preferences table (Phase A: User Privacy Control)
// Granular opt-in controls for data sharing and AI features
export const privacyPreferences = pgTable("privacy_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Data sharing controls
  shareTradeHistory: boolean("share_trade_history").default(false).notNull(), // Share with Global Ensemble
  sharePerformanceMetrics: boolean("share_performance_metrics").default(false).notNull(), // Share DNA metrics
  shareAIInteractions: boolean("share_ai_interactions").default(false).notNull(), // Share AI queries/responses
  
  // AI feature controls
  enableAISuggestions: boolean("enable_ai_suggestions").default(true).notNull(), // AI trade suggestions
  enableAIExitAdvisor: boolean("enable_ai_exit_advisor").default(true).notNull(), // Exit recommendations
  enableAITradeAssistant: boolean("enable_ai_trade_assistant").default(true).notNull(), // Trade modal AI
  enableDailyInsights: boolean("enable_daily_insights").default(true).notNull(), // Morning/Midday/Evening briefs
  
  // Analytics and tracking
  enableAnalytics: boolean("enable_analytics").default(true).notNull(), // Usage analytics
  enablePersonalization: boolean("enable_personalization").default(true).notNull(), // Personalized experience
  
  // Audit and transparency
  viewAuditLogs: boolean("view_audit_logs").default(true).notNull(), // Show AI audit logs in UI
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_privacy_user").on(table.userId),
]);

// Feature Flags table (Phase A: Safe Feature Rollout)
// Global and per-user feature toggles for controlled releases
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureKey: text("feature_key").notNull().unique(), // 'ai_exit_advisor', 'live_trading', etc.
  featureName: text("feature_name").notNull(), // Human-readable name
  description: text("description"), // What this feature does
  
  // Rollout controls
  enabled: boolean("enabled").default(false).notNull(), // Global on/off switch
  rolloutPercentage: decimal("rollout_percentage", { precision: 5, scale: 2 }).default("0"), // 0-100%
  
  // User targeting
  allowedUserIds: text("allowed_user_ids"), // JSON array of user IDs (beta testers)
  excludedUserIds: text("excluded_user_ids"), // JSON array of user IDs (blocked users)
  
  // Environment controls
  enabledInDev: boolean("enabled_in_dev").default(true).notNull(),
  enabledInProduction: boolean("enabled_in_production").default(false).notNull(),
  
  // Metadata
  createdBy: varchar("created_by"), // Admin user ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_feature_key").on(table.featureKey),
  index("idx_feature_enabled").on(table.enabled),
]);

// Risk Prechecks table (Phase A: Pre-Trade Validation)
// Comprehensive risk validation before trade execution
export const riskPrechecks = pgTable("risk_prechecks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Trade details
  tradeType: text("trade_type").notNull(), // 'paper' or 'live'
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 2 }),
  orderType: text("order_type").notNull(), // 'market' or 'limit'
  
  // Validation results
  passed: boolean("passed").notNull(), // Overall pass/fail
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // Individual checks
  checks: text("checks").notNull(), // JSON array of individual validation results
  warnings: text("warnings"), // JSON array of warning messages
  blockers: text("blockers"), // JSON array of blocking issues
  
  // Risk factors
  portfolioImpact: decimal("portfolio_impact", { precision: 5, scale: 2 }), // % impact on portfolio
  concentrationRisk: decimal("concentration_risk", { precision: 5, scale: 2 }), // 0-100
  correlationRisk: decimal("correlation_risk", { precision: 5, scale: 2 }), // 0-100
  volatilityRisk: decimal("volatility_risk", { precision: 5, scale: 2 }), // 0-100
  
  // Recommendations
  recommendations: text("recommendations").notNull(), // JSON array of risk mitigation suggestions
  suggestedAdjustments: text("suggested_adjustments"), // JSON with safer position size/SL/TP
  
  // Execution tracking
  executionToken: varchar("execution_token"), // Links to executionTokens table
  executed: boolean("executed").default(false).notNull(),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_precheck_user").on(table.userId),
  index("idx_precheck_passed").on(table.passed),
  index("idx_precheck_timestamp").on(table.timestamp),
  index("idx_precheck_token").on(table.executionToken),
]);

// ==================== PHASE B: AI Learning & Personalization ====================

// AI Suggestion Outcomes table (Phase B: Outcome Tracking)
// Track what actually happened after AI suggestions - critical for learning loop
export const aiSuggestionOutcomes = pgTable("ai_suggestion_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Link to original suggestion/audit log
  auditLogId: varchar("audit_log_id").references(() => aiAuditLogs.id),
  suggestionId: varchar("suggestion_id"), // Links to aiTradeSuggestions or other AI features
  featureType: text("feature_type").notNull(), // 'trade_suggestion', 'exit_advisor', 'position_sizing', etc.
  
  // User action
  userFollowed: boolean("user_followed").notNull(), // Did user follow the AI advice?
  actionTaken: text("action_taken"), // 'executed_trade', 'ignored', 'modified', 'partial_follow'
  modificationDetails: text("modification_details"), // JSON if user modified the suggestion
  
  // Actual results
  actualOutcome: text("actual_outcome"), // 'profit', 'loss', 'break_even', 'still_open', 'n/a'
  profitLossAmount: decimal("profit_loss_amount", { precision: 18, scale: 2 }), // Actual P/L
  profitLossPercent: decimal("profit_loss_percent", { precision: 5, scale: 2 }), // % return
  
  // AI prediction vs reality
  aiPredictedOutcome: text("ai_predicted_outcome"), // What AI predicted would happen
  predictionAccuracy: decimal("prediction_accuracy", { precision: 5, scale: 2 }), // How accurate was AI (0-100)
  
  // Timing
  suggestionTimestamp: timestamp("suggestion_timestamp").notNull(),
  outcomeTimestamp: timestamp("outcome_timestamp"), // When outcome was determined
  
  // Learning data
  wasSuccessful: boolean("was_successful"), // Simplified success/failure for training
  learningNotes: text("learning_notes"), // JSON with additional learning insights
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_outcome_user").on(table.userId),
  index("idx_outcome_audit").on(table.auditLogId),
  index("idx_outcome_feature").on(table.featureType),
  index("idx_outcome_followed").on(table.userFollowed),
  index("idx_outcome_timestamp").on(table.timestamp),
]);

// User Feedback table (Phase B: Explicit Feedback Loop)
// Capture direct user feedback on AI recommendations
export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // What was feedback on
  feedbackType: text("feedback_type").notNull(), // 'suggestion', 'exit_advice', 'risk_assessment', 'insight', etc.
  referenceId: varchar("reference_id"), // ID of the suggestion/advice/assessment
  auditLogId: varchar("audit_log_id").references(() => aiAuditLogs.id),
  
  // Feedback rating
  rating: integer("rating").notNull(), // 1-5 stars or thumbs up/down (-1, 1)
  helpfulness: integer("helpfulness"), // How helpful was it? 1-5
  accuracy: integer("accuracy"), // How accurate was it? 1-5
  
  // Qualitative feedback
  comment: text("comment"), // Optional user comment
  tags: text("tags"), // JSON array: ['too_aggressive', 'perfect_timing', 'missed_context', etc.]
  
  // Context
  marketCondition: text("market_condition"), // 'volatile', 'stable', 'trending'
  userEmotionalState: text("user_emotional_state"), // 'calm', 'stressed', 'confident'
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_feedback_user").on(table.userId),
  index("idx_feedback_type").on(table.feedbackType),
  index("idx_feedback_rating").on(table.rating),
  index("idx_feedback_audit").on(table.auditLogId),
  index("idx_feedback_timestamp").on(table.timestamp),
]);

// Learning Checkpoints table (Phase B: AI Model Evolution)
// Periodic snapshots of AI performance and learning state
export const learningCheckpoints = pgTable("learning_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Checkpoint metadata
  checkpointType: text("checkpoint_type").notNull(), // 'weekly', 'monthly', 'milestone', 'manual'
  modelVersion: text("model_version").notNull(), // Which AI model version
  
  // Performance metrics
  overallAccuracy: decimal("overall_accuracy", { precision: 5, scale: 2 }).notNull(), // % of correct predictions
  suggestionAccuracy: decimal("suggestion_accuracy", { precision: 5, scale: 2 }),
  riskAssessmentAccuracy: decimal("risk_assessment_accuracy", { precision: 5, scale: 2 }),
  exitTimingAccuracy: decimal("exit_timing_accuracy", { precision: 5, scale: 2 }),
  
  // User engagement
  totalSuggestions: integer("total_suggestions").default(0).notNull(),
  suggestionsFollowed: integer("suggestions_followed").default(0).notNull(),
  followRate: decimal("follow_rate", { precision: 5, scale: 2 }), // % of suggestions followed
  
  // Learning progress
  dataPointsCollected: integer("data_points_collected").default(0).notNull(), // How much training data
  confidenceImprovement: decimal("confidence_improvement", { precision: 5, scale: 2 }), // vs previous checkpoint
  
  // User outcomes when following AI
  profitWhenFollowed: decimal("profit_when_followed", { precision: 18, scale: 2 }),
  lossWhenFollowed: decimal("loss_when_followed", { precision: 18, scale: 2 }),
  winRateWhenFollowed: decimal("win_rate_when_followed", { precision: 5, scale: 2 }),
  
  // Personalization state
  personalizationLevel: text("personalization_level").notNull(), // 'learning', 'personalizing', 'optimized'
  keyLearnings: text("key_learnings"), // JSON array of key insights learned
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_checkpoint_user").on(table.userId),
  index("idx_checkpoint_type").on(table.checkpointType),
  index("idx_checkpoint_timestamp").on(table.timestamp),
]);

// Personalization Metrics table (Phase B: Per-User AI Tuning)
// Fine-grained tracking of AI personalization for each user
export const personalizationMetrics = pgTable("personalization_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Current personalization state
  personalizationScore: decimal("personalization_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  dataCollectionProgress: decimal("data_collection_progress", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // AI accuracy per feature
  tradeSuggestionAccuracy: decimal("trade_suggestion_accuracy", { precision: 5, scale: 2 }),
  exitAdvisorAccuracy: decimal("exit_advisor_accuracy", { precision: 5, scale: 2 }),
  riskPredictionAccuracy: decimal("risk_prediction_accuracy", { precision: 5, scale: 2 }),
  positionSizingAccuracy: decimal("position_sizing_accuracy", { precision: 5, scale: 2 }),
  
  // Learning characteristics
  preferredRiskLevel: text("preferred_risk_level"), // 'conservative', 'moderate', 'aggressive'
  optimalEntryTiming: text("optimal_entry_timing"), // 'early', 'confirmation', 'late'
  exitPreference: text("exit_preference"), // 'quick_profit', 'let_winners_run', 'trailing_stop'
  emotionalTriggers: text("emotional_triggers"), // JSON array of identified triggers
  
  // Behavioral patterns learned
  bestTradingTime: text("best_trading_time"), // When user performs best
  worstTradingTime: text("worst_trading_time"), // When user struggles
  strengthSymbols: text("strength_symbols"), // JSON array of symbols user trades well
  weaknessSymbols: text("weakness_symbols"), // JSON array of symbols user struggles with
  
  // Adaptive parameters
  confidenceAdjustment: decimal("confidence_adjustment", { precision: 5, scale: 2 }).default("0"), // -50 to +50
  riskToleranceMultiplier: decimal("risk_tolerance_multiplier", { precision: 5, scale: 2 }).default("1.0"), // 0.5 to 2.0
  suggestionAggressiveness: decimal("suggestion_aggressiveness", { precision: 5, scale: 2 }).default("50"), // 0-100
  
  // Stats
  totalInteractions: integer("total_interactions").default(0).notNull(),
  totalFeedback: integer("total_feedback").default(0).notNull(),
  totalOutcomes: integer("total_outcomes").default(0).notNull(),
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_personalization_user").on(table.userId),
  index("idx_personalization_score").on(table.personalizationScore),
]);

// Trading DNA Snapshots table (Phase B: Evolution Tracking)
// Historical snapshots of Trading DNA to show progress over time
export const tradingDnaSnapshots = pgTable("trading_dna_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Snapshot metadata
  snapshotType: text("snapshot_type").notNull(), // 'daily', 'weekly', 'monthly', 'milestone'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Core DNA metrics (snapshot at this point in time)
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).notNull(),
  avgProfit: decimal("avg_profit", { precision: 18, scale: 2 }).notNull(),
  avgLoss: decimal("avg_loss", { precision: 18, scale: 2 }).notNull(),
  totalTrades: integer("total_trades").default(0).notNull(),
  totalProfitLoss: decimal("total_profit_loss", { precision: 18, scale: 2 }).notNull(),
  
  // Risk metrics
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }).notNull(),
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 2 }).notNull(),
  sharpeRatio: decimal("sharpe_ratio", { precision: 5, scale: 2 }),
  profitFactor: decimal("profit_factor", { precision: 5, scale: 2 }),
  
  // Behavioral metrics
  tradingStyle: text("trading_style").notNull(), // 'Aggressive', 'Conservative', 'Balanced'
  revengeTradeScore: decimal("revenge_trade_score", { precision: 5, scale: 2 }),
  volatilitySensitivity: decimal("volatility_sensitivity", { precision: 5, scale: 2 }),
  
  // Evolution indicators
  improvementVsPrevious: decimal("improvement_vs_previous", { precision: 5, scale: 2 }), // % improvement
  keyChanges: text("key_changes"), // JSON array of significant changes
  milestones: text("milestones"), // JSON array of achievements
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_dna_snapshot_user").on(table.userId),
  index("idx_dna_snapshot_type").on(table.snapshotType),
  index("idx_dna_snapshot_timestamp").on(table.timestamp),
]);

// ============================================================================
// PHASE C: PREDICTIVE INTELLIGENCE & PRO TRADER SUITE
// ============================================================================

// Trade Journal Entries table (Phase C: AI Trade Journal)
// Auto-logged trades with AI-generated insights and lessons
export const tradeJournalEntries = pgTable("trade_journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Trade reference
  tradeId: varchar("trade_id"), // Reference to paper_orders.id or live trade ID
  tradeType: text("trade_type").notNull(), // 'paper', 'live', 'simulated'
  
  // Trade details (captured at execution)
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  entryPrice: decimal("entry_price", { precision: 18, scale: 2 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 18, scale: 2 }),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  profitLoss: decimal("profit_loss", { precision: 18, scale: 2 }),
  profitLossPercent: decimal("profit_loss_percent", { precision: 5, scale: 2 }),
  
  // Trade context
  marketCondition: text("market_condition"), // 'volatile', 'stable', 'trending', 'ranging'
  userEmotionalState: text("user_emotional_state"), // 'calm', 'stressed', 'confident', 'fearful'
  tradingSessionDuration: integer("trading_session_duration"), // Minutes in current session
  consecutiveTradesCount: integer("consecutive_trades_count"), // Trades in current session
  
  // AI-generated insights
  aiInsights: text("ai_insights"), // JSON: AI analysis of the trade
  lessonsLearned: text("lessons_learned"), // JSON array: Key lessons from this trade
  mistakesMade: text("mistakes_made"), // JSON array: Identified mistakes
  whatWorked: text("what_worked"), // JSON array: What went well
  whatDidntWork: text("what_didnt_work"), // JSON array: What didn't work
  
  // Pattern recognition
  detectedPatterns: text("detected_patterns"), // JSON array: Trading patterns identified
  similarPastTrades: text("similar_past_trades"), // JSON array: IDs of similar trades
  
  // Performance context
  tradeRank: text("trade_rank"), // 'excellent', 'good', 'average', 'poor', 'terrible'
  strategicAlignment: decimal("strategic_alignment", { precision: 5, scale: 2 }), // 0-100: How well it aligned with user's DNA
  riskRewardRatio: decimal("risk_reward_ratio", { precision: 5, scale: 2 }),
  
  // User notes
  userNotes: text("user_notes"), // Optional manual notes
  tags: text("tags"), // JSON array: User-added tags
  
  // Metadata
  entryTimestamp: timestamp("entry_timestamp").notNull(),
  exitTimestamp: timestamp("exit_timestamp"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_journal_user").on(table.userId),
  index("idx_journal_type").on(table.tradeType),
  index("idx_journal_symbol").on(table.symbol),
  index("idx_journal_rank").on(table.tradeRank),
  index("idx_journal_timestamp").on(table.createdAt),
]);

// Mistake Predictions table (Phase C: Mistake Prediction Engine)
// AI predictions of potential mistakes before trades are executed
export const mistakePredictions = pgTable("mistake_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Trade context
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 2 }),
  
  // Prediction details
  predictionType: text("prediction_type").notNull(), // 'revenge_trading', 'fomo', 'overtrading', 'emotional_entry', 'poor_timing', 'oversized_position'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // AI reasoning
  reasoning: text("reasoning").notNull(), // Why AI thinks this is a mistake
  evidence: text("evidence"), // JSON array: Evidence points
  alternativeSuggestion: text("alternative_suggestion"), // What AI suggests instead
  
  // Context that triggered prediction
  triggerFactors: text("trigger_factors"), // JSON array: ['recent_loss', 'market_volatility', 'trading_fatigue', etc.]
  userStateAnalysis: text("user_state_analysis"), // JSON: Analysis of user's current state
  marketStateAnalysis: text("market_state_analysis"), // JSON: Analysis of market conditions
  
  // Historical reference
  similarPastMistakes: text("similar_past_mistakes"), // JSON array: IDs of similar past mistakes
  pastMistakeOutcomes: text("past_mistake_outcomes"), // JSON: What happened when user made similar mistakes
  
  // User response
  wasHeeded: boolean("was_heeded").default(false), // Did user listen to the warning?
  userResponse: text("user_response"), // 'dismissed', 'modified_trade', 'cancelled', 'proceeded_anyway'
  
  // Outcome (if trade was executed)
  tradeExecuted: boolean("trade_executed").default(false),
  tradeId: varchar("trade_id"), // Reference to executed trade
  actualOutcome: text("actual_outcome"), // 'prediction_correct', 'prediction_wrong', 'neutral'
  outcomeDetails: text("outcome_details"), // JSON: Details of what happened
  
  // Learning feedback
  predictionAccurate: boolean("prediction_accurate"), // Was the AI right?
  userFeedback: text("user_feedback"), // Optional feedback on the prediction
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_mistake_user").on(table.userId),
  index("idx_mistake_type").on(table.predictionType),
  index("idx_mistake_severity").on(table.severity),
  index("idx_mistake_heeded").on(table.wasHeeded),
  index("idx_mistake_timestamp").on(table.timestamp),
]);

// Strategy Performance table (Phase C: Strategy Analytics)
// Tracks performance of different trading strategies over time
export const strategyPerformance = pgTable("strategy_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Strategy identification
  strategyName: text("strategy_name").notNull(), // User-defined or AI-detected
  strategyType: text("strategy_type"), // 'trend_following', 'mean_reversion', 'breakout', 'scalping', 'swing', 'custom'
  description: text("description"),
  
  // Time period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end"),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Performance metrics
  totalTrades: integer("total_trades").default(0).notNull(),
  winningTrades: integer("winning_trades").default(0).notNull(),
  losingTrades: integer("losing_trades").default(0).notNull(),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  
  // Profit/Loss
  totalProfitLoss: decimal("total_profit_loss", { precision: 18, scale: 2 }).notNull(),
  avgProfit: decimal("avg_profit", { precision: 18, scale: 2 }),
  avgLoss: decimal("avg_loss", { precision: 18, scale: 2 }),
  largestWin: decimal("largest_win", { precision: 18, scale: 2 }),
  largestLoss: decimal("largest_loss", { precision: 18, scale: 2 }),
  
  // Risk metrics
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 2 }),
  maxDrawdownAmount: decimal("max_drawdown_amount", { precision: 18, scale: 2 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 5, scale: 2 }),
  profitFactor: decimal("profit_factor", { precision: 5, scale: 2 }),
  riskRewardRatio: decimal("risk_reward_ratio", { precision: 5, scale: 2 }),
  
  // Consistency metrics
  consecutiveWins: integer("consecutive_wins").default(0),
  consecutiveLosses: integer("consecutive_losses").default(0),
  longestWinStreak: integer("longest_win_streak").default(0),
  longestLossStreak: integer("longest_loss_streak").default(0),
  
  // Market conditions performance
  performanceInVolatile: decimal("performance_in_volatile", { precision: 5, scale: 2 }), // Win rate in volatile markets
  performanceInStable: decimal("performance_in_stable", { precision: 5, scale: 2 }), // Win rate in stable markets
  performanceInTrending: decimal("performance_in_trending", { precision: 5, scale: 2 }), // Win rate in trending markets
  performanceInRanging: decimal("performance_in_ranging", { precision: 5, scale: 2 }), // Win rate in ranging markets
  
  // Best performing assets
  bestSymbols: text("best_symbols"), // JSON array: Top performing symbols for this strategy
  worstSymbols: text("worst_symbols"), // JSON array: Worst performing symbols
  
  // AI insights
  aiAnalysis: text("ai_analysis"), // JSON: AI's analysis of strategy performance
  strengthsIdentified: text("strengths_identified"), // JSON array: What's working
  weaknessesIdentified: text("weaknesses_identified"), // JSON array: What needs improvement
  optimizationSuggestions: text("optimization_suggestions"), // JSON array: AI suggestions for improvement
  
  // Evolution tracking
  performanceTrend: text("performance_trend"), // 'improving', 'declining', 'stable'
  trendConfidence: decimal("trend_confidence", { precision: 5, scale: 2 }), // 0-100
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_strategy_user").on(table.userId),
  index("idx_strategy_type").on(table.strategyType),
  index("idx_strategy_active").on(table.isActive),
  index("idx_strategy_updated").on(table.lastUpdated),
]);

// ============================================================================
// PHASE D: WHAT-IF SCENARIO SIMULATOR
// ============================================================================

// What-If Simulations table (Phase D: Scenario Simulator)
// Stores probabilistic trade simulations and AI-generated alternative suggestions
export const whatIfSimulations = pgTable("whatif_simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Simulation request
  requestJson: text("request_json").notNull(), // JSON: Full request payload
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  size: decimal("size", { precision: 18, scale: 2 }).notNull(), // Position size in USD
  entryPrice: decimal("entry_price", { precision: 18, scale: 2 }),
  slippagePct: decimal("slippage_pct", { precision: 5, scale: 2 }),
  timeframe: text("timeframe").notNull(), // '1h', '4h', '24h'
  lookbackDays: integer("lookback_days"),
  
  // Simulation results
  resultJson: text("result_json").notNull(), // JSON: Full response payload
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // AI analysis
  aiExplanation: text("ai_explanation"), // AI-generated explanation
  modelVersion: text("model_version"), // 'gpt-4o-mini', 'fallback', etc.
  promptHash: text("prompt_hash"), // SHA-256 for audit
  
  // Risk signals
  riskSignals: text("risk_signals"), // JSON array: Detected risks
  suggestedAlternatives: text("suggested_alternatives"), // JSON array: Alternative trade setups
  
  // User action
  actionTaken: text("action_taken"), // 'applied_suggestion', 'proceeded_original', 'cancelled', 'modified'
  appliedAlternative: text("applied_alternative"), // JSON: Which alternative was applied
  
  // Outcome tracking (if trade executed)
  tradeExecuted: boolean("trade_executed").default(false),
  tradeId: varchar("trade_id"), // Reference to executed trade
  actualOutcome: text("actual_outcome"), // 'within_predicted', 'outside_predicted', 'better', 'worse'
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }), // How accurate was simulation
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_whatif_user").on(table.userId),
  index("idx_whatif_symbol").on(table.symbol),
  index("idx_whatif_timeframe").on(table.timeframe),
  index("idx_whatif_timestamp").on(table.createdAt),
]);

// ============================================================================
// PHASE E: AI TIMEFRAME ANALYSIS & PERSONAL AGENT
// ============================================================================

// AI Analysis Runs table - Stores timeframe-based trading analysis results
export const aiAnalysisRuns = pgTable("ai_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Analysis timeframe
  dateFrom: timestamp("date_from").notNull(),
  dateTo: timestamp("date_to").notNull(),
  
  // Analysis results
  result: jsonb("result").notNull(), // Full analysis JSON
  tokenUsage: integer("token_usage").default(0),
  
  // Privacy & consent
  privacyLearnOnly: boolean("privacy_learn_only").default(true).notNull(),
  
  // AI metadata
  promptHash: text("prompt_hash"), // SHA-256 for audit transparency
  modelVersion: text("model_version"), // e.g., 'gpt-4o-mini'
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_analysis_user").on(table.userId),
  index("idx_analysis_created").on(table.createdAt),
]);

// Personal Agents table - Stores evolving learning state for each user
export const personalAgents = pgTable("personal_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Learning snapshot (JSONB for flexibility)
  snapshot: jsonb("snapshot").notNull().default('{}'),
  // snapshot structure:
  // {
  //   "dna_snapshot": {},
  //   "last_analysis_run_id": "uuid",
  //   "labeled_mistakes": [{"type": "late_exit", "trade_ids": ["t1","t2"], "notes": "pattern"}],
  //   "practice_modules": [{"id": "discipline-check", "status": "active"}],
  //   "vectors_meta": {"count": 0}
  // }
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Settings Audit table - Tracks consent and privacy setting changes
export const userSettingsAudit = pgTable("user_settings_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Setting change details
  settingKey: text("setting_key").notNull(), // e.g., "ai_learning_enabled"
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  
  // Context
  changeReason: text("change_reason"), // Optional: why user changed setting
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_settings_audit_user").on(table.userId),
  index("idx_settings_audit_key").on(table.settingKey),
  index("idx_settings_audit_created").on(table.createdAt),
]);

// ============================================================================
// PEACE INDEX & FOCUS MODE SYSTEM
// ============================================================================

// Peace Index table - Tracks daily peace/calm scores for traders
export const peaceIndex = pgTable("peace_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Peace metrics
  score: integer("score").notNull(), // 0-100 peace score
  stressLevel: integer("stress_level").notNull(), // 0-100 stress level
  
  // Contributing factors
  tradeFrequency: integer("trade_frequency").default(0), // Trades today
  lossStreak: integer("loss_streak").default(0), // Current loss streak
  winStreak: integer("win_streak").default(0), // Current win streak
  dailyPnL: decimal("daily_pnl", { precision: 18, scale: 2 }).default("0"),
  
  // AI insights
  insights: jsonb("insights"), // AI-generated peace insights
  
  // Recommendations
  recommendsFocus: boolean("recommends_focus").default(false), // Should enter focus mode
  recommendsBreak: boolean("recommends_break").default(false), // Should take a break
  
  date: timestamp("date").notNull(), // Date of this peace score
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_peace_user").on(table.userId),
  index("idx_peace_date").on(table.date),
]);

// Focus Sessions table - Tracks focus mode usage
export const focusSessions = pgTable("focus_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Session details
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  
  // Session outcome
  completed: boolean("completed").default(false), // Did they complete the session
  tradesExecuted: integer("trades_executed").default(0), // Trades during focus
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_focus_user").on(table.userId),
  index("idx_focus_start").on(table.startTime),
]);

// Stress Indicators table - Tracks behavioral stress signals
export const stressIndicators = pgTable("stress_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Indicator details
  type: text("type").notNull(), // 'rapid_trading', 'loss_chasing', 'position_scaling', etc.
  severity: text("severity").notNull(), // 'low', 'medium', 'high'
  description: text("description"),
  
  // Context
  triggerData: jsonb("trigger_data"), // Related trade IDs, metrics, etc.
  
  // AI recommendation
  aiSuggestion: text("ai_suggestion"),
  
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stress_user").on(table.userId),
  index("idx_stress_type").on(table.type),
  index("idx_stress_detected").on(table.detectedAt),
]);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  tradingPaused: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  timestamp: true,
});

export const insertPaperWalletSchema = createInsertSchema(paperWallets).omit({
  id: true,
});

export const insertPaperPositionSchema = createInsertSchema(paperPositions).omit({
  id: true,
});

export const insertPaperOrderSchema = createInsertSchema(paperOrders).omit({
  id: true,
  timestamp: true,
});

export const insertAIBriefingSchema = createInsertSchema(aiBriefings).omit({
  id: true,
  timestamp: true,
});

export const insertRiskGuardSettingsSchema = createInsertSchema(riskGuardSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
  verified: true,
});

export const insertAITradeSuggestionSchema = createInsertSchema(aiTradeSuggestions).omit({
  id: true,
  timestamp: true,
});

export const insertMarketSentimentSchema = createInsertSchema(marketSentiment).omit({
  id: true,
  timestamp: true,
});

export const insertTradingPatternSchema = createInsertSchema(tradingPatterns).omit({
  id: true,
  detectedAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
  triggered: true,
  triggeredAt: true,
});

export const insertExchangeConnectionSchema = createInsertSchema(exchangeConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastValidated: true,
});

export const insertExecutionTokenSchema = createInsertSchema(executionTokens).omit({
  id: true,
  createdAt: true,
});

export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments).omit({
  id: true,
  timestamp: true,
});

export const insertNewsAnalysisSchema = createInsertSchema(newsAnalysis).omit({
  id: true,
  timestamp: true,
});

export const insertPortfolioOptimizationSchema = createInsertSchema(portfolioOptimizations).omit({
  id: true,
  timestamp: true,
});

export const insertCoachingInsightSchema = createInsertSchema(coachingInsights).omit({
  id: true,
  timestamp: true,
  acknowledged: true,
});

export const insertPricePredictionSchema = createInsertSchema(pricePredictions).omit({
  id: true,
  timestamp: true,
});

export const insertCorrelationSchema = createInsertSchema(correlations).omit({
  id: true,
  timestamp: true,
});

export const insertVolatilityForecastSchema = createInsertSchema(volatilityForecasts).omit({
  id: true,
  timestamp: true,
});

export const insertPositionSizingSchema = createInsertSchema(positionSizing).omit({
  id: true,
  timestamp: true,
});

export const insertAIDailyInsightSchema = createInsertSchema(aiDailyInsights).omit({
  id: true,
  timestamp: true,
});

export const insertAIAuditLogSchema = createInsertSchema(aiAuditLogs).omit({
  id: true,
  timestamp: true,
});

// Phase A Insert Schemas
export const insertPrivacyPreferencesSchema = createInsertSchema(privacyPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskPrecheckSchema = createInsertSchema(riskPrechecks).omit({
  id: true,
  timestamp: true,
  executed: true,
});

// Phase B Insert Schemas
export const insertAISuggestionOutcomeSchema = createInsertSchema(aiSuggestionOutcomes).omit({
  id: true,
  timestamp: true,
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  timestamp: true,
});

export const insertLearningCheckpointSchema = createInsertSchema(learningCheckpoints).omit({
  id: true,
  timestamp: true,
});

export const insertPersonalizationMetricsSchema = createInsertSchema(personalizationMetrics).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertTradingDnaSnapshotSchema = createInsertSchema(tradingDnaSnapshots).omit({
  id: true,
  timestamp: true,
});

// Phase C Insert Schemas
export const insertTradeJournalEntrySchema = createInsertSchema(tradeJournalEntries).omit({
  id: true,
  createdAt: true,
});

export const insertMistakePredictionSchema = createInsertSchema(mistakePredictions).omit({
  id: true,
  timestamp: true,
});

export const insertStrategyPerformanceSchema = createInsertSchema(strategyPerformance).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

// Phase D Insert Schemas
export const insertWhatIfSimulationSchema = createInsertSchema(whatIfSimulations).omit({
  id: true,
  createdAt: true,
});

// Phase E Insert Schemas
export const insertAIAnalysisRunSchema = createInsertSchema(aiAnalysisRuns).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalAgentSchema = createInsertSchema(personalAgents).omit({
  id: true,
  updatedAt: true,
});

export const insertUserSettingsAuditSchema = createInsertSchema(userSettingsAudit).omit({
  id: true,
  createdAt: true,
});

// Peace Index Insert Schemas
export const insertPeaceIndexSchema = createInsertSchema(peaceIndex).omit({
  id: true,
  createdAt: true,
});

export const insertFocusSessionSchema = createInsertSchema(focusSessions).omit({
  id: true,
  createdAt: true,
});

export const insertStressIndicatorSchema = createInsertSchema(stressIndicators).omit({
  id: true,
  detectedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert; // For Replit Auth upsert operations

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertPaperWallet = z.infer<typeof insertPaperWalletSchema>;
export type PaperWallet = typeof paperWallets.$inferSelect;

export type InsertPaperPosition = z.infer<typeof insertPaperPositionSchema>;
export type PaperPosition = typeof paperPositions.$inferSelect;

export type InsertPaperOrder = z.infer<typeof insertPaperOrderSchema>;
export type PaperOrder = typeof paperOrders.$inferSelect;

export type InsertAIBriefing = z.infer<typeof insertAIBriefingSchema>;
export type AIBriefing = typeof aiBriefings.$inferSelect;

export type InsertRiskGuardSettings = z.infer<typeof insertRiskGuardSettingsSchema>;
export type RiskGuardSettings = typeof riskGuardSettings.$inferSelect;

export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

export type InsertAITradeSuggestion = z.infer<typeof insertAITradeSuggestionSchema>;
export type AITradeSuggestion = typeof aiTradeSuggestions.$inferSelect;

export type InsertMarketSentiment = z.infer<typeof insertMarketSentimentSchema>;
export type MarketSentiment = typeof marketSentiment.$inferSelect;

export type InsertTradingPattern = z.infer<typeof insertTradingPatternSchema>;
export type TradingPattern = typeof tradingPatterns.$inferSelect;

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;

export type InsertExchangeConnection = z.infer<typeof insertExchangeConnectionSchema>;
export type ExchangeConnection = typeof exchangeConnections.$inferSelect;

export type InsertExecutionToken = z.infer<typeof insertExecutionTokenSchema>;
export type ExecutionToken = typeof executionTokens.$inferSelect;

export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type RiskAssessment = typeof riskAssessments.$inferSelect;

export type InsertNewsAnalysis = z.infer<typeof insertNewsAnalysisSchema>;
export type NewsAnalysis = typeof newsAnalysis.$inferSelect;

export type InsertPortfolioOptimization = z.infer<typeof insertPortfolioOptimizationSchema>;
export type PortfolioOptimization = typeof portfolioOptimizations.$inferSelect;

export type InsertCoachingInsight = z.infer<typeof insertCoachingInsightSchema>;
export type CoachingInsight = typeof coachingInsights.$inferSelect;

export type InsertPricePrediction = z.infer<typeof insertPricePredictionSchema>;
export type PricePrediction = typeof pricePredictions.$inferSelect;

export type InsertCorrelation = z.infer<typeof insertCorrelationSchema>;
export type Correlation = typeof correlations.$inferSelect;

export type InsertVolatilityForecast = z.infer<typeof insertVolatilityForecastSchema>;
export type VolatilityForecast = typeof volatilityForecasts.$inferSelect;

export type InsertPositionSizing = z.infer<typeof insertPositionSizingSchema>;
export type PositionSizing = typeof positionSizing.$inferSelect;

export type InsertAIDailyInsight = z.infer<typeof insertAIDailyInsightSchema>;
export type AIDailyInsight = typeof aiDailyInsights.$inferSelect;

export type InsertAIAuditLog = z.infer<typeof insertAIAuditLogSchema>;
export type AIAuditLog = typeof aiAuditLogs.$inferSelect;

// Phase A Types
export type InsertPrivacyPreferences = z.infer<typeof insertPrivacyPreferencesSchema>;
export type PrivacyPreferences = typeof privacyPreferences.$inferSelect;

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

export type InsertRiskPrecheck = z.infer<typeof insertRiskPrecheckSchema>;
export type RiskPrecheck = typeof riskPrechecks.$inferSelect;

// Phase B Types
export type InsertAISuggestionOutcome = z.infer<typeof insertAISuggestionOutcomeSchema>;
export type AISuggestionOutcome = typeof aiSuggestionOutcomes.$inferSelect;

export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;

export type InsertLearningCheckpoint = z.infer<typeof insertLearningCheckpointSchema>;
export type LearningCheckpoint = typeof learningCheckpoints.$inferSelect;

export type InsertPersonalizationMetrics = z.infer<typeof insertPersonalizationMetricsSchema>;
export type PersonalizationMetrics = typeof personalizationMetrics.$inferSelect;

export type InsertTradingDnaSnapshot = z.infer<typeof insertTradingDnaSnapshotSchema>;
export type TradingDnaSnapshot = typeof tradingDnaSnapshots.$inferSelect;

// Phase C Types
export type InsertTradeJournalEntry = z.infer<typeof insertTradeJournalEntrySchema>;
export type TradeJournalEntry = typeof tradeJournalEntries.$inferSelect;

export type InsertMistakePrediction = z.infer<typeof insertMistakePredictionSchema>;
export type MistakePrediction = typeof mistakePredictions.$inferSelect;

export type InsertStrategyPerformance = z.infer<typeof insertStrategyPerformanceSchema>;
export type StrategyPerformance = typeof strategyPerformance.$inferSelect;

// Phase D Types
export type InsertWhatIfSimulation = z.infer<typeof insertWhatIfSimulationSchema>;
export type WhatIfSimulation = typeof whatIfSimulations.$inferSelect;

// Phase E Types
export type InsertAIAnalysisRun = z.infer<typeof insertAIAnalysisRunSchema>;
export type AIAnalysisRun = typeof aiAnalysisRuns.$inferSelect;

export type InsertPersonalAgent = z.infer<typeof insertPersonalAgentSchema>;
export type PersonalAgent = typeof personalAgents.$inferSelect;

export type InsertUserSettingsAudit = z.infer<typeof insertUserSettingsAuditSchema>;
export type UserSettingsAudit = typeof userSettingsAudit.$inferSelect;

// Phase 1: Chart Layout Persistence
export const chartLayouts = pgTable("chart_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  layoutName: text("layout_name").default("default").notNull(),
  symbol: text("symbol").default("BTC").notNull(),
  timeframe: text("timeframe").default("1H").notNull(), // 1M, 5M, 15M, 1H, 4H, 1D
  chartType: text("chart_type").default("candlestick").notNull(), // candlestick, line, area, heikin-ashi, renko
  indicators: jsonb("indicators").default([]).notNull(), // Array of active indicators
  drawings: jsonb("drawings").default([]).notNull(), // Trendlines, Fibs, zones
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
});

export const chartPerformanceMetrics = pgTable("chart_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  renderTime: integer("render_time").notNull(), // milliseconds
  tickUpdateLatency: integer("tick_update_latency").notNull(), // milliseconds
  orderPreviewDelay: integer("order_preview_delay"), // milliseconds
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertChartLayoutSchema = createInsertSchema(chartLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChartPerformanceMetricsSchema = createInsertSchema(chartPerformanceMetrics).omit({
  id: true,
  timestamp: true,
});

export type InsertChartLayout = z.infer<typeof insertChartLayoutSchema>;
export type ChartLayout = typeof chartLayouts.$inferSelect;

export type InsertChartPerformanceMetrics = z.infer<typeof insertChartPerformanceMetricsSchema>;
export type ChartPerformanceMetrics = typeof chartPerformanceMetrics.$inferSelect;

// Phase 2: Dashboard Layout Customization (Oct 2025)
export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  layoutName: text("layout_name").default("My Dashboard").notNull(),
  modules: jsonb("modules").default([]).notNull(), // Array of { id, visible, order, size? }
  mode: text("mode").default("simple").notNull(), // 'simple' or 'power'
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const layoutTelemetry = pgTable("layout_telemetry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(), // 'module_add', 'module_remove', 'layout_save', 'focus_mode_toggle', 'mode_switch'
  moduleId: text("module_id"), // null for layout-level events
  metadata: jsonb("metadata").default({}), // Additional event context
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLayoutTelemetrySchema = createInsertSchema(layoutTelemetry).omit({
  id: true,
  timestamp: true,
});

export type InsertDashboardLayout = z.infer<typeof insertDashboardLayoutSchema>;
export type DashboardLayout = typeof dashboardLayouts.$inferSelect;

export type InsertLayoutTelemetry = z.infer<typeof insertLayoutTelemetrySchema>;
export type LayoutTelemetry = typeof layoutTelemetry.$inferSelect;

export interface TradingDNA {
  winRate: number;
  avgProfit: number;
  totalTrades: number;
  riskScore: number;
  tradingStyle: "Aggressive" | "Conservative" | "Balanced";
}

// Phase 2.5: Trading DNA-Driven Personalization (Oct 2025)
// Adaptive suggestions based on behavior patterns
export const adaptiveSuggestions = pgTable("adaptive_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Suggestion content
  suggestionType: text("suggestion_type").notNull(), // 'module_preference', 'layout_optimization', 'workflow_improvement', 'feature_recommendation'
  title: text("title").notNull(),
  message: text("message").notNull(),
  reasoning: text("reasoning").notNull(), // Explainability - why this suggestion
  
  // Actionable data
  actionType: text("action_type").notNull(), // 'add_module', 'remove_module', 'switch_mode', 'enable_feature', 'adjust_setting'
  actionData: jsonb("action_data").notNull(), // { moduleId?, mode?, setting?, value? }
  
  // Confidence and priority
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  priority: text("priority").notNull(), // 'high', 'medium', 'low'
  
  // State tracking
  status: text("status").default("active").notNull(), // 'active', 'accepted', 'dismissed', 'pinned', 'expired'
  isPinned: boolean("is_pinned").default(false).notNull(),
  
  // Pattern context
  basedOnPattern: text("based_on_pattern"), // Which behavior pattern triggered this
  dataPoints: integer("data_points").default(0), // How many data points support this
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"), // Auto-expire old suggestions
}, (table) => [
  index("idx_suggestions_user").on(table.userId),
  index("idx_suggestions_status").on(table.status),
  index("idx_suggestions_type").on(table.suggestionType),
]);

export const suggestionResponses = pgTable("suggestion_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  suggestionId: varchar("suggestion_id").notNull().references(() => adaptiveSuggestions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Response data
  responseType: text("response_type").notNull(), // 'accept', 'dismiss', 'pin'
  feedback: text("feedback"), // Optional user feedback
  
  // Outcome tracking (for learning)
  outcomeTracked: boolean("outcome_tracked").default(false),
  outcomePositive: boolean("outcome_positive"), // Did accepting this help?
  outcomeNotes: text("outcome_notes"),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_responses_suggestion").on(table.suggestionId),
  index("idx_responses_user").on(table.userId),
]);

export const insertAdaptiveSuggestionSchema = createInsertSchema(adaptiveSuggestions).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const insertSuggestionResponseSchema = createInsertSchema(suggestionResponses).omit({
  id: true,
  timestamp: true,
});

export type InsertAdaptiveSuggestion = z.infer<typeof insertAdaptiveSuggestionSchema>;
export type AdaptiveSuggestion = typeof adaptiveSuggestions.$inferSelect;

export type InsertSuggestionResponse = z.infer<typeof insertSuggestionResponseSchema>;
export type SuggestionResponse = typeof suggestionResponses.$inferSelect;

// Phase 3: Personal AI Agent Learning & Decision Support
export const aiPersonalExamples = pgTable("ai_personal_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Context when feedback was given
  contextType: text("context_type").notNull(), // 'trade_suggestion', 'briefing', 'risk_warning', 'pattern_alert'
  contextId: varchar("context_id"), // ID of the related item (suggestion, briefing, etc.)
  
  // AI interaction data
  aiInput: jsonb("ai_input").notNull(), // What the AI analyzed (market data, user state, etc.)
  aiOutput: jsonb("ai_output").notNull(), // What the AI recommended
  aiReasoning: text("ai_reasoning"), // Why the AI made this recommendation
  
  // User feedback
  feedbackType: text("feedback_type").notNull(), // 'thumbs_up', 'thumbs_down', 'neutral'
  feedbackNotes: text("feedback_notes"), // Optional user notes about why they agreed/disagreed
  userAction: text("user_action"), // 'accepted', 'rejected', 'modified', 'ignored'
  
  // Outcome tracking (for learning)
  outcomeTracked: boolean("outcome_tracked").default(false),
  outcomePositive: boolean("outcome_positive"), // Did this turn out well?
  outcomePnL: decimal("outcome_pnl", { precision: 18, scale: 2 }), // If applicable
  outcomeNotes: text("outcome_notes"),
  
  // Privacy & sharing
  isPrivate: boolean("is_private").default(true).notNull(), // User's data is private by default
  sharedToEnsemble: boolean("shared_to_ensemble").default(false).notNull(), // Only if user opts in
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_personal_examples_user").on(table.userId),
  index("idx_personal_examples_context").on(table.contextType),
  index("idx_personal_examples_feedback").on(table.feedbackType),
]);

export const aiAgentHealth = pgTable("ai_agent_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Learning progress metrics
  totalExamples: integer("total_examples").default(0).notNull(), // Total feedback examples collected
  positiveExamples: integer("positive_examples").default(0).notNull(),
  negativeExamples: integer("negative_examples").default(0).notNull(),
  
  // Confidence score (0-100)
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).default("0").notNull(),
  
  // Readiness levels
  readinessScore: decimal("readiness_score", { precision: 5, scale: 2 }).default("0").notNull(), // 0-100
  readinessLevel: text("readiness_level").default("learning").notNull(), // 'learning', 'training', 'ready', 'expert'
  
  // Learning statistics
  avgAccuracy: decimal("avg_accuracy", { precision: 5, scale: 2 }), // How often AI was right
  recentAccuracy: decimal("recent_accuracy", { precision: 5, scale: 2 }), // Last 20 examples
  
  // Last activity
  lastFeedbackAt: timestamp("last_feedback_at"),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_health_user").on(table.userId),
]);

export const insertAIPersonalExampleSchema = createInsertSchema(aiPersonalExamples).omit({
  id: true,
  timestamp: true,
});

export const insertAIAgentHealthSchema = createInsertSchema(aiAgentHealth).omit({
  id: true,
  lastCalculatedAt: true,
  updatedAt: true,
});

export type InsertAIPersonalExample = z.infer<typeof insertAIPersonalExampleSchema>;
export type AIPersonalExample = typeof aiPersonalExamples.$inferSelect;

export type InsertAIAgentHealth = z.infer<typeof insertAIAgentHealthSchema>;
export type AIAgentHealth = typeof aiAgentHealth.$inferSelect;
