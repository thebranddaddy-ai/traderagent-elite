import crypto from 'crypto';

interface BinanceOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface BinanceAccountInfo {
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

interface BinanceApiCredentials {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean; // Use testnet for testing
}

export class BinanceService {
  private baseUrl: string;
  private credentials: BinanceApiCredentials;

  constructor(credentials: BinanceApiCredentials) {
    this.credentials = credentials;
    // Use testnet if specified, otherwise production
    this.baseUrl = credentials.testnet 
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api';
  }

  /**
   * Validates API credentials by checking account access
   */
  async validateCredentials(): Promise<{ valid: boolean; permissions: string[]; error?: string }> {
    try {
      console.log(`[Binance] Validating credentials for ${this.credentials.testnet ? 'TESTNET' : 'PRODUCTION'}`);
      console.log(`[Binance] Base URL: ${this.baseUrl}`);
      console.log(`[Binance] API Key (first 10 chars): ${this.credentials.apiKey.substring(0, 10)}...`);
      
      const accountInfo = await this.getAccountInfo();
      
      const permissions: string[] = [];
      if (accountInfo.canTrade) permissions.push('trade');
      if (accountInfo.canWithdraw) permissions.push('withdraw');
      if (accountInfo.canDeposit) permissions.push('deposit');
      
      console.log(`[Binance] ✅ Validation successful! Permissions: ${permissions.join(', ')}`);
      
      return {
        valid: true,
        permissions,
      };
    } catch (error: any) {
      console.error('[Binance] ❌ Validation failed:', error.message);
      console.error('[Binance] Error details:', error);
      return {
        valid: false,
        permissions: [],
        error: error.message || 'Failed to validate API credentials',
      };
    }
  }

  /**
   * Gets account information
   */
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    const endpoint = '/v3/account';
    const timestamp = Date.now();
    
    const queryString = `timestamp=${timestamp}`;
    const signature = this.sign(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    console.log(`[Binance] Calling ${endpoint} endpoint...`);
    
    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    console.log(`[Binance] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      console.error(`[Binance] API Error Response:`, error);
      throw new Error(error.msg || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Places a test order (doesn't actually execute)
   * Useful for validating order parameters
   */
  async testOrder(params: BinanceOrderParams): Promise<any> {
    const endpoint = '/v3/order/test';
    return this.placeOrder(params, true);
  }

  /**
   * Places a real order on Binance
   */
  async placeOrder(params: BinanceOrderParams, testMode: boolean = false): Promise<any> {
    const endpoint = testMode ? '/v3/order/test' : '/v3/order';
    const timestamp = Date.now();
    
    // Build query parameters
    const queryParams: any = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      timestamp,
    };

    if (params.type === 'LIMIT') {
      queryParams.price = params.price;
      queryParams.timeInForce = params.timeInForce || 'GTC';
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const signature = this.sign(queryString);
    
    const response = await fetch(`${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(error.msg || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Gets current ticker price for a symbol
   */
  async getTickerPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    const response = await fetch(`${this.baseUrl}/v3/ticker/price?symbol=${symbol}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get ticker price for ${symbol}`);
    }

    return response.json();
  }

  /**
   * Gets all open orders for all symbols or a specific symbol
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    const endpoint = '/v3/openOrders';
    const timestamp = Date.now();
    
    const params: any = { timestamp };
    if (symbol) {
      params.symbol = symbol;
    }

    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    console.log(`[Binance] Fetching open orders${symbol ? ` for ${symbol}` : ' (all symbols)'}...`);
    
    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      console.error(`[Binance] API Error Response:`, error);
      throw new Error(error.msg || `HTTP ${response.status}`);
    }

    const orders = await response.json();
    console.log(`[Binance] Found ${orders.length} open orders`);
    return orders;
  }

  /**
   * Cancels an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    const endpoint = '/v3/order';
    const timestamp = Date.now();
    
    const queryParams = {
      symbol,
      orderId: orderId.toString(),
      timestamp: timestamp.toString(),
    };

    const queryString = new URLSearchParams(queryParams).toString();
    const signature = this.sign(queryString);
    
    const response = await fetch(`${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`, {
      method: 'DELETE',
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(error.msg || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Creates HMAC SHA256 signature for Binance API
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(queryString)
      .digest('hex');
  }
}

/**
 * Creates a Binance service instance with encrypted credentials
 */
export function createBinanceService(apiKey: string, apiSecret: string, testnet: boolean = false): BinanceService {
  return new BinanceService({ apiKey, apiSecret, testnet });
}

// ========================================
// OHLCV Data Fetching (Public Endpoints)
// ========================================

export interface OHLCVCandle {
  time: number; // UTC seconds for TradingView
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleCache {
  symbol: string;
  interval: string;
  candles: OHLCVCandle[];
  lastUpdate: number;
}

// Use main Binance API for OHLCV data (public endpoint, no auth required)
// Testnet is often geo-blocked with HTTP 451
const BINANCE_API_URL = "https://api.binance.com/api";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // 500 candles per symbol/timeframe

// In-memory cache for OHLCV data
const candleCache = new Map<string, CandleCache>();

// Map chart intervals to Binance intervals
const INTERVAL_MAP: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "240": "4h",
  "D": "1d",
  "W": "1w",
};

function getCacheKey(symbol: string, interval: string): string {
  return `${symbol}_${interval}`;
}

function normalizeSymbol(symbol: string): string {
  // Convert symbols like BTC to BTCUSDT for Binance
  const symbolMap: Record<string, string> = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    ADA: "ADAUSDT",
    AVAX: "AVAXUSDT",
    MATIC: "MATICUSDT",
    DOT: "DOTUSDT",
    LINK: "LINKUSDT",
    XRP: "XRPUSDT",
  };
  return symbolMap[symbol] || `${symbol}USDT`;
}

function convertKlineToCandle(kline: any[]): OHLCVCandle {
  return {
    time: Math.floor(kline[0] / 1000), // Convert ms to seconds
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5]),
  };
}

// CoinGecko OHLC API integration
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// Map symbols to CoinGecko IDs
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  DOT: "polkadot",
  LINK: "chainlink",
  XRP: "ripple",
  USDT: "tether",
  BNB: "binancecoin",
  USDC: "usd-coin",
};

