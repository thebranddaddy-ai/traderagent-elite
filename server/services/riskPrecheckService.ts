import { storage } from "../storage";

/**
 * Risk Precheck Service
 * 
 * North Star Mission: Protect the User
 * Purpose: Validate every trade against risk limits BEFORE execution
 * 
 * This standalone service can be called:
 * 1. Before live exchange orders
 * 2. Before paper trading orders
 * 3. By AI features to check if suggestions are allowed
 */

interface OrderPayload {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price?: string;
  orderType: 'market' | 'limit';
}

interface PreCheckResult {
  allowed: boolean;
  reason?: string;
  mitigation?: string;
  warnings?: string[];
  estimatedCost?: number;
  estimatedFees?: number;
  riskScore?: number;
}

/**
 * Pre-check an order against all risk limits
 * 
 * Enforces North Star principle: "Capital before curiosity"
 * Checks:
 * - User trading status (paused?)
 * - Position size limits
 * - Daily loss limits
 * - Maximum open positions
 * - Single asset concentration
 * - Archetype-specific rules (Guardian/Adaptive/Custom)
 */
export async function precheckOrder(
  userId: string,
  orderPayload: OrderPayload,
  currentPrice: number
): Promise<PreCheckResult> {
  try {
    const warnings: string[] = [];
    
    // 1. Check if user is paused
    const user = await storage.getUser(userId);
    if (user?.tradingPaused) {
      return {
        allowed: false,
        reason: 'Trading is currently paused due to risk limits. Please review your settings.',
      };
    }

    // 2. Check archetype restrictions
    const archetype = user?.archetype || 'guardian';
    if (archetype === 'guardian') {
      // Guardian: Strictest protection
      warnings.push('Guardian mode: Extra risk protection enabled');
    }

    // 3. Calculate order cost
    const quantity = parseFloat(orderPayload.quantity);
    const price = orderPayload.price ? parseFloat(orderPayload.price) : currentPrice;
    const estimatedCost = quantity * price;
    const estimatedFees = estimatedCost * 0.001; // 0.1% fee

    // 4. Get risk settings
    const riskSettings = await storage.getRiskGuardSettings(userId);
    if (!riskSettings) {
      warnings.push('No risk settings found - using defaults');
    }

    // 5. Check position size limit
    const wallet = await storage.getPaperWalletByUserId(userId);
    if (wallet) {
      const balance = parseFloat(wallet.balance);
      const positionSizePercent = (estimatedCost / balance) * 100;
      
      const maxPositionSize = parseFloat(riskSettings?.maxPositionSizePercent || '25');
      if (positionSizePercent > maxPositionSize) {
        return {
          allowed: false,
          reason: `Order exceeds maximum position size of ${maxPositionSize}% of portfolio`,
          mitigation: `Reduce quantity to ${(balance * maxPositionSize / 100 / price).toFixed(4)} or less`,
          estimatedCost,
          estimatedFees,
        };
      }

      // Warning at 80% of limit
      if (positionSizePercent > maxPositionSize * 0.8) {
        warnings.push(`Position size is ${positionSizePercent.toFixed(1)}% - close to ${maxPositionSize}% limit`);
      }
    }

    // 6. Check max open positions (buy orders only)
    if (orderPayload.side === 'buy' && wallet) {
      const positions = await storage.getPaperPositionsByWalletId(wallet.id);
      const maxOpenPositions = parseInt((riskSettings?.maxOpenPositions || '5').toString());
      
      if (positions.length >= maxOpenPositions) {
        return {
          allowed: false,
          reason: `Maximum open positions (${maxOpenPositions}) reached`,
          mitigation: 'Close some positions before opening new ones',
          estimatedCost,
          estimatedFees,
        };
      }

      if (positions.length >= maxOpenPositions * 0.8) {
        warnings.push(`${positions.length} positions open - approaching ${maxOpenPositions} limit`);
      }
    }

    // 7. Check daily loss limit
    if (riskSettings?.maxDailyLossAmount) {
      const trades = await storage.getTradesByUserId(userId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysTrades = trades.filter((t: any) => {
        const tradeDate = new Date(t.timestamp);
        tradeDate.setHours(0, 0, 0, 0);
        return tradeDate.getTime() === today.getTime();
      });

      const todaysLoss = todaysTrades.reduce((sum: number, t: any) => {
        const profit = parseFloat(t.profit || '0');
        return sum + (profit < 0 ? Math.abs(profit) : 0);
      }, 0);

      const dailyLossLimit = parseFloat(riskSettings.maxDailyLossAmount);
      if (todaysLoss >= dailyLossLimit) {
        return {
          allowed: false,
          reason: `Daily loss limit of $${dailyLossLimit} reached`,
          mitigation: 'Stop trading for today - review what went wrong',
          estimatedCost,
          estimatedFees,
        };
      }

      if (todaysLoss >= dailyLossLimit * 0.8) {
        warnings.push(`Today's losses: $${todaysLoss.toFixed(2)} - approaching $${dailyLossLimit} limit`);
      }
    }

    // 8. Check single asset concentration (buy orders)
    if (orderPayload.side === 'buy' && wallet) {
      const maxSingleAssetPercent = parseFloat(riskSettings?.maxSingleAssetPercent || '40');
      const positions = await storage.getPaperPositionsByWalletId(wallet.id);
      
      const existingPosition = positions.find(p => p.symbol === orderPayload.symbol);
      const currentValue = existingPosition 
        ? parseFloat(existingPosition.quantity) * parseFloat(existingPosition.avgPrice)
        : 0;
      
      const newTotalValue = currentValue + estimatedCost;
      const balance = parseFloat(wallet.balance);
      const concentration = (newTotalValue / balance) * 100;

      if (concentration > maxSingleAssetPercent) {
        return {
          allowed: false,
          reason: `${orderPayload.symbol} would be ${concentration.toFixed(1)}% of portfolio (max ${maxSingleAssetPercent}%)`,
          mitigation: `Diversify into other assets or reduce ${orderPayload.symbol} position`,
          estimatedCost,
          estimatedFees,
        };
      }

      if (concentration > maxSingleAssetPercent * 0.8) {
        warnings.push(`${orderPayload.symbol} concentration: ${concentration.toFixed(1)}% - approaching ${maxSingleAssetPercent}% limit`);
      }
    }

    // 9. Calculate overall risk score
    const riskScore = calculateRiskScore(warnings.length, archetype);

    // Order allowed!
    return {
      allowed: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      estimatedCost,
      estimatedFees,
      riskScore,
      mitigation: warnings.length > 0 ? 'Consider the warnings before proceeding' : undefined,
    };

  } catch (error: any) {
    console.error('[Risk Precheck] Error:', error);
    return {
      allowed: false,
      reason: 'Unable to validate order - please try again',
    };
  }
}

/**
 * Calculate risk score based on warnings and archetype
 */
function calculateRiskScore(warningCount: number, archetype: string): number {
  let baseScore = warningCount * 20; // Each warning adds 20 points
  
  // Archetype adjustments
  if (archetype === 'guardian') {
    baseScore = Math.min(baseScore + 10, 100); // Guardian is more cautious
  } else if (archetype === 'adaptive') {
    baseScore = Math.max(baseScore - 5, 0); // Adaptive is slightly more flexible
  }
  
  return Math.min(baseScore, 100);
}

/**
 * Quick risk check for AI suggestions
 * Returns true if trade would be allowed
 */
export async function isTradeAllowed(
  userId: string,
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  currentPrice: number
): Promise<boolean> {
  const result = await precheckOrder(userId, {
    symbol,
    side,
    quantity: quantity.toString(),
    orderType: 'market',
  }, currentPrice);
  
  return result.allowed;
}
