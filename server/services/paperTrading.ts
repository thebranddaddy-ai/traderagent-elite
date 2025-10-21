import { storage } from "../storage";
import type { PaperWallet, PaperPosition, InsertPaperOrder } from "@shared/schema";
import { aiTradeJournal } from "./aiTradeJournal";

// Live market prices (initialized from Binance API)
const MARKET_PRICES: Record<string, number> = {
  BTC: 109000,
  ETH: 3996,
  SOL: 190,
  XRP: 2.40,
  ADA: 0.66,
  LINK: 17.45,
  AVAX: 20.73,
  DOT: 3.02,
  MATIC: 0.28,
};

export function getMarketPrice(symbol: string): number {
  return MARKET_PRICES[symbol.toUpperCase()] || 100;
}

export function setMarketPrice(symbol: string, price: number): void {
  MARKET_PRICES[symbol.toUpperCase()] = price;
  console.log(`[PRICE UPDATE] ${symbol} -> $${price}`);
}

export function getAllMarketPrices(): Record<string, number> {
  return { ...MARKET_PRICES };
}

export async function initializePaperWallet(userId: string): Promise<PaperWallet> {
  const existingWallet = await storage.getPaperWalletByUserId(userId);
  
  if (existingWallet) {
    return existingWallet;
  }

  const newWallet = await storage.createPaperWallet({
    userId,
    balance: "10000",
  });

  // Create default risk guard settings for new users
  const existingSettings = await storage.getRiskGuardSettings(userId);
  if (!existingSettings) {
    await storage.createRiskGuardSettings({ userId });
    console.log(`[RISK GUARD] Created default settings for user ${userId}`);
  }

  return newWallet;
}

export async function getPaperWalletWithPositions(userId: string) {
  const wallet = await initializePaperWallet(userId);
  const positions = await storage.getPaperPositionsByWalletId(wallet.id);

  // Enrich positions with current market prices and P&L
  const enrichedPositions = positions.map(position => {
    const currentPrice = getMarketPrice(position.symbol);
    const avgPrice = parseFloat(position.avgPrice);
    const quantity = parseFloat(position.quantity);
    const pnl = (currentPrice - avgPrice) * quantity;
    const pnlPercent = ((currentPrice - avgPrice) / avgPrice) * 100;

    return {
      ...position,
      currentPrice: currentPrice.toFixed(2),
      pnl: pnl.toFixed(2),
      pnlPercent: pnlPercent.toFixed(2),
    };
  });

  return {
    wallet,
    positions: enrichedPositions,
  };
}

