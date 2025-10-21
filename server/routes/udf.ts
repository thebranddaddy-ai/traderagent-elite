import type { Express } from "express";
import { db } from "../db";

/**
 * UDF (Universal Data Feed) API routes for TradingView integration
 * Implements TradingView's UDF protocol for historical and real-time data
 * Spec: https://www.tradingview.com/charting-library-docs/latest/connecting_data/UDF/
 */

// Supported symbols configuration
const SUPPORTED_SYMBOLS = [
  {
    symbol: "BTC",
    full_name: "CRYPTO:BTCUSD",
    description: "Bitcoin",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "BTC",
  },
  {
    symbol: "ETH",
    full_name: "CRYPTO:ETHUSD",
    description: "Ethereum",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "ETH",
  },
  {
    symbol: "SOL",
    full_name: "CRYPTO:SOLUSD",
    description: "Solana",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "SOL",
  },
  {
    symbol: "ADA",
    full_name: "CRYPTO:ADAUSD",
    description: "Cardano",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "ADA",
  },
  {
    symbol: "AVAX",
    full_name: "CRYPTO:AVAXUSD",
    description: "Avalanche",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "AVAX",
  },
  {
    symbol: "MATIC",
    full_name: "CRYPTO:MATICUSD",
    description: "Polygon",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "MATIC",
  },
  {
    symbol: "DOT",
    full_name: "CRYPTO:DOTUSD",
    description: "Polkadot",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "DOT",
  },
  {
    symbol: "LINK",
    full_name: "CRYPTO:LINKUSD",
    description: "Chainlink",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "LINK",
  },
  {
    symbol: "XRP",
    full_name: "CRYPTO:XRPUSD",
    description: "Ripple",
    exchange: "CRYPTO",
    type: "crypto",
    ticker: "XRP",
  },
];

// Resolution mapping (TradingView format to minutes)
const RESOLUTION_MAP: Record<string, number> = {
  "1": 1,
  "5": 5,
  "15": 15,
  "30": 30,
  "60": 60,
  "1H": 60,
  "4H": 240,
  "1D": 1440,
  "1W": 10080,
  "1M": 43200,
};

