import { useEffect, useState } from "react";
import { priceSocketManager } from "@/lib/priceSocketManager";

export function useLivePrices() {
  const prices = priceSocketManager.getPrices();
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(priceSocketManager.isConnected());

  useEffect(() => {
    const unsubscribe = priceSocketManager.subscribe((newPrices, newConnected) => {
      // Convert PriceUpdate objects to simple price map
      const simpleMap: Record<string, number> = {};
      Object.entries(newPrices).forEach(([symbol, update]) => {
        simpleMap[symbol] = update.price;
      });
      setPriceMap(simpleMap);
      setIsConnected(newConnected);
    });

    return unsubscribe;
  }, []);

  return { prices: priceMap, isConnected };
}