export async function executeMarketOrder(
  userId: string,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
  stopLoss?: string,
  takeProfit?: string
): Promise<{ success: boolean; error?: string }> {
  const wallet = await initializePaperWallet(userId);
  const marketPrice = getMarketPrice(symbol);
  const quantityNum = parseFloat(quantity);
  const total = quantityNum * marketPrice;

  if (side === "buy") {
    const balanceNum = parseFloat(wallet.balance);

    if (balanceNum < total) {
      return { success: false, error: "Insufficient balance" };
    }

    const newBalance = (balanceNum - total).toFixed(2);
    await storage.updatePaperWalletBalance(wallet.id, newBalance);

    const existingPosition = await storage.getPaperPositionByWalletAndSymbol(
      wallet.id,
      symbol
    );

    if (existingPosition) {
      const existingQty = parseFloat(existingPosition.quantity);
      const existingAvgPrice = parseFloat(existingPosition.avgPrice);
      const newQty = existingQty + quantityNum;
      const newAvgPrice = (
        (existingQty * existingAvgPrice + quantityNum * marketPrice) /
        newQty
      ).toFixed(2);

      await storage.updatePaperPosition(
        existingPosition.id,
        newQty.toString(),
        newAvgPrice
      );
      
      if (stopLoss || takeProfit) {
        await storage.updatePositionStopLossTakeProfit(
          existingPosition.id,
          stopLoss || null,
          takeProfit || null
        );
      }
    } else {
      await storage.createPaperPosition({
        walletId: wallet.id,
        symbol,
        quantity: quantityNum.toString(),
        avgPrice: marketPrice.toFixed(2),
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
      });
    }

    await storage.createPaperOrder({
      walletId: wallet.id,
      symbol,
      side,
      orderType: "market",
      quantity: quantityNum.toString(),
      price: marketPrice.toFixed(2),
      status: "completed",
    });

    return { success: true };
  } else if (side === "sell") {
    const existingPosition = await storage.getPaperPositionByWalletAndSymbol(
      wallet.id,
      symbol
    );

    if (!existingPosition) {
      return { success: false, error: "No position to sell" };
    }

    const existingQty = parseFloat(existingPosition.quantity);

    if (existingQty < quantityNum) {
      return { success: false, error: "Insufficient position quantity" };
    }

    const balanceNum = parseFloat(wallet.balance);
    const newBalance = (balanceNum + total).toFixed(2);
    await storage.updatePaperWalletBalance(wallet.id, newBalance);

    const newQty = existingQty - quantityNum;

    if (newQty === 0) {
      await storage.deletePaperPosition(existingPosition.id);
    } else {
      await storage.updatePaperPosition(
        existingPosition.id,
        newQty.toString(),
        existingPosition.avgPrice
      );
    }

    const order = await storage.createPaperOrder({
      walletId: wallet.id,
      symbol,
      side,
      orderType: "market",
      quantity: quantityNum.toString(),
      price: marketPrice.toFixed(2),
      status: "completed",
    });

    // Log completed trade to AI Trade Journal
    const avgPrice = parseFloat(existingPosition.avgPrice);
    const profitLoss = (marketPrice - avgPrice) * quantityNum;
    const profitLossPercent = ((marketPrice - avgPrice) / avgPrice) * 100;

    try {
      await aiTradeJournal.logTrade({
        userId,
        tradeId: order.id,
        tradeType: 'paper',
        symbol,
        side,
        entryPrice: avgPrice,
        exitPrice: marketPrice,
        quantity: quantityNum,
        profitLoss,
        profitLossPercent,
      });
      console.log(`[TRADE JOURNAL] Logged trade ${order.id} for user ${userId}`);
    } catch (error) {
      console.error('[TRADE JOURNAL] Failed to log trade:', error);
      // Don't fail the order if journal logging fails
    }

    return { success: true };
  }

  return { success: false, error: "Invalid order side" };
}

export async function executeLimitOrder(
  userId: string,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
  price: string,
  stopLoss?: string,
  takeProfit?: string
): Promise<{ success: boolean; error?: string }> {
  const wallet = await initializePaperWallet(userId);
  const priceNum = parseFloat(price);
  const quantityNum = parseFloat(quantity);
  const total = quantityNum * priceNum;

  // Validate funds for buy orders
  if (side === "buy") {
    const balanceNum = parseFloat(wallet.balance);

    if (balanceNum < total) {
      return { success: false, error: "Insufficient balance" };
    }
  } else if (side === "sell") {
    // Validate position for sell orders
    const existingPosition = await storage.getPaperPositionByWalletAndSymbol(
      wallet.id,
      symbol
    );

    if (!existingPosition) {
      return { success: false, error: "No position to sell" };
    }

    const existingQty = parseFloat(existingPosition.quantity);

    if (existingQty < quantityNum) {
      return { success: false, error: "Insufficient position quantity" };
    }
  }

  // For limit orders, only create a pending order - don't execute immediately
  // The order will be executed by the price monitoring service when price matches
  await storage.createPaperOrder({
    walletId: wallet.id,
    symbol,
    side,
    orderType: "limit",
    quantity,
    price,
    stopLoss: stopLoss || undefined,
    takeProfit: takeProfit || undefined,
  });

  return { success: true };
}
