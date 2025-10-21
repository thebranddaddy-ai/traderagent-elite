import type { Express } from "express";
import { fetchOHLCVData, fetchOHLCVRange, getCachedCandles, clearCache, getCacheStats } from "../services/binanceService";

export function registerOHLCVRoutes(app: Express) {
  /**
   * GET /api/ohlcv/:symbol/:interval
   * Fetches OHLCV candlestick data for a symbol and interval
   * 
   * @param symbol - Trading symbol (BTC, ETH, SOL)
   * @param interval - Chart interval (1, 5, 15, 30, 60, 240, D, W)
   * @param limit - Number of candles (optional, default: 500, max: 1000)
   */
  app.get("/api/ohlcv/:symbol/:interval", async (req, res) => {
    const startTime = performance.now();
    const { symbol, interval } = req.params;
    const limit = parseInt(req.query.limit as string) || 500;

    try {
      console.log(`[OHLCV API] Request: ${symbol} ${interval} (limit: ${limit})`);
      
      const candles = await fetchOHLCVData(symbol, interval, limit);
      
      const duration = performance.now() - startTime;
      console.log(`[OHLCV API] Returned ${candles.length} candles in ${duration.toFixed(2)}ms`);

      res.json({
        success: true,
        data: candles,
        meta: {
          symbol,
          interval,
          count: candles.length,
          fetchTime: Math.round(duration),
        },
      });
    } catch (error: any) {
      console.error(`[OHLCV API ERROR]:`, error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch OHLCV data",
      });
    }
  });

  /**
   * GET /api/ohlcv/:symbol/:interval/range
   * Fetches OHLCV data for a specific time range
   * 
   * @param symbol - Trading symbol (BTC, ETH, SOL)
   * @param interval - Chart interval
   * @param from - Start timestamp (UTC seconds)
   * @param to - End timestamp (UTC seconds)
   */
  app.get("/api/ohlcv/:symbol/:interval/range", async (req, res) => {
    const startTime = performance.now();
    const { symbol, interval } = req.params;
    const from = parseInt(req.query.from as string);
    const to = parseInt(req.query.to as string);

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameters: from, to (UTC seconds)",
      });
    }

    try {
      console.log(`[OHLCV API] Range request: ${symbol} ${interval} (${new Date(from * 1000).toISOString()} - ${new Date(to * 1000).toISOString()})`);
      
      const candles = await fetchOHLCVRange(symbol, interval, from, to);
      
      const duration = performance.now() - startTime;
      console.log(`[OHLCV API] Returned ${candles.length} candles in ${duration.toFixed(2)}ms`);

      res.json({
        success: true,
        data: candles,
        meta: {
          symbol,
          interval,
          count: candles.length,
          from,
          to,
          fetchTime: Math.round(duration),
        },
      });
    } catch (error: any) {
      console.error(`[OHLCV API ERROR]:`, error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch OHLCV range",
      });
    }
  });

  /**
   * GET /api/ohlcv/cache/:symbol/:interval
   * Gets cached data for a symbol/interval (if available)
   */
  app.get("/api/ohlcv/cache/:symbol/:interval", async (req, res) => {
    const { symbol, interval } = req.params;

    try {
      const cached = getCachedCandles(symbol, interval);
      
      if (cached) {
        res.json({
          success: true,
          cached: true,
          data: cached,
          meta: {
            symbol,
            interval,
            count: cached.length,
          },
        });
      } else {
        res.json({
          success: true,
          cached: false,
          data: [],
          meta: {
            symbol,
            interval,
            count: 0,
          },
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get cached data",
      });
    }
  });

  /**
   * DELETE /api/ohlcv/cache/:symbol?/:interval?
   * Clears the OHLCV cache
   * - No params: clears all cache
   * - With symbol & interval: clears specific cache
   */
  app.delete("/api/ohlcv/cache/:symbol?/:interval?", async (req, res) => {
    const { symbol, interval } = req.params;

    try {
      clearCache(symbol, interval);
      
      res.json({
        success: true,
        message: symbol && interval 
          ? `Cleared cache for ${symbol} ${interval}` 
          : "Cleared all cache",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to clear cache",
      });
    }
  });

  /**
   * GET /api/ohlcv/cache/stats
   * Gets cache statistics
   */
  app.get("/api/ohlcv/cache/stats", async (req, res) => {
    try {
      const stats = getCacheStats();
      res.json({
        success: true,
        ...stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get cache stats",
      });
    }
  });
}
