import { storage } from "../storage";
import { getAllMarketPrices } from "./paperTrading";

export class AlertMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs: number = 10000) {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    console.log("[ALERT MONITOR] Starting price alert monitoring");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAlerts();
      } catch (error) {
        console.error("[ALERT MONITOR] Error checking alerts:", error);
      }
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("[ALERT MONITOR] Stopped price alert monitoring");
    }
  }

  private async checkAlerts() {
    const activeAlerts = await storage.getActivePriceAlerts();
    if (activeAlerts.length === 0) return;

    const currentPrices = getAllMarketPrices();

    for (const alert of activeAlerts) {
      const currentPrice = currentPrices[alert.symbol];
      if (!currentPrice) continue;

      const targetPrice = parseFloat(alert.targetPrice);
      let shouldTrigger = false;

      if (alert.condition === "above" && currentPrice >= targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === "below" && currentPrice <= targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        await storage.triggerPriceAlert(alert.id);
        console.log(`[ALERT TRIGGERED] ${alert.symbol} ${alert.condition} $${targetPrice} (current: $${currentPrice})`);
      }
    }
  }
}

export const alertMonitoringService = new AlertMonitoringService();
