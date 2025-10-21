import { db } from "../db";
import { riskPrechecks, paperPositions, paperWallets, type InsertRiskPrecheck, type RiskPrecheck } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { riskGuardService } from "../riskGuardService";
import { calculateTradingDNA } from "./tradingDNA";
import { storage } from "../storage";

interface TradeValidation {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'market' | 'limit';
  tradeType: 'paper' | 'live';
}

export class RiskPrecheckService {
  async validateTrade(userId: string, trade: TradeValidation): Promise<RiskPrecheck> {
    const checks: any[] = [];
    const warnings: string[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    const settings = await storage.getRiskGuardSettings(userId);
    const dna = await calculateTradingDNA(userId);
    
    const wallet = await db
      .select()
      .from(paperWallets)
      .where(eq(paperWallets.userId, userId))
      .limit(1);
    
    const balance = parseFloat(wallet[0]?.balance || "0");
    const tradeValue = trade.quantity * (trade.price || 0);

    const positions = await db
      .select()
      .from(paperPositions)
      .where(eq(paperPositions.walletId, wallet[0]?.id || ''));

    const portfolioValue = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.quantity) * parseFloat(pos.avgPrice);
    }, balance);

    checks.push({
      name: 'balance_check',
      passed: balance >= tradeValue,
      message: balance >= tradeValue 
        ? 'Sufficient balance available' 
        : `Insufficient balance. Required: $${tradeValue.toFixed(2)}, Available: $${balance.toFixed(2)}`
    });

    if (balance < tradeValue) {
      blockers.push('Insufficient balance for this trade');
      riskScore += 50;
    }

    const positionSizePercent = (tradeValue / portfolioValue) * 100;
    const maxPositionPercent = parseFloat(settings?.maxPositionSizePercent || "25");
    
    checks.push({
      name: 'position_size_check',
      passed: positionSizePercent <= maxPositionPercent,
      message: `Position size: ${positionSizePercent.toFixed(1)}% of portfolio (limit: ${maxPositionPercent}%)`
    });

    if (positionSizePercent > maxPositionPercent) {
      warnings.push(`Position size exceeds ${maxPositionPercent}% limit`);
      recommendations.push(`Consider reducing position to ${maxPositionPercent}% of portfolio ($${(portfolioValue * maxPositionPercent / 100).toFixed(2)})`);
      riskScore += 25;
    }

    const existingPosition = positions.find(p => p.symbol === trade.symbol);
    const currentExposure = existingPosition ? parseFloat(existingPosition.quantity) * parseFloat(existingPosition.avgPrice) : 0;
    const newExposure = currentExposure + tradeValue;
    const concentrationRisk = (newExposure / portfolioValue) * 100;
    const maxConcentration = parseFloat(settings?.maxSingleAssetPercent || "40");

    checks.push({
      name: 'concentration_check',
      passed: concentrationRisk <= maxConcentration,
      message: `Asset concentration: ${concentrationRisk.toFixed(1)}% (limit: ${maxConcentration}%)`
    });

    if (concentrationRisk > maxConcentration) {
      warnings.push(`High concentration risk in ${trade.symbol}`);
      recommendations.push('Consider diversifying into other assets');
      riskScore += 20;
    }

    const openPositions = positions.length;
    const maxOpen = settings?.maxOpenPositions || 5;
    
    checks.push({
      name: 'max_positions_check',
      passed: openPositions < maxOpen,
      message: `Open positions: ${openPositions}/${maxOpen}`
    });

    if (openPositions >= maxOpen && !existingPosition) {
      warnings.push('Maximum open positions reached');
      recommendations.push('Close an existing position before opening new ones');
      riskScore += 15;
    }

    if (dna.winRate < 40) {
      warnings.push('Low win rate detected in trading history');
      recommendations.push('Consider smaller position sizes until win rate improves');
      riskScore += 10;
    }

    const passed = blockers.length === 0;
    const portfolioImpact = positionSizePercent;
    
    const suggestedAdjustments = !passed ? JSON.stringify({
      suggestedQuantity: (portfolioValue * maxPositionPercent / 100) / (trade.price || 1),
      suggestedStopLoss: trade.price ? trade.price * 0.95 : undefined,
      suggestedTakeProfit: trade.price ? trade.price * 1.10 : undefined,
    }) : null;

    const precheckData: InsertRiskPrecheck = {
      userId,
      tradeType: trade.tradeType,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity.toString(),
      price: trade.price?.toString(),
      orderType: trade.orderType,
      passed,
      riskScore: riskScore.toString(),
      checks: JSON.stringify(checks),
      warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
      blockers: blockers.length > 0 ? JSON.stringify(blockers) : null,
      portfolioImpact: portfolioImpact.toString(),
      concentrationRisk: concentrationRisk.toString(),
      correlationRisk: "0",
      volatilityRisk: "0",
      recommendations: JSON.stringify(recommendations),
      suggestedAdjustments,
    };

    const inserted = await db.insert(riskPrechecks).values(precheckData).returning();
    return inserted[0];
  }

  async getRecentPrechecks(userId: string, limit: number = 10): Promise<RiskPrecheck[]> {
    return await db
      .select()
      .from(riskPrechecks)
      .where(eq(riskPrechecks.userId, userId))
      .orderBy(desc(riskPrechecks.timestamp))
      .limit(limit);
  }

  async markAsExecuted(precheckId: string): Promise<void> {
    await db
      .update(riskPrechecks)
      .set({ executed: true })
      .where(eq(riskPrechecks.id, precheckId));
  }
}

export const riskPrecheckService = new RiskPrecheckService();