// Map intervals to CoinGecko days parameter
function getCoinGeckoDays(interval: string, limit: number): string {
  // CoinGecko auto-granularity:
  // 1-2 days: 30min candles
  // 3-30 days: 4hr candles
  // 31+ days: daily candles
  
  const intervalSeconds: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1w": 604800,
  };
  
  const intervalSec = intervalSeconds[interval] || 3600;
  const totalSeconds = intervalSec * limit;
  const days = Math.ceil(totalSeconds / 86400);
  
  // CoinGecko limits: 1, 7, 14, 30, 90, 180, 365, max
  if (days <= 1) return "1";
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  if (days <= 30) return "30";
  if (days <= 90) return "90";
  if (days <= 180) return "180";
  if (days <= 365) return "365";
  return "max";
}

async function fetchCoinGeckoOHLCV(symbol: string, interval: string, limit: number): Promise<OHLCVCandle[]> {
  const coinId = COINGECKO_ID_MAP[symbol];
  if (!coinId) {
    throw new Error(`Symbol ${symbol} not supported by CoinGecko`);
  }
  
  const days = getCoinGeckoDays(interval, limit);
  const url = `${COINGECKO_API_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  
  console.log(`[COINGECKO] Fetching OHLCV: ${symbol} ${interval} (${days} days, ~${limit} candles)`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }
  
  const ohlcData = await response.json();
  
  // Convert CoinGecko format [timestamp_ms, open, high, low, close] to our format
  const candles: OHLCVCandle[] = ohlcData.map((candle: number[]) => ({
    time: Math.floor(candle[0] / 1000), // Convert ms to seconds
    open: candle[1],
    high: candle[2],
    low: candle[3],
    close: candle[4],
    volume: 0, // CoinGecko OHLC endpoint doesn't include volume
  }));
  
  // Return only the requested number of candles (most recent)
  return candles.slice(-limit);
}

export async function fetchOHLCVData(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<OHLCVCandle[]> {
  const cacheKey = getCacheKey(symbol, interval);
  const cached = candleCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.lastUpdate < CACHE_TTL) {
    console.log(`[OHLCV] Using cached data for ${symbol} ${interval}`);
    return cached.candles;
  }

  // Try CoinGecko first (primary source - no geo-blocking)
  try {
    const requestLimit = Math.min(limit, MAX_CACHE_SIZE);
    const candles = await fetchCoinGeckoOHLCV(symbol, interval, requestLimit);

    // Cache the data
    candleCache.set(cacheKey, {
      symbol,
      interval,
      candles,
      lastUpdate: Date.now(),
    });

    console.log(`[COINGECKO] Successfully fetched ${candles.length} candles for ${symbol} ${interval}`);
    return candles;
  } catch (coinGeckoError: any) {
    console.error(`[COINGECKO ERROR] Failed to fetch OHLCV for ${symbol} ${interval}:`, coinGeckoError?.message);
    
    // Fallback: Try Binance (may be geo-blocked in some regions)
    try {
      const binanceSymbol = normalizeSymbol(symbol);
      const binanceInterval = INTERVAL_MAP[interval] || interval;
      const requestLimit = Math.min(limit, 1000);

      const url = `${BINANCE_API_URL}/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${requestLimit}`;
      console.log(`[BINANCE] Trying Binance as fallback: ${binanceSymbol} ${binanceInterval}`);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const klines = await response.json();
      const candles = klines.map(convertKlineToCandle).slice(-MAX_CACHE_SIZE);

      candleCache.set(cacheKey, {
        symbol,
        interval,
        candles,
        lastUpdate: Date.now(),
      });

      console.log(`[BINANCE] Fetched ${candles.length} candles for ${symbol} ${interval}`);
      return candles;
    } catch (binanceError: any) {
      console.error(`[BINANCE ERROR] ${binanceError?.message}`);
      
      // Return cached data even if expired
      if (cached) {
        console.log(`[OHLCV] Using stale cache for ${symbol} ${interval}`);
        return cached.candles;
      }
      
      // Last resort: empty array (frontend will handle gracefully)
      console.error(`[OHLCV] No data available for ${symbol} ${interval}`);
      return [];
    }
  }
}

export async function fetchOHLCVRange(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<OHLCVCandle[]> {
  try {
    const binanceSymbol = normalizeSymbol(symbol);
    const binanceInterval = INTERVAL_MAP[interval] || interval;

    // Convert seconds to milliseconds for Binance
    const startMs = startTime * 1000;
    const endMs = endTime * 1000;

    const url = `${BINANCE_API_URL}/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&startTime=${startMs}&endTime=${endMs}&limit=1000`;
    console.log(`[BINANCE] Fetching OHLCV range: ${binanceSymbol} ${binanceInterval}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const klines = await response.json();
    const candles = klines.map(convertKlineToCandle);

    console.log(`[BINANCE] Fetched ${candles.length} candles in range`);
    return candles;
  } catch (error: any) {
    console.error(`[BINANCE ERROR] Failed to fetch OHLCV range:`, error?.message);
    return [];
  }
}

export function getCachedCandles(symbol: string, interval: string): OHLCVCandle[] | null {
  const cacheKey = getCacheKey(symbol, interval);
  const cached = candleCache.get(cacheKey);
  
  if (cached && Date.now() - cached.lastUpdate < CACHE_TTL) {
    return cached.candles;
  }
  
  return null;
}

export function clearCache(symbol?: string, interval?: string): void {
  if (symbol && interval) {
    const cacheKey = getCacheKey(symbol, interval);
    candleCache.delete(cacheKey);
    console.log(`[BINANCE] Cleared cache for ${symbol} ${interval}`);
  } else {
    candleCache.clear();
    console.log(`[BINANCE] Cleared all cache`);
  }
}

export function getCacheStats(): { totalEntries: number; entries: { key: string; size: number; age: number }[] } {
  const entries = Array.from(candleCache.entries()).map(([key, cache]) => ({
    key,
    size: cache.candles.length,
    age: Date.now() - cache.lastUpdate,
  }));

  return {
    totalEntries: candleCache.size,
    entries,
  };
}
