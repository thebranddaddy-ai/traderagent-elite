import { storage } from "../storage";
import { getMarketPrice } from "./paperTrading";
import type { PaperOrder } from "@shared/schema";

export interface TradingDNAMetrics {
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfitLoss: number;
  avgHoldTime: number; // in hours
  bestTimeframe: string; // "morning", "afternoon", "evening"
  maxDrawdown: number;
  revengeTradeScore: number; // 0-100, higher = more revenge trading
  volatilitySensitivity: number; // 0-100
  riskScore: number; // 0-100
  tradingStyle: "Aggressive" | "Conservative" | "Balanced";
  recommendedDailyLossLimit: number;
  recommendedMonthlyLossLimit: number;
  profitFactor: number; // total wins / total losses
  sharpeRatio: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  averageTradeSize: number;
}

export async function calculateTradingDNA(userId: string): Promise<TradingDNAMetrics> {
  const wallet = await storage.getPaperWalletByUserId(userId);
  
  if (!wallet) {
    // Return default metrics for users without a wallet
    return {
      winRate: 0,
      avgProfit: 0,
      avgLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfitLoss: 0,
      avgHoldTime: 0,
      bestTimeframe: "morning",
      maxDrawdown: 0,
      revengeTradeScore: 0,
      volatilitySensitivity: 50,
      riskScore: 50,
      tradingStyle: "Balanced",
      recommendedDailyLossLimit: 500,
      recommendedMonthlyLossLimit: 2000,
      profitFactor: 0,
      sharpeRatio: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      averageTradeSize: 0,
    };
  }

  const orders = await storage.getPaperOrdersByUserId(userId);
  const positions = await storage.getPaperPositionsByWalletId(wallet.id);

  // Filter only completed orders
  const completedOrders = orders.filter(order => order.status === "completed");

  if (completedOrders.length === 0) {
    // Return default metrics for users with no trades
    return {
      winRate: 0,
      avgProfit: 0,
      avgLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfitLoss: 0,
      avgHoldTime: 0,
      bestTimeframe: "morning",
      maxDrawdown: 0,
      revengeTradeScore: 0,
      volatilitySensitivity: 50,
      riskScore: 50,
      tradingStyle: "Balanced",
      recommendedDailyLossLimit: 500,
      recommendedMonthlyLossLimit: 2000,
      profitFactor: 0,
      sharpeRatio: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      averageTradeSize: 0,
    };
  }

  // Calculate P&L for each trade
  const tradesWithPnL = completedOrders.map(order => {
    const quantity = parseFloat(order.quantity);
    const orderPrice = parseFloat(order.price || "0");
    const currentPrice = getMarketPrice(order.symbol);
    
    let pnl = 0;
    if (order.side === "buy") {
      pnl = (currentPrice - orderPrice) * quantity;
    } else {
      pnl = (orderPrice - currentPrice) * quantity;
    }

    return {
      ...order,
      pnl,
      tradeSize: quantity * orderPrice,
    };
  });

  // Basic metrics
  const totalTrades = tradesWithPnL.length;
  const winningTrades = tradesWithPnL.filter(t => t.pnl > 0);
  const losingTrades = tradesWithPnL.filter(t => t.pnl < 0);
  const totalProfits = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const totalProfitLoss = totalProfits - totalLosses;
  
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
  const avgProfit = winningTrades.length > 0 ? totalProfits / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  // Profit factor (ratio of gross profit to gross loss)
  const profitFactor = totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0;

  // Average hold time (simplified - using order timestamps)
  const avgHoldTime = 24; // Default to 24 hours for now

  // Best timeframe (analyze trade times)
  const timeframes = {
    morning: 0,
    afternoon: 0,
    evening: 0,
  };

  completedOrders.forEach(order => {
    const hour = new Date(order.timestamp).getHours();
    if (hour >= 6 && hour < 12) timeframes.morning++;
    else if (hour >= 12 && hour < 18) timeframes.afternoon++;
    else timeframes.evening++;
  });

  const bestTimeframe = Object.entries(timeframes).reduce((a, b) => 
    timeframes[a[0] as keyof typeof timeframes] > timeframes[b[0] as keyof typeof timeframes] ? a : b
  )[0] as "morning" | "afternoon" | "evening";

  // Max drawdown calculation (simplified)
  let maxDrawdown = 0;
  let peak = parseFloat(wallet.balance);
  let currentBalance = peak;

  tradesWithPnL.forEach(trade => {
    currentBalance += trade.pnl;
    if (currentBalance > peak) {
      peak = currentBalance;
    }
    const drawdown = ((peak - currentBalance) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Revenge trade score (consecutive losses followed by larger position)
  let revengeTradeScore = 0;
  for (let i = 1; i < tradesWithPnL.length; i++) {
    const prevTrade = tradesWithPnL[i - 1];
    const currTrade = tradesWithPnL[i];
    
    if (prevTrade.pnl < 0 && currTrade.tradeSize > prevTrade.tradeSize * 1.5) {
      revengeTradeScore += 10;
    }
  }
  revengeTradeScore = Math.min(revengeTradeScore, 100);

  // Volatility sensitivity (based on position sizes vs price volatility)
  const avgTradeSize = tradesWithPnL.reduce((sum, t) => sum + t.tradeSize, 0) / totalTrades;
  const volatilitySensitivity = Math.min((avgTradeSize / 1000) * 50, 100);

  // Risk score (combination of factors)
  const riskScore = Math.min(
    (maxDrawdown * 2) + 
    (revengeTradeScore * 0.3) + 
    ((100 - winRate) * 0.5),
    100
  );

  // Trading style determination
  let tradingStyle: "Aggressive" | "Conservative" | "Balanced";
  if (riskScore > 60 || avgTradeSize > 2000) {
    tradingStyle = "Aggressive";
  } else if (riskScore < 40 && avgTradeSize < 1000) {
    tradingStyle = "Conservative";
  } else {
    tradingStyle = "Balanced";
  }

  // Recommended limits based on DNA
  const recommendedDailyLossLimit = tradingStyle === "Aggressive" ? 1000 : 
                                     tradingStyle === "Conservative" ? 300 : 500;
  const recommendedMonthlyLossLimit = recommendedDailyLossLimit * 20;

  // Sharpe ratio (simplified - using returns vs volatility)
  const returns = tradesWithPnL.map(t => t.pnl);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Consecutive wins/losses
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  
  tradesWithPnL.forEach(trade => {
    if (trade.pnl > 0) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
    }
  });

  // Largest win/loss
  const largestWin = Math.max(...winningTrades.map(t => t.pnl), 0);
  const largestLoss = Math.min(...losingTrades.map(t => t.pnl), 0);

  return {
    winRate: Math.round(winRate * 10) / 10,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
    avgHoldTime,
    bestTimeframe,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
    revengeTradeScore: Math.round(revengeTradeScore),
    volatilitySensitivity: Math.round(volatilitySensitivity),
    riskScore: Math.round(riskScore),
    tradingStyle,
    recommendedDailyLossLimit,
    recommendedMonthlyLossLimit,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    consecutiveWins: maxWinStreak,
    consecutiveLosses: maxLossStreak,
    largestWin: Math.round(largestWin * 100) / 100,
    largestLoss: Math.round(largestLoss * 100) / 100,
    averageTradeSize: Math.round(avgTradeSize * 100) / 100,
  };
}
