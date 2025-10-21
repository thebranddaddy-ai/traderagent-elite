// Shared WebSocket manager for price updates
// Ensures only ONE WebSocket connection across entire application

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  marketCap?: number;
}

interface PriceSocketMessage {
  type: "prices" | "pong";
  data?: PriceUpdate[];
}

const MIN_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 8000; // 8 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PONG_TIMEOUT = 5000; // 5 seconds

class PriceSocketManager {
  private ws: WebSocket | null = null;
  private prices: Record<string, PriceUpdate> = {};
  private connected = false;
  private reconnectTimeout?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private pongTimeout?: NodeJS.Timeout;
  private retryCount = 0;
  private subscribers = new Set<(prices: Record<string, PriceUpdate>, connected: boolean) => void>();

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.prices, this.connected));
  }

  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = undefined;
    }
  }

  private sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "ping" }));
      
      this.pongTimeout = setTimeout(() => {
        console.warn("[WS Manager] Pong timeout - reconnecting");
        this.ws?.close();
      }, PONG_TIMEOUT);
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    
    setTimeout(() => {
      this.sendPing();
    }, 100);
    
    this.heartbeatInterval = setInterval(() => {
      this.sendPing();
    }, HEARTBEAT_INTERVAL);
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("[WS Manager] Connection already active, skipping...");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/prices`;
    
    console.log("[WS Manager] Connecting to", wsUrl);
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log("[WS Manager] ✅ Connected successfully");
      this.connected = true;
      this.retryCount = 0;
      this.notifySubscribers();
      
      // Server sends initial prices automatically
      // Start heartbeat to respond to server pings
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        console.log("[WS Manager] ✅ Message received, length:", event.data.length);
        console.log("[WS Manager] Raw data preview:", event.data.substring(0, 200));
        
        const message: PriceSocketMessage = JSON.parse(event.data);
        console.log("[WS Manager] ✅ Message parsed successfully, type:", message.type);
        
        if (message.type === "pong") {
          console.log("[WS Manager] Pong received");
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = undefined;
          }
        } else if (message.type === "prices" && message.data) {
          console.log("[WS Manager] ✅ Prices received, count:", message.data.length);
          console.log("[WS Manager] First price:", message.data[0]);
          
          const priceMap: Record<string, PriceUpdate> = {};
          message.data.forEach((update) => {
            priceMap[update.symbol] = update;
          });
          
          this.prices = priceMap;
          console.log("[WS Manager] ✅ Prices map created:", Object.keys(priceMap));
          
          this.notifySubscribers();
          console.log("[WS Manager] ✅ Subscribers notified successfully");
        } else {
          console.warn("[WS Manager] Unknown message type or missing data:", message);
        }
      } catch (error) {
        console.error("[WS Manager] ❌ Error in onmessage:", error);
        console.error("[WS Manager] Stack:", error instanceof Error ? error.stack : 'no stack');
      }
    };

    ws.onerror = (error) => {
      console.error("[WS Manager] ❌ WebSocket error event:", error);
      console.error("[WS Manager] Error type:", error.type);
      console.error("[WS Manager] Current readyState:", ws.readyState);
    };

    ws.onclose = (event) => {
      console.log(`[WS Manager] ⚠️ Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
      console.log(`[WS Manager] Was clean: ${event.wasClean}, readyState: ${ws.readyState}`);
      
      this.connected = false;
      this.clearHeartbeat();
      this.notifySubscribers();
      
      if (event.code === 1000) {
        console.log("[WS Manager] Normal closure, not reconnecting");
        return;
      }
      
      const delay = Math.min(
        MIN_RETRY_DELAY * Math.pow(2, this.retryCount),
        MAX_RETRY_DELAY
      );
      
      this.retryCount++;
      
      console.log(`[WS Manager] 🔄 Reconnecting in ${delay}ms (attempt ${this.retryCount})...`);
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    };
  }

  subscribe(callback: (prices: Record<string, PriceUpdate>, connected: boolean) => void) {
    this.subscribers.add(callback);
    
    if (this.subscribers.size === 1) {
      console.log("[WS Manager] First subscriber, initializing connection");
      this.connect();
    } else {
      console.log(`[WS Manager] Subscriber added (total: ${this.subscribers.size})`);
      // Immediately notify new subscriber with current state
      callback(this.prices, this.connected);
    }

    return () => {
      this.subscribers.delete(callback);
      console.log(`[WS Manager] Subscriber removed (total: ${this.subscribers.size})`);
      
      if (this.subscribers.size === 0) {
        console.log("[WS Manager] Last subscriber removed, closing connection");
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        this.clearHeartbeat();
        if (this.ws) {
          this.ws.close(1000, "All subscribers removed");
          this.ws = null;
        }
      }
    };
  }

  getPrices() {
    return this.prices;
  }

  isConnected() {
    return this.connected;
  }
}

// Single global instance
export const priceSocketManager = new PriceSocketManager();
