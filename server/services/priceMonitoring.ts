import { storage } from "../storage";
import { getMarketPrice } from "./paperTrading";

export async function checkStopLossTakeProfit(userId: string): Promise<void> {
  const wallet = await storage.getPaperWalletByUserId(userId);
  if (!wallet) return;

  const positions = await storage.getPaperPositionsByWalletId(wallet.id);

  for (const position of positions) {
    const currentPrice = getMarketPrice(position.symbol);
    const stopLoss = position.stopLoss ? parseFloat(position.stopLoss) : null;
    const takeProfit = position.takeProfit ? parseFloat(position.takeProfit) : null;

    if (stopLoss && currentPrice <= stopLoss) {
      console.log(`🛡️ STOP-LOSS TRIGGERED! ${position.symbol} hit $${currentPrice} (SL: $${stopLoss})`);
      await executeTriggerOrder(position.id, wallet, position.symbol, position.quantity, currentPrice, "stop_loss");
    } else if (takeProfit && currentPrice >= takeProfit) {
      console.log(`🎯 TAKE-PROFIT TRIGGERED! ${position.symbol} hit $${currentPrice} (TP: $${takeProfit})`);
      await executeTriggerOrder(position.id, wallet, position.symbol, position.quantity, currentPrice, "take_profit");
    }
  }
}

async function executeTriggerOrder(
  positionId: string,
  wallet: any,
  symbol: string,
  quantity: string,
  price: number,
  closedBy: "stop_loss" | "take_profit"
): Promise<void> {
  const quantityNum = parseFloat(quantity);
  const total = quantityNum * price;

  const balanceNum = parseFloat(wallet.balance);
  const newBalance = (balanceNum + total).toFixed(2);
  await storage.updatePaperWalletBalance(wallet.id, newBalance);

  await storage.createPaperOrder({
    walletId: wallet.id,
    symbol,
    side: "sell",
    orderType: "market",
    quantity,
    price: price.toFixed(2),
    closedBy,
  });

  await storage.deletePaperPosition(positionId);
  
  console.log(`✅ Auto-sold ${quantity} ${symbol} @ $${price} via ${closedBy.toUpperCase()} | New balance: $${newBalance}`);
}

export function startPriceMonitoring(userId: string, intervalMs: number = 5000): NodeJS.Timeout {
  return setInterval(() => {
    checkStopLossTakeProfit(userId).catch(console.error);
  }, intervalMs);
}
