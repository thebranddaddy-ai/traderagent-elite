import { setMarketPrice } from "./paperTrading";

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  marketCap?: number;
}

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
}

interface CoinGeckoPrice {
  id: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

// Map our symbols to Binance trading pairs
const BINANCE_PAIRS: Record<string, string> = {
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

// Map our symbols to CoinGecko IDs (fallback)
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  DOT: "polkadot",
  LINK: "chainlink",
  XRP: "ripple",
};

// Cache for price data
const priceCache: Record<string, PriceUpdate> = {};
let lastFetchTime = 0;
const FETCH_COOLDOWN = 1000; // Minimum 1 second between fetches
let binanceAvailable = true; // Track if Binance API is accessible

/**
 * Fetch LIVE prices from Binance API (PRIMARY SOURCE)
 * Documentation: https://binance-docs.github.io/apidocs/spot/en/#24hr-ticker-price-change-statistics
 */
async function fetchBinancePrices(): Promise<PriceUpdate[] | null> {
  try {
    const symbols = Object.values(BINANCE_PAIRS);
    const symbolsParam = JSON.stringify(symbols);
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 451) {
        console.log("[Binance] ⚠️  Geolocation blocked (HTTP 451) - deploy to AWS Tokyo/Frankfurt/Mumbai to access Binance");
        binanceAvailable = false;
      } else {
        console.log(`[Binance] API error ${response.status}`);
      }
      return null;
    }

    const tickers: BinanceTicker[] = await response.json();
    const updates: PriceUpdate[] = [];

    for (const ticker of tickers) {
      const symbol = Object.entries(BINANCE_PAIRS).find(
        ([_, pair]) => pair === ticker.symbol
      )?.[0];

      if (symbol) {
        const price = parseFloat(ticker.lastPrice);
        const change = parseFloat(ticker.priceChange);
        const changePercent = parseFloat(ticker.priceChangePercent);
        const volume = parseFloat(ticker.quoteVolume);

        const update: PriceUpdate = {
          symbol,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          timestamp: Date.now(),
          volume,
        };

        updates.push(update);
        priceCache[symbol] = update;
        setMarketPrice(symbol, update.price);
      }
    }

    binanceAvailable = true;
    console.log(`[Binance] ✅ Fetched ${updates.length} LIVE prices from Binance`);
    return updates;

  } catch (error: any) {
    console.error("[Binance] Error:", error?.message || error);
    binanceAvailable = false;
    return null;
  }
}

/**
 * Fetch LIVE prices from CoinGecko API (FALLBACK SOURCE)
 * Used when Binance is blocked (e.g., on Replit)
 */
async function fetchCoinGeckoPrices(): Promise<PriceUpdate[]> {
  try {
    const coinIds = Object.values(COINGECKO_IDS).join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[CoinGecko] API error ${response.status}`);
      return Object.values(priceCache);
    }

    const data: CoinGeckoPrice[] = await response.json();
    const updates: PriceUpdate[] = [];

    for (const coin of data) {
      const symbol = Object.entries(COINGECKO_IDS).find(
        ([_, id]) => id === coin.id
      )?.[0];

      if (symbol) {
        const update: PriceUpdate = {
          symbol,
          price: coin.current_price ? parseFloat(coin.current_price.toFixed(2)) : 0,
          change: coin.price_change_24h ? parseFloat(coin.price_change_24h.toFixed(2)) : 0,
          changePercent: coin.price_change_percentage_24h ? parseFloat(coin.price_change_percentage_24h.toFixed(2)) : 0,
          timestamp: Date.now(),
          volume: coin.total_volume || 0,
          marketCap: coin.market_cap || 0,
        };

        updates.push(update);
        priceCache[symbol] = update;
        setMarketPrice(symbol, update.price);
      }
    }

    console.log(`[CoinGecko] ✅ Fetched ${updates.length} LIVE prices (fallback mode)`);
    return updates;

  } catch (error: any) {
    console.error("[CoinGecko] Error fetching prices:", error?.message || error);
    return Object.values(priceCache);
  }
}

/**
 * Fetch prices from Binance ONLY
 * NO FALLBACK - Binance API only (as per user requirement)
 */
async function fetchPrices(): Promise<PriceUpdate[]> {
  // Rate limiting
  const now = Date.now();
  if (now - lastFetchTime < FETCH_COOLDOWN) {
    return Object.values(priceCache);
  }

  // Use ONLY Binance API - no fallback
  const binanceData = await fetchBinancePrices();
  if (binanceData && binanceData.length > 0) {
    lastFetchTime = now;
    return binanceData;
  }

  // If Binance fails, return cached data (no CoinGecko fallback)
  lastFetchTime = now;
  return Object.values(priceCache);
}

/**
 * Start price feed with automatic source selection
 * @param broadcastFn Callback to broadcast price updates
 * @param intervalMs Update interval in milliseconds (default: 2000ms = 2 seconds)
 */
export function startBinancePriceFeed(
  broadcastFn: (updates: PriceUpdate[]) => void,
  intervalMs: number = 2000
): NodeJS.Timeout {
  console.log(`[Price Feed] 🚀 Starting LIVE price feed (updates every ${intervalMs / 1000}s)`);
  console.log("[Price Feed] Source: Binance API ONLY (api.binance.com)");
  console.log("[Price Feed] ⚠️  NO FALLBACK - Binance exclusive mode");
  
  // Fetch immediately on start
  fetchPrices().then(updates => {
    if (updates.length > 0) {
      broadcastFn(updates);
    }
  });
  
  // Then fetch at regular intervals
  return setInterval(async () => {
    const updates = await fetchPrices();
    if (updates.length > 0) {
      broadcastFn(updates);
    }
  }, intervalMs);
}

/**
 * Get current cached prices (synchronous)
 */
export function getBinancePrices(): PriceUpdate[] {
  return Object.values(priceCache);
}
