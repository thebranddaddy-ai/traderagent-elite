/**
 * UDF Streaming Service - Real-time OHLCV Bar Updates
 * 
 * Implements TradingView UDF streaming protocol:
 * - Subscribes to live price ticks
 * - Buckets ticks into candles (1m, 5m, 15m, 1h, 4h, 1d)
 * - Emits "update" (modify last bar) and "new" (append bar) messages
 * - Caches last 500 bars per symbol/resolution for late joins
 * 
 * Performance Target: <150ms bar update latency
 */

import { WebSocket } from "ws";

// TradingView UDF Bar format
export interface UDFBar {
  time: number;      // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Subscription message from client
export interface SubscribeMessage {
  type: "subscribe";
  symbol: string;
  resolution: string;  // "1", "5", "15", "60", "240", "D"
}

// Unsubscribe message from client
export interface UnsubscribeMessage {
  type: "unsubscribe";
  symbol: string;
  resolution: string;
}

// Server response messages
export interface UpdateBarMessage {
  type: "update";
  symbol: string;
  resolution: string;
  bar: UDFBar;
}

export interface NewBarMessage {
  type: "new";
  symbol: string;
  resolution: string;
  bar: UDFBar;
}

// Client subscription tracking
interface Subscription {
  ws: WebSocket;
  symbol: string;
  resolution: string;
}

// Active bar tracker (for bucketing ticks into candles)
interface ActiveBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;  // Number of ticks in this bar
}

// Bar cache for late joins (last 500 bars per symbol/resolution)
const BAR_CACHE_SIZE = 500;
const barCache = new Map<string, UDFBar[]>();  // key: "symbol:resolution"

// Active subscriptions (multiple clients can subscribe to same symbol/resolution)
const subscriptions = new Map<string, Subscription[]>();  // key: "symbol:resolution"

// Current active bars being built from ticks
const activeBars = new Map<string, ActiveBar>();  // key: "symbol:resolution"

// Resolution to milliseconds mapping
const RESOLUTION_MS: Record<string, number> = {
  "1": 60 * 1000,           // 1 minute
  "5": 5 * 60 * 1000,       // 5 minutes
  "15": 15 * 60 * 1000,     // 15 minutes
  "60": 60 * 60 * 1000,     // 1 hour
  "240": 4 * 60 * 60 * 1000,// 4 hours
  "D": 24 * 60 * 60 * 1000  // 1 day
};

/**
 * Subscribe to real-time bars for a symbol/resolution
 */
export function subscribe(ws: WebSocket, symbol: string, resolution: string): void {
  const key = `${symbol}:${resolution}`;
  const startTime = Date.now();
  
  // Add to subscriptions
  if (!subscriptions.has(key)) {
    subscriptions.set(key, []);
  }
  subscriptions.get(key)!.push({ ws, symbol, resolution });
  
  // Send cached bars to late joiner (last 500 bars)
  const cached = barCache.get(key) || [];
  if (cached.length > 0) {
    ws.send(JSON.stringify({
      type: "history",
      symbol,
      resolution,
      bars: cached,
      count: cached.length
    }));
  }
  
  // Telemetry
  const latency = Date.now() - startTime;
  console.log(`[UDF STREAM] ${symbol}:${resolution} subscribed (${latency}ms, ${cached.length} cached bars)`);
  
  // Send telemetry event (if service available)
  try {
    const { telemetryService } = require('./telemetryService');
    telemetryService.trackEvent({
      eventType: 'ohlcv_subscribe',
      userId: 'websocket-client',
      metadata: { symbol, resolution, cachedBars: cached.length, latencyMs: latency }
    });
  } catch (err) {
    // Telemetry service may not be available, silently continue
  }
}

/**
 * Unsubscribe from real-time bars
 */
export function unsubscribe(ws: WebSocket, symbol: string, resolution: string): void {
  const key = `${symbol}:${resolution}`;
  const startTime = Date.now();
  
  const subs = subscriptions.get(key);
  if (subs) {
    const filtered = subs.filter(sub => sub.ws !== ws);
    if (filtered.length > 0) {
      subscriptions.set(key, filtered);
    } else {
      subscriptions.delete(key);
      activeBars.delete(key);  // Clean up active bar if no more subscribers
    }
  }
  
  // Telemetry
  const latency = Date.now() - startTime;
  console.log(`[UDF STREAM] ${symbol}:${resolution} unsubscribed (${latency}ms)`);
  
  try {
    const { telemetryService } = require('./telemetryService');
    telemetryService.trackEvent({
      eventType: 'ohlcv_unsubscribe',
      userId: 'websocket-client',
      metadata: { symbol, resolution, latencyMs: latency }
    });
  } catch (err) {
    // Silently continue if telemetry unavailable
  }
}

/**
 * Process incoming price tick and update active bars
 */
