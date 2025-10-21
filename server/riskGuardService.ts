import { storage } from "./storage";
import type { RiskGuardSettings, PaperWallet, PaperPosition } from "@shared/schema";

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];  // Informational warnings (don't block)
  violations: string[]; // Critical violations (may block if enforcement enabled)
}

export class RiskGuardService {
  
  /**
   * Check if an order is allowed based on risk guard settings
   */
  async checkOrderAllowed(
    userId: string,
    symbol: string,
    side: "buy" | "sell",
    quantity: string,
    price: string
  ): Promise<RiskCheckResult> {
    const warnings: string[] = [];
    const violations: string[] = []; // Only blocks if enforcement is enabled
    
    // Get risk guard settings (with defaults if not set)
    const settings = await storage.getRiskGuardSettings(userId);
    if (!settings || !settings.autoPauseEnabled) {
      return { allowed: true, warnings: [], violations: [] };
    }

    // Get wallet and current positions
    const wallet = await storage.getPaperWalletByUserId(userId);
    if (!wallet) {
      return { allowed: false, reason: "Wallet not found", warnings: [], violations: ["Wallet not found"] };
    }

    const positions = await storage.getPaperPositionsByWalletId(wallet.id);
    
    // Check cooldown period (ALWAYS blocks - not optional)
    if (settings.cooldownEndTime) {
      const now = new Date();
      const cooldownEnd = new Date(settings.cooldownEndTime);
      if (now < cooldownEnd) {
        const minutesRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60));
        violations.push(
          `Trading is in cooldown period. ${minutesRemaining} minutes remaining after consecutive losses.`
        );
      }
    }

    // Only check buy orders for risk limits (sells reduce risk)
    if (side === "buy") {
      // Check max open positions (WARNING only, not enforced)
      if (positions.length >= (settings.maxOpenPositions || 5)) {
        const existingSymbolPosition = positions.find(p => p.symbol === symbol);
        if (!existingSymbolPosition) {
          warnings.push(`Maximum open positions (${settings.maxOpenPositions}) reached`);
        }
      }

      // Check max position size (WARNING only, not enforced)
      const orderValue = parseFloat(quantity) * parseFloat(price);
      const walletBalance = parseFloat(wallet.balance);
      const maxPositionByPercent = walletBalance * (parseFloat(settings.maxPositionSizePercent || "25") / 100);
      const maxPositionByAmount = parseFloat(settings.maxPositionSizeAmount || "2500");
      const maxPositionSize = Math.min(maxPositionByPercent, maxPositionByAmount);

      if (orderValue > maxPositionSize) {
        warnings.push(
          `Position size $${orderValue.toFixed(2)} exceeds max allowed $${maxPositionSize.toFixed(2)} ` +
          `(${settings.maxPositionSizePercent}% of portfolio or $${settings.maxPositionSizeAmount})`
        );
      }
      
      // Check single asset concentration (WARNING only, not enforced)
      const totalPortfolioValue = positions.reduce((sum, p) => 
        sum + (parseFloat(p.quantity) * parseFloat(p.avgPrice)), 0) + walletBalance;
      
      const existingPosition = positions.find(p => p.symbol === symbol);
      const existingValue = existingPosition ? parseFloat(existingPosition.quantity) * parseFloat(existingPosition.avgPrice) : 0;
      const newTotalValue = existingValue + orderValue;
      const assetConcentration = (newTotalValue / totalPortfolioValue) * 100;
      const maxSingleAsset = parseFloat(settings.maxSingleAssetPercent || "40");
      
      if (assetConcentration > maxSingleAsset) {
        warnings.push(
          `${symbol} concentration would be ${assetConcentration.toFixed(1)}%, exceeding max ${maxSingleAsset}% for a single asset`
        );
      }

      // Check portfolio-level limits (may warn or block based on enforcement settings)
      const portfolioCheck = await this.checkPortfolioLimits(userId, wallet, positions, settings);
      warnings.push(...portfolioCheck.warnings);
      violations.push(...portfolioCheck.violations);
    }

    // Only block if there are violations (enforcement-based)
    // Warnings are informational only
    return {
      allowed: violations.length === 0,
      reason: violations.length > 0 ? violations[0] : undefined,
      warnings,
      violations,
    };
  }

  /**
   * Check portfolio-level risk limits
   * Returns warnings by default, only violations if enforcement is enabled
   */
  async checkPortfolioLimits(
    userId: string,
    wallet: PaperWallet,
    positions: PaperPosition[],
    settings: RiskGuardSettings
  ): Promise<RiskCheckResult> {
    const warnings: string[] = [];
    const violations: string[] = [];
    
    // Calculate total portfolio value
    const walletBalance = parseFloat(wallet.balance);
    const initialBalance = 10000; // Default starting balance

    // Get all trades for P&L calculation
    const trades = await storage.getTradesByUserId(userId);
    
    // Calculate daily P&L from trades table
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.timestamp);
      tradeDate.setHours(0, 0, 0, 0);
      return tradeDate.getTime() === today.getTime() && trade.profit !== null;
    });

    const dailyPnL = todaysTrades.reduce((sum, trade) => sum + parseFloat(trade.profit || "0"), 0);
    const dailyLossPercent = (dailyPnL / initialBalance) * 100;
    const dailyLossAmount = Math.abs(dailyPnL);

    // Check max daily loss
    if (dailyPnL < 0) {
      const maxDailyLossPercent = parseFloat(settings.maxDailyLossPercent || "10");
      const maxDailyLossAmount = parseFloat(settings.maxDailyLossAmount || "1000");
      const enforceDailyLimit = settings.enforceDailyLossLimit || false;

      if (Math.abs(dailyLossPercent) > maxDailyLossPercent) {
        const message = `Daily loss ${Math.abs(dailyLossPercent).toFixed(2)}% exceeds max ${maxDailyLossPercent}%`;
        if (enforceDailyLimit) {
          violations.push(message);
        } else {
          warnings.push(message);
        }
      }

      if (dailyLossAmount > maxDailyLossAmount) {
        const message = `Daily loss $${dailyLossAmount.toFixed(2)} exceeds max $${maxDailyLossAmount}`;
        if (enforceDailyLimit) {
          violations.push(message);
        } else {
          warnings.push(message);
        }
      }
    }

    // Calculate monthly P&L from trades table
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.timestamp);
      return tradeDate >= startOfMonth && trade.profit !== null;
    });

    const monthlyPnL = monthlyTrades.reduce((sum, trade) => sum + parseFloat(trade.profit || "0"), 0);
    const monthlyLossPercent = (monthlyPnL / initialBalance) * 100;
    const monthlyLossAmount = Math.abs(monthlyPnL);

    // Check max monthly loss
    if (monthlyPnL < 0) {
      const maxMonthlyLossPercent = parseFloat(settings.maxMonthlyLossPercent || "25");
      const maxMonthlyLossAmount = parseFloat(settings.maxMonthlyLossAmount || "5000");
      const enforceMonthlyLimit = settings.enforceMonthlyLossLimit || false;

      if (Math.abs(monthlyLossPercent) > maxMonthlyLossPercent) {
        const message = `Monthly loss ${Math.abs(monthlyLossPercent).toFixed(2)}% exceeds max ${maxMonthlyLossPercent}%`;
        if (enforceMonthlyLimit) {
          violations.push(message);
        } else {
          warnings.push(message);
        }
      }

      if (monthlyLossAmount > maxMonthlyLossAmount) {
        const message = `Monthly loss $${monthlyLossAmount.toFixed(2)} exceeds max $${maxMonthlyLossAmount}`;
        if (enforceMonthlyLimit) {
          violations.push(message);
        } else {
          warnings.push(message);
        }
      }
    }

    // Check portfolio drawdown (WARNING only, not enforced)
    const currentValue = walletBalance;
    const drawdownPercent = ((initialBalance - currentValue) / initialBalance) * 100;
    const maxDrawdown = parseFloat(settings.maxPortfolioDrawdownPercent || "20");

    if (drawdownPercent > maxDrawdown) {
      warnings.push(
        `Portfolio drawdown ${drawdownPercent.toFixed(2)}% exceeds max ${maxDrawdown}%`
      );
    }

    return {
      allowed: violations.length === 0,
      warnings,
      violations,
    };
  }

  /**
   * Auto-pause trading if risk limits are violated
   */
  async enforceRiskLimits(userId: string): Promise<void> {
    const settings = await storage.getRiskGuardSettings(userId);
    if (!settings || !settings.autoPauseEnabled) {
      return;
    }

    const wallet = await storage.getPaperWalletByUserId(userId);
    if (!wallet) return;

    const positions = await storage.getPaperPositionsByWalletId(wallet.id);
    const check = await this.checkPortfolioLimits(userId, wallet, positions, settings);

    if (!check.allowed) {
      console.log(`[RISK GUARD] Auto-pausing trading for user ${userId}: ${check.violations.join(", ")}`);
      await storage.updateUserTradingStatus(userId, true);
    }
  }

  /**
   * Check for consecutive losses and trigger cooldown if needed
   */
  async checkConsecutiveLosses(userId: string): Promise<void> {
    const settings = await storage.getRiskGuardSettings(userId);
    if (!settings || !settings.autoPauseEnabled) {
      return;
    }

    // Get recent closed orders
    const orders = await storage.getPaperOrdersByUserId(userId);
    const closedOrders = orders
      .filter(o => o.status === 'filled' && o.side === 'sell')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Check last 10 trades

    // Count consecutive losses
    let consecutiveLosses = 0;
    for (const order of closedOrders) {
      // For sell orders, check if closedBy indicates a loss (stop-loss trigger)
      // Or we can use a simple heuristic based on order type
      if (order.closedBy === 'stop_loss') {
        consecutiveLosses++;
      } else if (order.closedBy === 'take_profit' || order.closedBy === 'manual') {
        // Assume manual/TP closures are profitable, break the loss streak
        break;
      }
    }

    const maxConsecutiveLosses = settings.maxConsecutiveLosses || 3;
    
    if (consecutiveLosses >= maxConsecutiveLosses) {
      // Set cooldown period
      const cooldownMinutes = settings.consecutiveLossCooldownMinutes || 60;
      const cooldownEnd = new Date();
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);

      await storage.updateRiskGuardCooldown(userId, cooldownEnd);
      await storage.updateUserTradingStatus(userId, true);

      console.log(
        `[RISK GUARD] ${consecutiveLosses} consecutive losses detected for user ${userId}. ` +
        `Trading paused for ${cooldownMinutes} minutes until ${cooldownEnd.toISOString()}`
      );
    }
  }

  /**
   * Clear cooldown if time has expired
   */
  async clearExpiredCooldown(userId: string): Promise<void> {
    const settings = await storage.getRiskGuardSettings(userId);
    if (!settings?.cooldownEndTime) {
      return;
    }

    const now = new Date();
    const cooldownEnd = new Date(settings.cooldownEndTime);

    if (now >= cooldownEnd) {
      await storage.updateRiskGuardCooldown(userId, null);
      console.log(`[RISK GUARD] Cooldown period ended for user ${userId}. Trading can resume.`);
    }
  }
}

export const riskGuardService = new RiskGuardService();