export function registerUDFRoutes(app: Express) {
  /**
   * GET /api/udf/config
   * Returns datafeed configuration
   */
  app.get("/api/udf/config", (req, res) => {
    res.json({
      supported_resolutions: ["1", "5", "15", "30", "60", "1H", "4H", "1D", "1W", "1M"],
      supports_group_request: false,
      supports_marks: false,
      supports_search: true,
      supports_timescale_marks: false,
      exchanges: [
        {
          value: "CRYPTO",
          name: "Cryptocurrency",
          desc: "Crypto Exchange",
        },
      ],
      symbols_types: [
        {
          value: "crypto",
          name: "Cryptocurrency",
        },
      ],
    });
  });

  /**
   * GET /api/udf/symbols?symbol=<symbol>
   * Resolves symbol information
   */
  app.get("/api/udf/symbols", (req, res) => {
    const { symbol } = req.query;
    
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ s: "error", errmsg: "Symbol parameter required" });
    }

    // Find symbol (case-insensitive, handle full name format)
    const symbolUpper = symbol.toUpperCase().replace("CRYPTO:", "");
    const symbolInfo = SUPPORTED_SYMBOLS.find(
      (s) => s.symbol === symbolUpper || s.ticker === symbolUpper
    );

    if (!symbolInfo) {
      return res.status(404).json({ s: "error", errmsg: `Symbol ${symbol} not found` });
    }

    // Return LibrarySymbolInfo format
    res.json({
      name: symbolInfo.symbol,
      ticker: symbolInfo.ticker,
      full_name: symbolInfo.full_name,
      description: symbolInfo.description,
      type: symbolInfo.type,
      exchange: symbolInfo.exchange,
      listed_exchange: symbolInfo.exchange,
      timezone: "Etc/UTC",
      minmov: 1,
      pricescale: 100, // 2 decimal places
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: ["1", "5", "15", "30", "60", "1H", "4H", "1D", "1W", "1M"],
      data_status: "streaming",
      session: "24x7", // Crypto markets are 24/7
    });
  });

  /**
   * GET /api/udf/search?query=<query>&type=<type>&exchange=<exchange>&limit=<limit>
   * Search symbols
   */
  app.get("/api/udf/search", (req, res) => {
    const { query, type, exchange, limit } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.json([]); // Empty array for empty search
    }

    const queryUpper = query.toUpperCase();
    const limitNum = limit ? parseInt(limit as string) : 30;

    // Filter symbols by query, type, and exchange
    let results = SUPPORTED_SYMBOLS.filter((s) => {
      const matchesQuery =
        s.symbol.includes(queryUpper) ||
        s.description.toUpperCase().includes(queryUpper);
      const matchesType = !type || s.type === type;
      const matchesExchange = !exchange || s.exchange === exchange;
      return matchesQuery && matchesType && matchesExchange;
    });

    // Limit results
    results = results.slice(0, limitNum);

    // Return SearchSymbolResultItem[] format
    res.json(
      results.map((s) => ({
        symbol: s.symbol,
        full_name: s.full_name,
        description: s.description,
        exchange: s.exchange,
        ticker: s.ticker,
        type: s.type,
      }))
    );
  });

  /**
   * GET /api/udf/history?symbol=<symbol>&from=<from>&to=<to>&resolution=<resolution>
   * Get historical bars (OHLCV data)
   * Note: This integrates with our existing CoinGecko data via /api/ohlcv endpoint
   */
  app.get("/api/udf/history", async (req, res) => {
    try {
      const { symbol, from, to, resolution } = req.query;

      if (!symbol || !from || !to || !resolution) {
        return res.status(400).json({
          s: "error",
          errmsg: "Missing required parameters: symbol, from, to, resolution",
        });
      }

      const symbolUpper = (symbol as string).toUpperCase().replace("CRYPTO:", "");
      const fromTimestamp = parseInt(from as string);
      const toTimestamp = parseInt(to as string);

      // Map TradingView resolution to our interval format
      const resolutionMinutes = RESOLUTION_MAP[resolution as string];
      if (!resolutionMinutes) {
        return res.status(400).json({
          s: "error",
          errmsg: `Unsupported resolution: ${resolution}`,
        });
      }

      // Map to CoinGecko interval format (same as our existing mapping)
      let interval = "1h";
      if (resolutionMinutes === 1) interval = "1m";
      else if (resolutionMinutes === 5) interval = "5m";
      else if (resolutionMinutes === 15) interval = "15m";
      else if (resolutionMinutes === 30) interval = "30m";
      else if (resolutionMinutes === 60) interval = "1h";
      else if (resolutionMinutes === 240) interval = "4h";
      else if (resolutionMinutes === 1440) interval = "1d";
      else if (resolutionMinutes === 10080) interval = "1d"; // 1W -> use daily data
      else if (resolutionMinutes === 43200) interval = "1d"; // 1M -> use daily data

      // Fetch OHLCV data from our existing endpoint
      const ohlcvUrl = `${req.protocol}://${req.get("host")}/api/ohlcv/${symbolUpper}?interval=${interval}&limit=1000`;
      const ohlcvResponse = await fetch(ohlcvUrl);
      
      if (!ohlcvResponse.ok) {
        return res.json({ s: "no_data", nextTime: fromTimestamp * 1000 });
      }

      const ohlcvData = await ohlcvResponse.json();
      const candles = ohlcvData.candles || [];

      // Filter candles by time range
      const filteredCandles = candles.filter((candle: any) => {
        const candleTime = Math.floor(candle.time / 1000); // Convert ms to seconds
        return candleTime >= fromTimestamp && candleTime < toTimestamp;
      });

      if (filteredCandles.length === 0) {
        return res.json({ s: "no_data", nextTime: fromTimestamp * 1000 });
      }

      // Convert to UDF format
      const bars = {
        s: "ok",
        t: filteredCandles.map((c: any) => Math.floor(c.time / 1000)),
        o: filteredCandles.map((c: any) => c.open),
        h: filteredCandles.map((c: any) => c.high),
        l: filteredCandles.map((c: any) => c.low),
        c: filteredCandles.map((c: any) => c.close),
        v: filteredCandles.map((c: any) => c.volume || 0),
      };

      res.json(bars);
    } catch (error) {
      console.error("[UDF History Error]", error);
      res.status(500).json({
        s: "error",
        errmsg: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  /**
   * GET /api/udf/time
   * Returns server time (unix timestamp in seconds)
   */
  app.get("/api/udf/time", (req, res) => {
    res.send(String(Math.floor(Date.now() / 1000)));
  });

  console.log("[UDF] Routes registered: /api/udf/*");
}