export function processPriceTick(symbol: string, price: number, volume: number = 0): void {
  const startTime = Date.now();
  const now = Date.now();
  
  // Update all active resolutions for this symbol
  for (const [key, subs] of Array.from(subscriptions.entries())) {
    if (!key.startsWith(symbol + ":")) continue;
    
    const resolution = key.split(":")[1];
    const resolutionMs = RESOLUTION_MS[resolution];
    if (!resolutionMs) continue;
    
    // Calculate bar start time (floor to resolution boundary)
    const barTime = Math.floor(now / resolutionMs) * resolutionMs;
    const barTimeSeconds = Math.floor(barTime / 1000);
    
    // Get or create active bar
    let activeBar = activeBars.get(key);
    const isNewBar = !activeBar || activeBar.time !== barTimeSeconds;
    
    if (isNewBar) {
      // Finalize previous bar and add to cache
      if (activeBar) {
        const finalBar: UDFBar = {
          time: activeBar.time,
          open: activeBar.open,
          high: activeBar.high,
          low: activeBar.low,
          close: activeBar.close,
          volume: activeBar.volume
        };
        
        // Add to cache (closed bar)
        addToCache(key, finalBar);
        
        // Send final "update" for closed bar
        broadcastUpdateBar(subs, symbol, resolution, finalBar);
      }
      
      // Start new bar with current tick
      activeBar = {
        time: barTimeSeconds,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
        tickCount: 1
      };
      activeBars.set(key, activeBar);
      
      // Broadcast "new" message for newly opened bar (TradingView protocol)
      const newBar: UDFBar = {
        time: activeBar.time,
        open: activeBar.open,
        high: activeBar.high,
        low: activeBar.low,
        close: activeBar.close,
        volume: activeBar.volume
      };
      broadcastNewBar(subs, symbol, resolution, newBar);
    } else if (activeBar) {
      // Update existing bar
      activeBar.high = Math.max(activeBar.high, price);
      activeBar.low = Math.min(activeBar.low, price);
      activeBar.close = price;
      activeBar.volume += volume;
      activeBar.tickCount++;
      
      // Broadcast "update" message for current bar
      const currentBar: UDFBar = {
        time: activeBar.time,
        open: activeBar.open,
        high: activeBar.high,
        low: activeBar.low,
        close: activeBar.close,
        volume: activeBar.volume
      };
      broadcastUpdateBar(subs, symbol, resolution, currentBar);
    }
  }
  
  // Telemetry for bar push latency
  const latency = Date.now() - startTime;
  if (latency > 100) {  // Only log if >100ms (potential performance issue)
    console.warn(`[UDF STREAM] High bar push latency: ${latency}ms for ${symbol}`);
  }
  
  try {
    const { telemetryService } = require('./telemetryService');
    telemetryService.trackEvent({
      eventType: 'bar_push_latency_ms',
      userId: 'system',
      metadata: { symbol, latencyMs: latency, tickCount: activeBars.size }
    });
  } catch (err) {
    // Silently continue
  }
}

/**
 * Broadcast "update" message to all subscribers (modify last bar)
 */
function broadcastUpdateBar(subs: Subscription[], symbol: string, resolution: string, bar: UDFBar): void {
  const message: UpdateBarMessage = {
    type: "update",
    symbol,
    resolution,
    bar
  };
  
  const json = JSON.stringify(message);
  subs.forEach(sub => {
    if (sub.ws.readyState === WebSocket.OPEN) {
      sub.ws.send(json);
    }
  });
}

/**
 * Broadcast "new" message to all subscribers (append new bar)
 */
function broadcastNewBar(subs: Subscription[], symbol: string, resolution: string, bar: UDFBar): void {
  const message: NewBarMessage = {
    type: "new",
    symbol,
    resolution,
    bar
  };
  
  const json = JSON.stringify(message);
  subs.forEach(sub => {
    if (sub.ws.readyState === WebSocket.OPEN) {
      sub.ws.send(json);
    }
  });
}

/**
 * Add bar to cache (keep last 500 bars)
 */
function addToCache(key: string, bar: UDFBar): void {
  if (!barCache.has(key)) {
    barCache.set(key, []);
  }
  
  const cache = barCache.get(key)!;
  cache.push(bar);
  
  // Keep only last 500 bars
  if (cache.length > BAR_CACHE_SIZE) {
    cache.shift();
  }
}

/**
 * Get subscription statistics (for monitoring)
 */
export function getStats(): {
  activeSubscriptions: number;
  activeBars: number;
  cachedBars: number;
  subscriptionsBySymbol: Record<string, number>;
} {
  const subscriptionsBySymbol: Record<string, number> = {};
  
  for (const [key, subs] of Array.from(subscriptions.entries())) {
    const symbol = key.split(":")[0];
    subscriptionsBySymbol[symbol] = (subscriptionsBySymbol[symbol] || 0) + subs.length;
  }
  
  let totalCachedBars = 0;
  for (const cache of Array.from(barCache.values())) {
    totalCachedBars += cache.length;
  }
  
  return {
    activeSubscriptions: Array.from(subscriptions.values()).reduce((sum, subs) => sum + subs.length, 0),
    activeBars: activeBars.size,
    cachedBars: totalCachedBars,
    subscriptionsBySymbol
  };
}

/**
 * Clean up disconnected WebSocket connections
 */
export function cleanupDisconnectedClients(): void {
  for (const [key, subs] of Array.from(subscriptions.entries())) {
    const activeSubs = subs.filter((sub: Subscription) => sub.ws.readyState === WebSocket.OPEN);
    
    if (activeSubs.length === 0) {
      subscriptions.delete(key);
      activeBars.delete(key);
    } else if (activeSubs.length < subs.length) {
      subscriptions.set(key, activeSubs);
    }
  }
}
