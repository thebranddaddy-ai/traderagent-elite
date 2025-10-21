import { useEffect, useState } from "react";
import { priceSocketManager } from "@/lib/priceSocketManager";

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  marketCap?: number;
}

export function usePriceSocket() {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>(
    priceSocketManager.getPrices()
  );
  const [connected, setConnected] = useState(priceSocketManager.isConnected());

  useEffect(() => {
    const unsubscribe = priceSocketManager.subscribe((newPrices, newConnected) => {
      setPrices(newPrices);
      setConnected(newConnected);
    });

    return unsubscribe;
  }, []);

  return { prices, connected };
}
