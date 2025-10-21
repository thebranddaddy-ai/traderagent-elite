import { 
  type User, 
  type InsertUser,
  type UpsertUser,
  type Trade, 
  type InsertTrade,
  type PaperWallet,
  type InsertPaperWallet,
  type PaperPosition,
  type InsertPaperPosition,
  type PaperOrder,
  type InsertPaperOrder,
  type AIBriefing,
  type InsertAIBriefing,
  type RiskGuardSettings,
  type InsertRiskGuardSettings,
  type AITradeSuggestion,
  type InsertAITradeSuggestion,
  type MarketSentiment,
  type InsertMarketSentiment,
  type TradingPattern,
  type InsertTradingPattern,
  type Watchlist,
  type InsertWatchlist,
  type PriceAlert,
  type InsertPriceAlert,
  type ExchangeConnection,
  type InsertExchangeConnection,
  type ExecutionToken,
  type InsertExecutionToken,
  type AIDailyInsight,
  type InsertAIDailyInsight,
  type AIAnalysisRun,
  type InsertAIAnalysisRun,
  type PersonalAgent,
  type InsertPersonalAgent,
  type UserSettingsAudit,
  type InsertUserSettingsAudit,
  type AIPersonalExample,
  type InsertAIPersonalExample,
  type AIAgentHealth,
  type InsertAIAgentHealth
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>; // Replit Auth
  updateUserTradingStatus(userId: string, paused: boolean): Promise<void>;
  getTradesByUserId(userId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getPaperWalletByUserId(userId: string): Promise<PaperWallet | undefined>;
  createPaperWallet(wallet: InsertPaperWallet): Promise<PaperWallet>;
  updatePaperWalletBalance(walletId: string, newBalance: string): Promise<void>;
  getPaperPositionsByWalletId(walletId: string): Promise<PaperPosition[]>;
  getPaperPositionByWalletAndSymbol(walletId: string, symbol: string): Promise<PaperPosition | undefined>;
  createPaperPosition(position: InsertPaperPosition): Promise<PaperPosition>;
  updatePaperPosition(id: string, quantity: string, avgPrice: string): Promise<void>;
  updatePositionStopLossTakeProfit(id: string, stopLoss: string | null, takeProfit: string | null): Promise<void>;
  deletePaperPosition(id: string): Promise<void>;
  createPaperOrder(order: InsertPaperOrder): Promise<PaperOrder>;
  getPaperOrdersByWalletId(walletId: string): Promise<PaperOrder[]>;
  getPaperOrdersByUserId(userId: string): Promise<PaperOrder[]>;
  getPaperOrderById(orderId: string): Promise<PaperOrder | undefined>;
  cancelPaperOrder(orderId: string): Promise<void>;
  updatePaperOrder(orderId: string, quantity: string, price: string): Promise<void>;
  createAIBriefing(briefing: InsertAIBriefing): Promise<AIBriefing>;
  getLatestBriefingByUserId(userId: string): Promise<AIBriefing | undefined>;
  getAllBriefingsByUserId(userId: string): Promise<AIBriefing[]>;
  getRiskGuardSettings(userId: string): Promise<RiskGuardSettings | undefined>;
  createRiskGuardSettings(settings: InsertRiskGuardSettings): Promise<RiskGuardSettings>;
  updateRiskGuardSettings(userId: string, settings: Partial<RiskGuardSettings>): Promise<RiskGuardSettings | undefined>;
  updateRiskGuardCooldown(userId: string, cooldownEndTime: Date | null): Promise<void>;
  
  // AI Trade Suggestions
  createAITradeSuggestion(suggestion: InsertAITradeSuggestion): Promise<AITradeSuggestion>;
  getActiveSuggestionsByUserId(userId: string): Promise<AITradeSuggestion[]>;
  getAllSuggestionsByUserId(userId: string): Promise<AITradeSuggestion[]>;
  updateSuggestionStatus(id: string, status: string): Promise<void>;
  
  // Market Sentiment
  createMarketSentiment(sentiment: InsertMarketSentiment): Promise<MarketSentiment>;
  getRecentMarketSentiment(symbol: string, minutesAgo: number): Promise<MarketSentiment | undefined>;
  getLatestSentimentBySymbol(symbol: string): Promise<MarketSentiment | undefined>;
  getAllLatestSentiments(): Promise<MarketSentiment[]>;
  
  // Trading Patterns
  createTradingPattern(pattern: InsertTradingPattern): Promise<TradingPattern>;
  getPatternsByUserId(userId: string): Promise<TradingPattern[]>;
  updatePatternFrequency(id: string, frequency: number, lastOccurrence: Date): Promise<void>;

  // Watchlist
  addToWatchlist(item: InsertWatchlist): Promise<Watchlist>;
  getWatchlistByUserId(userId: string): Promise<Watchlist[]>;
  removeFromWatchlist(id: string): Promise<void>;
  getWatchlistItem(userId: string, symbol: string): Promise<Watchlist | undefined>;
  getWatchlistItemById(id: string): Promise<Watchlist | undefined>;

  // Price Alerts
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  getPriceAlertsByUserId(userId: string): Promise<PriceAlert[]>;
  getActivePriceAlerts(): Promise<PriceAlert[]>;
  getPriceAlertById(id: string): Promise<PriceAlert | undefined>;
  updatePriceAlert(id: string, updates: Partial<PriceAlert>): Promise<void>;
  deletePriceAlert(id: string): Promise<void>;
  triggerPriceAlert(id: string): Promise<void>;

  // Exchange Connections
  createExchangeConnection(connection: InsertExchangeConnection): Promise<ExchangeConnection>;
  getExchangeConnectionsByUserId(userId: string): Promise<ExchangeConnection[]>;
  getActiveExchangeConnection(userId: string, exchange: string): Promise<ExchangeConnection | undefined>;
  updateExchangeConnection(id: string, updates: Partial<ExchangeConnection>): Promise<void>;
  deleteExchangeConnection(id: string): Promise<void>;

  // Execution Tokens
  createExecutionToken(token: InsertExecutionToken): Promise<ExecutionToken>;
  getExecutionToken(token: string): Promise<ExecutionToken | undefined>;
  updateExecutionTokenStatus(token: string, status: string): Promise<void>;
  cleanExpiredTokens(): Promise<void>;

  // AI Daily Insights (Freedom Engine)
  createAIDailyInsight(insight: InsertAIDailyInsight): Promise<AIDailyInsight>;
  getAIDailyInsights(userId: string): Promise<AIDailyInsight[]>;
  getLatestInsightByType(userId: string, insightType: string): Promise<AIDailyInsight | undefined>;

  // AI Timeframe Analysis & Personal Agent (Phase E)
  createAIAnalysisRun(run: InsertAIAnalysisRun): Promise<AIAnalysisRun>;
  getAIAnalysisRuns(userId: string, limit?: number): Promise<AIAnalysisRun[]>;
  getPersonalAgent(userId: string): Promise<PersonalAgent | undefined>;
  createPersonalAgent(agent: InsertPersonalAgent): Promise<PersonalAgent>;
  updatePersonalAgent(id: string, updates: Partial<PersonalAgent>): Promise<void>;
  createUserSettingsAudit(audit: InsertUserSettingsAudit): Promise<UserSettingsAudit>;
  getUserSettingsAudit(userId: string, limit?: number): Promise<UserSettingsAudit[]>;

  // Phase 3: Personal AI Agent Learning & Decision Support
  createAIPersonalExample(example: InsertAIPersonalExample): Promise<AIPersonalExample>;
  getAIPersonalExamples(userId: string, limit?: number): Promise<AIPersonalExample[]>;
  getAIPersonalExamplesByContext(userId: string, contextType: string, limit?: number): Promise<AIPersonalExample[]>;
  updateAIPersonalExampleOutcome(id: string, outcomePositive: boolean, outcomePnL?: string, outcomeNotes?: string): Promise<void>;
  getAIAgentHealth(userId: string): Promise<AIAgentHealth | undefined>;
  createAIAgentHealth(health: InsertAIAgentHealth): Promise<AIAgentHealth>;
  updateAIAgentHealth(userId: string, updates: Partial<AIAgentHealth>): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trades: Map<string, Trade>;
  private paperWallets: Map<string, PaperWallet>;
  private paperPositions: Map<string, PaperPosition>;
  private paperOrders: Map<string, PaperOrder>;
  private aiBriefings: Map<string, AIBriefing>;
  private riskGuardSettings: Map<string, RiskGuardSettings>;

  constructor() {
    this.users = new Map();
    this.trades = new Map();
    this.paperWallets = new Map();
    this.paperPositions = new Map();
    this.paperOrders = new Map();
    this.aiBriefings = new Map();
    this.riskGuardSettings = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.phone === phone,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id, 
      username: insertUser.username ?? null,
      password: insertUser.password ?? null,
      email: insertUser.email ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      phone: null,
      totpSecret: null,
      totpEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      tradingPaused: false,
      archetype: insertUser.archetype ?? 'guardian',
      dataShareOptIn: insertUser.dataShareOptIn ?? false
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id ?? randomUUID();
    const existing = this.users.get(id);
    const user: User = {
      id,
      username: userData.username ?? existing?.username ?? null,
      password: userData.password ?? existing?.password ?? null,
      email: userData.email ?? existing?.email ?? null,
      firstName: userData.firstName ?? existing?.firstName ?? null,
      lastName: userData.lastName ?? existing?.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? existing?.profileImageUrl ?? null,
      phone: existing?.phone ?? null,
      totpSecret: existing?.totpSecret ?? null,
      totpEnabled: existing?.totpEnabled ?? false,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      tradingPaused: existing?.tradingPaused ?? false,
      archetype: userData.archetype ?? existing?.archetype ?? 'guardian',
      dataShareOptIn: userData.dataShareOptIn ?? existing?.dataShareOptIn ?? false,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserTradingStatus(userId: string, paused: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.tradingPaused = paused;
      this.users.set(userId, user);
    }
  }

  async getTradesByUserId(userId: string): Promise<Trade[]> {
    return Array.from(this.trades.values()).filter(
      (trade) => trade.userId === userId,
    );
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const trade: Trade = {
      ...insertTrade,
      id,
      timestamp: new Date(),
      profit: insertTrade.profit ?? null,
    };
    this.trades.set(id, trade);
    return trade;
  }

  async getPaperWalletByUserId(userId: string): Promise<PaperWallet | undefined> {
    return Array.from(this.paperWallets.values()).find(
      (wallet) => wallet.userId === userId
    );
  }

  async createPaperWallet(insertWallet: InsertPaperWallet): Promise<PaperWallet> {
    const id = randomUUID();
    const wallet: PaperWallet = {
      ...insertWallet,
      id,
      balance: insertWallet.balance ?? "10000",
    };
    this.paperWallets.set(id, wallet);
    return wallet;
  }

  async updatePaperWalletBalance(walletId: string, newBalance: string): Promise<void> {
    const wallet = this.paperWallets.get(walletId);
    if (wallet) {
      wallet.balance = newBalance;
      this.paperWallets.set(walletId, wallet);
    }
  }

  async getPaperPositionsByWalletId(walletId: string): Promise<PaperPosition[]> {
    return Array.from(this.paperPositions.values()).filter(
      (position) => position.walletId === walletId
    );
  }

  async getPaperPositionByWalletAndSymbol(
    walletId: string,
    symbol: string
  ): Promise<PaperPosition | undefined> {
    return Array.from(this.paperPositions.values()).find(
      (position) => position.walletId === walletId && position.symbol === symbol
    );
  }

  async createPaperPosition(insertPosition: InsertPaperPosition): Promise<PaperPosition> {
    const id = randomUUID();
    const position: PaperPosition = {
      ...insertPosition,
      id,
      stopLoss: insertPosition.stopLoss ?? null,
      takeProfit: insertPosition.takeProfit ?? null,
    };
    this.paperPositions.set(id, position);
    return position;
  }

  async updatePaperPosition(id: string, quantity: string, avgPrice: string): Promise<void> {
    const position = this.paperPositions.get(id);
    if (position) {
      position.quantity = quantity;
      position.avgPrice = avgPrice;
      this.paperPositions.set(id, position);
    }
  }

  async updatePositionStopLossTakeProfit(id: string, stopLoss: string | null, takeProfit: string | null): Promise<void> {
    const position = this.paperPositions.get(id);
    if (position) {
      position.stopLoss = stopLoss;
      position.takeProfit = takeProfit;
      this.paperPositions.set(id, position);
    }
  }

  async deletePaperPosition(id: string): Promise<void> {
    this.paperPositions.delete(id);
  }

  async createPaperOrder(insertOrder: InsertPaperOrder): Promise<PaperOrder> {
    const id = randomUUID();
    const order: PaperOrder = {
      ...insertOrder,
      id,
      status: "completed",
      timestamp: new Date(),
      price: insertOrder.price ?? null,
      stopLoss: insertOrder.stopLoss ?? null,
      takeProfit: insertOrder.takeProfit ?? null,
      closedBy: insertOrder.closedBy ?? null,
    };
    this.paperOrders.set(id, order);
    return order;
  }

  async getPaperOrdersByWalletId(walletId: string): Promise<PaperOrder[]> {
    return Array.from(this.paperOrders.values()).filter(
      (order) => order.walletId === walletId
    );
  }

  async getPaperOrdersByUserId(userId: string): Promise<PaperOrder[]> {
    const wallet = await this.getPaperWalletByUserId(userId);
    if (!wallet) {
      return [];
    }
    return this.getPaperOrdersByWalletId(wallet.id);
  }

  async createAIBriefing(insertBriefing: InsertAIBriefing): Promise<AIBriefing> {
    const id = randomUUID();
    const briefing: AIBriefing = {
      ...insertBriefing,
      id,
      timestamp: new Date(),
    };
    this.aiBriefings.set(id, briefing);
    return briefing;
  }

  async getLatestBriefingByUserId(userId: string): Promise<AIBriefing | undefined> {
    const userBriefings = Array.from(this.aiBriefings.values())
      .filter((briefing) => briefing.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return userBriefings[0];
  }

  async getAllBriefingsByUserId(userId: string): Promise<AIBriefing[]> {
    return Array.from(this.aiBriefings.values())
      .filter((briefing) => briefing.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRiskGuardSettings(userId: string): Promise<RiskGuardSettings | undefined> {
    return Array.from(this.riskGuardSettings.values()).find(
      (settings) => settings.userId === userId
    );
  }

  async createRiskGuardSettings(insertSettings: InsertRiskGuardSettings): Promise<RiskGuardSettings> {
    const id = randomUUID();
    const settings: RiskGuardSettings = {
      ...insertSettings,
      id,
      maxDailyLossPercent: insertSettings.maxDailyLossPercent ?? "10",
      maxDailyLossAmount: insertSettings.maxDailyLossAmount ?? "1000",
      maxPortfolioDrawdownPercent: insertSettings.maxPortfolioDrawdownPercent ?? "20",
      maxMonthlyLossPercent: insertSettings.maxMonthlyLossPercent ?? "25",
      maxMonthlyLossAmount: insertSettings.maxMonthlyLossAmount ?? "5000",
      maxPositionSizePercent: insertSettings.maxPositionSizePercent ?? "25",
      maxPositionSizeAmount: insertSettings.maxPositionSizeAmount ?? "2500",
      maxOpenPositions: insertSettings.maxOpenPositions ?? 5,
      maxSingleAssetPercent: insertSettings.maxSingleAssetPercent ?? "40",
      maxConsecutiveLosses: insertSettings.maxConsecutiveLosses ?? 3,
      consecutiveLossCooldownMinutes: insertSettings.consecutiveLossCooldownMinutes ?? 60,
      autoPauseEnabled: insertSettings.autoPauseEnabled ?? true,
      enforceDailyLossLimit: insertSettings.enforceDailyLossLimit ?? false,
      enforceMonthlyLossLimit: insertSettings.enforceMonthlyLossLimit ?? false,
      cooldownEndTime: insertSettings.cooldownEndTime ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.riskGuardSettings.set(id, settings);
    return settings;
  }

  async updateRiskGuardSettings(userId: string, updates: Partial<RiskGuardSettings>): Promise<RiskGuardSettings | undefined> {
    const settings = await this.getRiskGuardSettings(userId);
    if (settings) {
      const updated = { ...settings, ...updates, updatedAt: new Date() };
      this.riskGuardSettings.set(settings.id, updated);
      return updated;
    }
    return undefined;
  }

  async getPaperOrderById(orderId: string): Promise<PaperOrder | undefined> {
    return this.paperOrders.get(orderId);
  }

  async cancelPaperOrder(orderId: string): Promise<void> {
    const order = this.paperOrders.get(orderId);
    if (order) {
      order.status = "cancelled";
      this.paperOrders.set(orderId, order);
    }
  }

  async updatePaperOrder(orderId: string, quantity: string, price: string): Promise<void> {
    const order = this.paperOrders.get(orderId);
    if (order) {
      order.quantity = quantity;
      order.price = price;
      this.paperOrders.set(orderId, order);
    }
  }

  async updateRiskGuardCooldown(userId: string, cooldownEndTime: Date | null): Promise<void> {
    const settings = await this.getRiskGuardSettings(userId);
    if (settings) {
      const updated = { ...settings, cooldownEndTime, updatedAt: new Date() };
      this.riskGuardSettings.set(settings.id, updated);
    }
  }
}

// Switch between MemStorage and PostgreSQL
// export const storage = new MemStorage();

import { postgresStorage } from "./postgresStorage";
export const storage = postgresStorage;
