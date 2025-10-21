import { db } from "./db";
import { eq, desc, and, lt } from "drizzle-orm";
import {
  users,
  trades,
  paperWallets,
  paperPositions,
  paperOrders,
  aiBriefings,
  riskGuardSettings,
  aiTradeSuggestions,
  marketSentiment,
  tradingPatterns,
  watchlist,
  priceAlerts,
  exchangeConnections,
  executionTokens,
  aiDailyInsights,
  aiAnalysisRuns,
  personalAgents,
  userSettingsAudit,
  aiPersonalExamples,
  aiAgentHealth,
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
  type InsertAIAgentHealth,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Replit Auth: Upsert user on login
  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async updateUserTradingStatus(userId: string, paused: boolean): Promise<void> {
    await db.update(users).set({ tradingPaused: paused }).where(eq(users.id, userId));
  }

  async getTradesByUserId(userId: string): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.timestamp));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const result = await db.insert(trades).values(trade).returning();
    return result[0];
  }

  async getPaperWalletByUserId(userId: string): Promise<PaperWallet | undefined> {
    const result = await db.select().from(paperWallets).where(eq(paperWallets.userId, userId)).limit(1);
    return result[0];
  }

  async createPaperWallet(wallet: InsertPaperWallet): Promise<PaperWallet> {
    const result = await db.insert(paperWallets).values(wallet).returning();
    return result[0];
  }

  async updatePaperWalletBalance(walletId: string, newBalance: string): Promise<void> {
    await db.update(paperWallets).set({ balance: newBalance }).where(eq(paperWallets.id, walletId));
  }

  async getPaperPositionsByWalletId(walletId: string): Promise<PaperPosition[]> {
    return db.select().from(paperPositions).where(eq(paperPositions.walletId, walletId));
  }

  async getPaperPositionByWalletAndSymbol(
    walletId: string,
    symbol: string
  ): Promise<PaperPosition | undefined> {
    const result = await db
      .select()
      .from(paperPositions)
      .where(and(eq(paperPositions.walletId, walletId), eq(paperPositions.symbol, symbol)))
      .limit(1);
    return result[0];
  }

  async createPaperPosition(position: InsertPaperPosition): Promise<PaperPosition> {
    const result = await db.insert(paperPositions).values(position).returning();
    return result[0];
  }

  async updatePaperPosition(id: string, quantity: string, avgPrice: string): Promise<void> {
    await db.update(paperPositions).set({ quantity, avgPrice }).where(eq(paperPositions.id, id));
  }

  async updatePositionStopLossTakeProfit(
    id: string,
    stopLoss: string | null,
    takeProfit: string | null
  ): Promise<void> {
    await db
      .update(paperPositions)
      .set({ stopLoss, takeProfit })
      .where(eq(paperPositions.id, id));
  }

  async deletePaperPosition(id: string): Promise<void> {
    await db.delete(paperPositions).where(eq(paperPositions.id, id));
  }

  async createPaperOrder(order: InsertPaperOrder): Promise<PaperOrder> {
    const result = await db.insert(paperOrders).values(order).returning();
    return result[0];
  }

  async getPaperOrdersByWalletId(walletId: string): Promise<PaperOrder[]> {
    return db.select().from(paperOrders).where(eq(paperOrders.walletId, walletId)).orderBy(desc(paperOrders.timestamp));
  }

  async getPaperOrdersByUserId(userId: string): Promise<PaperOrder[]> {
    const wallet = await this.getPaperWalletByUserId(userId);
    if (!wallet) {
      return [];
    }
    return this.getPaperOrdersByWalletId(wallet.id);
  }

  async createAIBriefing(briefing: InsertAIBriefing): Promise<AIBriefing> {
    const result = await db.insert(aiBriefings).values(briefing).returning();
    return result[0];
  }

  async getLatestBriefingByUserId(userId: string): Promise<AIBriefing | undefined> {
    const result = await db
      .select()
      .from(aiBriefings)
      .where(eq(aiBriefings.userId, userId))
      .orderBy(desc(aiBriefings.timestamp))
      .limit(1);
    return result[0];
  }

  async getAllBriefingsByUserId(userId: string): Promise<AIBriefing[]> {
    return db
      .select()
      .from(aiBriefings)
      .where(eq(aiBriefings.userId, userId))
      .orderBy(desc(aiBriefings.timestamp));
  }

  async getRiskGuardSettings(userId: string): Promise<RiskGuardSettings | undefined> {
    const result = await db
      .select()
      .from(riskGuardSettings)
      .where(eq(riskGuardSettings.userId, userId))
      .limit(1);
    return result[0];
  }

  async createRiskGuardSettings(settings: InsertRiskGuardSettings): Promise<RiskGuardSettings> {
    const result = await db.insert(riskGuardSettings).values(settings).returning();
    return result[0];
  }

  async updateRiskGuardSettings(userId: string, updates: Partial<RiskGuardSettings>): Promise<RiskGuardSettings | undefined> {
    const result = await db
      .update(riskGuardSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(riskGuardSettings.userId, userId))
      .returning();
    return result[0];
  }

  async updateRiskGuardCooldown(userId: string, cooldownEndTime: Date | null): Promise<void> {
    await db
      .update(riskGuardSettings)
      .set({ cooldownEndTime, updatedAt: new Date() })
      .where(eq(riskGuardSettings.userId, userId));
  }

  async getPaperOrderById(orderId: string): Promise<PaperOrder | undefined> {
    const result = await db.select().from(paperOrders).where(eq(paperOrders.id, orderId)).limit(1);
    return result[0];
  }

  async cancelPaperOrder(orderId: string): Promise<void> {
    await db.update(paperOrders).set({ status: "cancelled" }).where(eq(paperOrders.id, orderId));
  }

  async updatePaperOrder(orderId: string, quantity: string, price: string): Promise<void> {
    await db.update(paperOrders).set({ quantity, price }).where(eq(paperOrders.id, orderId));
  }

  // AI Trade Suggestions
  async createAITradeSuggestion(suggestion: InsertAITradeSuggestion): Promise<AITradeSuggestion> {
    const result = await db.insert(aiTradeSuggestions).values(suggestion).returning();
    return result[0];
  }

  async getActiveSuggestionsByUserId(userId: string): Promise<AITradeSuggestion[]> {
    return await db
      .select()
      .from(aiTradeSuggestions)
      .where(and(eq(aiTradeSuggestions.userId, userId), eq(aiTradeSuggestions.status, "active")))
      .orderBy(desc(aiTradeSuggestions.timestamp));
  }

  async getAllSuggestionsByUserId(userId: string): Promise<AITradeSuggestion[]> {
    return await db
      .select()
      .from(aiTradeSuggestions)
      .where(eq(aiTradeSuggestions.userId, userId))
      .orderBy(desc(aiTradeSuggestions.timestamp));
  }

  async updateSuggestionStatus(id: string, status: string): Promise<void> {
    await db.update(aiTradeSuggestions).set({ status }).where(eq(aiTradeSuggestions.id, id));
  }

  // Market Sentiment
  async createMarketSentiment(sentiment: InsertMarketSentiment): Promise<MarketSentiment> {
    const result = await db.insert(marketSentiment).values(sentiment).returning();
    return result[0];
  }

  async getRecentMarketSentiment(symbol: string, minutesAgo: number): Promise<MarketSentiment | undefined> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    const result = await db
      .select()
      .from(marketSentiment)
      .where(and(eq(marketSentiment.symbol, symbol)))
      .orderBy(desc(marketSentiment.timestamp))
      .limit(1);
    
    if (result[0] && new Date(result[0].timestamp) >= cutoffTime) {
      return result[0];
    }
    return undefined;
  }

  async getLatestSentimentBySymbol(symbol: string): Promise<MarketSentiment | undefined> {
    const result = await db
      .select()
      .from(marketSentiment)
      .where(eq(marketSentiment.symbol, symbol))
      .orderBy(desc(marketSentiment.timestamp))
      .limit(1);
    return result[0];
  }

  async getAllLatestSentiments(): Promise<MarketSentiment[]> {
    const symbols = ['BTC', 'ETH', 'SOL'];
    const sentiments: MarketSentiment[] = [];

    for (const symbol of symbols) {
      const sentiment = await this.getLatestSentimentBySymbol(symbol);
      if (sentiment) {
        sentiments.push(sentiment);
      }
    }

    return sentiments;
  }

  // Trading Patterns
  async createTradingPattern(pattern: InsertTradingPattern): Promise<TradingPattern> {
    const result = await db.insert(tradingPatterns).values(pattern).returning();
    return result[0];
  }

  async getPatternsByUserId(userId: string): Promise<TradingPattern[]> {
    return await db
      .select()
      .from(tradingPatterns)
      .where(eq(tradingPatterns.userId, userId))
      .orderBy(desc(tradingPatterns.detectedAt));
  }

  async updatePatternFrequency(id: string, frequency: number, lastOccurrence: Date): Promise<void> {
    await db
      .update(tradingPatterns)
      .set({ frequency, lastOccurrence })
      .where(eq(tradingPatterns.id, id));
  }

  // Watchlist
  async addToWatchlist(item: InsertWatchlist): Promise<Watchlist> {
    const result = await db.insert(watchlist).values(item).returning();
    return result[0];
  }

  async getWatchlistByUserId(userId: string): Promise<Watchlist[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.addedAt));
  }

  async removeFromWatchlist(id: string): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
  }

  async getWatchlistItem(userId: string, symbol: string): Promise<Watchlist | undefined> {
    const result = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol)))
      .limit(1);
    return result[0];
  }

  async getWatchlistItemById(id: string): Promise<Watchlist | undefined> {
    const result = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.id, id))
      .limit(1);
    return result[0];
  }

  // Price Alerts
  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const result = await db.insert(priceAlerts).values(alert).returning();
    return result[0];
  }

  async getPriceAlertsByUserId(userId: string): Promise<PriceAlert[]> {
    return await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));
  }

  async getActivePriceAlerts(): Promise<PriceAlert[]> {
    return await db
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.isActive, true), eq(priceAlerts.triggered, false)));
  }

  async updatePriceAlert(id: string, updates: Partial<PriceAlert>): Promise<void> {
    await db.update(priceAlerts).set(updates).where(eq(priceAlerts.id, id));
  }

  async deletePriceAlert(id: string): Promise<void> {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
  }

  async triggerPriceAlert(id: string): Promise<void> {
    await db
      .update(priceAlerts)
      .set({ triggered: true, triggeredAt: new Date(), isActive: false })
      .where(eq(priceAlerts.id, id));
  }

  async getPriceAlertById(id: string): Promise<PriceAlert | undefined> {
    const result = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.id, id))
      .limit(1);
    return result[0];
  }

  // Exchange Connections
  async createExchangeConnection(connection: InsertExchangeConnection): Promise<ExchangeConnection> {
    const result = await db.insert(exchangeConnections).values(connection).returning();
    return result[0];
  }

  async getExchangeConnectionsByUserId(userId: string): Promise<ExchangeConnection[]> {
    return await db
      .select()
      .from(exchangeConnections)
      .where(eq(exchangeConnections.userId, userId))
      .orderBy(desc(exchangeConnections.createdAt));
  }

  async getActiveExchangeConnection(userId: string, exchange: string): Promise<ExchangeConnection | undefined> {
    const result = await db
      .select()
      .from(exchangeConnections)
      .where(
        and(
          eq(exchangeConnections.userId, userId),
          eq(exchangeConnections.exchange, exchange),
          eq(exchangeConnections.isActive, true)
        )
      )
      .limit(1);
    return result[0];
  }

  async updateExchangeConnection(id: string, updates: Partial<ExchangeConnection>): Promise<void> {
    await db
      .update(exchangeConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(exchangeConnections.id, id));
  }

  async deleteExchangeConnection(id: string): Promise<void> {
    await db.delete(exchangeConnections).where(eq(exchangeConnections.id, id));
  }

  // Execution Tokens
  async createExecutionToken(tokenData: InsertExecutionToken): Promise<ExecutionToken> {
    const result = await db.insert(executionTokens).values(tokenData).returning();
    return result[0];
  }

  async getExecutionToken(token: string): Promise<ExecutionToken | undefined> {
    const result = await db
      .select()
      .from(executionTokens)
      .where(eq(executionTokens.token, token))
      .limit(1);
    return result[0];
  }

  async updateExecutionTokenStatus(token: string, status: string): Promise<void> {
    await db
      .update(executionTokens)
      .set({ status })
      .where(eq(executionTokens.token, token));
  }

  async cleanExpiredTokens(): Promise<void> {
    await db
      .delete(executionTokens)
      .where(lt(executionTokens.expiresAt, new Date()));
  }

  // AI Daily Insights (Freedom Engine)
  async createAIDailyInsight(insight: InsertAIDailyInsight): Promise<AIDailyInsight> {
    const result = await db.insert(aiDailyInsights).values(insight).returning();
    return result[0];
  }

  async getAIDailyInsights(userId: string): Promise<AIDailyInsight[]> {
    const result = await db
      .select()
      .from(aiDailyInsights)
      .where(eq(aiDailyInsights.userId, userId))
      .orderBy(desc(aiDailyInsights.timestamp))
      .limit(30); // Last 30 insights (10 days worth)
    return result;
  }

  async getLatestInsightByType(userId: string, insightType: string): Promise<AIDailyInsight | undefined> {
    const result = await db
      .select()
      .from(aiDailyInsights)
      .where(
        and(
          eq(aiDailyInsights.userId, userId),
          eq(aiDailyInsights.insightType, insightType)
        )
      )
      .orderBy(desc(aiDailyInsights.timestamp))
      .limit(1);
    return result[0];
  }

  // AI Timeframe Analysis & Personal Agent (Phase E)
  async createAIAnalysisRun(run: InsertAIAnalysisRun): Promise<AIAnalysisRun> {
    const result = await db.insert(aiAnalysisRuns).values(run).returning();
    return result[0];
  }

  async getAIAnalysisRuns(userId: string, limit: number = 10): Promise<AIAnalysisRun[]> {
    const result = await db
      .select()
      .from(aiAnalysisRuns)
      .where(eq(aiAnalysisRuns.userId, userId))
      .orderBy(desc(aiAnalysisRuns.createdAt))
      .limit(limit);
    return result;
  }

  async getPersonalAgent(userId: string): Promise<PersonalAgent | undefined> {
    const result = await db
      .select()
      .from(personalAgents)
      .where(eq(personalAgents.userId, userId))
      .limit(1);
    return result[0];
  }

  async createPersonalAgent(agent: InsertPersonalAgent): Promise<PersonalAgent> {
    const result = await db.insert(personalAgents).values(agent).returning();
    return result[0];
  }

  async updatePersonalAgent(id: string, updates: Partial<PersonalAgent>): Promise<void> {
    await db
      .update(personalAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(personalAgents.id, id));
  }

  async createUserSettingsAudit(audit: InsertUserSettingsAudit): Promise<UserSettingsAudit> {
    const result = await db.insert(userSettingsAudit).values(audit).returning();
    return result[0];
  }

  async getUserSettingsAudit(userId: string, limit: number = 20): Promise<UserSettingsAudit[]> {
    const result = await db
      .select()
      .from(userSettingsAudit)
      .where(eq(userSettingsAudit.userId, userId))
      .orderBy(desc(userSettingsAudit.createdAt))
      .limit(limit);
    return result;
  }

  // Phase 3: Personal AI Agent Learning & Decision Support
  async createAIPersonalExample(example: InsertAIPersonalExample): Promise<AIPersonalExample> {
    const result = await db.insert(aiPersonalExamples).values(example).returning();
    return result[0];
  }

  async getAIPersonalExamples(userId: string, limit: number = 50): Promise<AIPersonalExample[]> {
    const result = await db
      .select()
      .from(aiPersonalExamples)
      .where(eq(aiPersonalExamples.userId, userId))
      .orderBy(desc(aiPersonalExamples.timestamp))
      .limit(limit);
    return result;
  }

  async getAIPersonalExamplesByContext(userId: string, contextType: string, limit: number = 50): Promise<AIPersonalExample[]> {
    const result = await db
      .select()
      .from(aiPersonalExamples)
      .where(
        and(
          eq(aiPersonalExamples.userId, userId),
          eq(aiPersonalExamples.contextType, contextType)
        )
      )
      .orderBy(desc(aiPersonalExamples.timestamp))
      .limit(limit);
    return result;
  }

  async updateAIPersonalExampleOutcome(
    id: string, 
    outcomePositive: boolean, 
    outcomePnL?: string, 
    outcomeNotes?: string
  ): Promise<void> {
    await db
      .update(aiPersonalExamples)
      .set({ 
        outcomeTracked: true,
        outcomePositive,
        outcomePnL,
        outcomeNotes
      })
      .where(eq(aiPersonalExamples.id, id));
  }

  async getAIAgentHealth(userId: string): Promise<AIAgentHealth | undefined> {
    const result = await db
      .select()
      .from(aiAgentHealth)
      .where(eq(aiAgentHealth.userId, userId))
      .limit(1);
    return result[0];
  }

  async createAIAgentHealth(health: InsertAIAgentHealth): Promise<AIAgentHealth> {
    const result = await db.insert(aiAgentHealth).values(health).returning();
    return result[0];
  }

  async updateAIAgentHealth(userId: string, updates: Partial<AIAgentHealth>): Promise<void> {
    await db
      .update(aiAgentHealth)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiAgentHealth.userId, userId));
  }
}

export const postgresStorage = new PostgresStorage();
