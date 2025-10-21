import { useEffect, useState } from "react";
import { priceSocketManager } from "@/lib/priceSocketManager";
import { Wifi, WifiOff } from "lucide-react";

export function ConnectionHealthMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const unsubscribe = priceSocketManager.subscribe((prices, connected) => {
      setIsConnected(connected);
      if (Object.keys(prices).length > 0) {
        setLastUpdate(new Date());
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 text-xs border-t bg-background"
      data-testid="connection-health-monitor"
    >
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" data-testid="status-indicator-connected" />
            <Wifi className="w-3.5 h-3.5 text-green-500" />
            <span className="text-muted-foreground">Live WebSocket</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-yellow-500" data-testid="status-indicator-fallback" />
            <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-muted-foreground">HTTP Fallback</span>
          </>
        )}
      </div>
      <span className="text-muted-foreground/60 ml-auto">
        Last update: {lastUpdate.toLocaleTimeString()}
      </span>
    </div>
  );
}
