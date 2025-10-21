import WebSocket from 'ws';
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

// Symbol mappings for different exchanges
const SYMBOL_MAPS = {
  coinbase: {
    BTC: "BTC-USD",
    ETH: "ETH-USD",
    SOL: "SOL-USD",
    ADA: "ADA-USD",
    AVAX: "AVAX-USD",
    MATIC: "MATIC-USD",
    DOT: "DOT-USD",
    LINK: "LINK-USD",
    XRP: "XRP-USD",
    BNB: "BNB-USD",
    DOGE: "DOGE-USD",
    TRX: "TRX-USD",
    LTC: "LTC-USD",
    UNI: "UNI-USD",
    ATOM: "ATOM-USD",
    ALGO: "ALGO-USD",
    XLM: "XLM-USD",
    FIL: "FIL-USD",
    APT: "APT-USD",
    NEAR: "NEAR-USD",
  },
  kraken: {
    BTC: "XBT/USD",
    ETH: "ETH/USD",
    SOL: "SOL/USD",
    ADA: "ADA/USD",
    AVAX: "AVAX/USD",
    MATIC: "MATIC/USD",
    DOT: "DOT/USD",
    LINK: "LINK/USD",
    XRP: "XRP/USD",
    BNB: "BNB/USD",
    DOGE: "DOGE/USD",
    TRX: "TRX/USD",
    LTC: "LTC/USD",
    UNI: "UNI/USD",
    ATOM: "ATOM/USD",
    ALGO: "ALGO/USD",
    XLM: "XLM/USD",
    FIL: "FIL/USD",
    APT: "APT/USD",
    NEAR: "NEAR/USD",
  },
  coingecko: {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    ADA: "cardano",
    AVAX: "avalanche-2",
    MATIC: "matic-network",
    DOT: "polkadot",
    LINK: "chainlink",
    XRP: "ripple",
    BNB: "binancecoin",
    DOGE: "dogecoin",
    TRX: "tron",
    LTC: "litecoin",
    UNI: "uniswap",
    ATOM: "cosmos",
    ALGO: "algorand",
    XLM: "stellar",
    FIL: "filecoin",
    APT: "aptos",
    NEAR: "near",
  }
};

// Price cache and 24h data
const priceCache: Record<string, PriceUpdate> = {};
const price24hAgo: Record<string, number> = {};

// WebSocket connections
let coinbaseWs: WebSocket | null = null;
let krakenWs: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

// Current active source
let activeSource: 'coinbase' | 'kraken' | 'coingecko' = 'coinbase';
let isInitialized = false;

/**
 * Initialize default prices
 */
function initializeDefaultPrices() {
  const defaults: Record<string, number> = {
    BTC: 67000,
    ETH: 3500,
    SOL: 145,
    ADA: 0.55,
    AVAX: 35,
    MATIC: 0.85,
    DOT: 7.5,
    LINK: 15,
    XRP: 0.52,
    BNB: 320,
    DOGE: 0.08,
    TRX: 0.12,
    LTC: 85,
    UNI: 8.5,
    ATOM: 10,
    ALGO: 0.25,
    XLM: 0.11,
    FIL: 5.5,
    APT: 12,
    NEAR: 4.5,
  };

  Object.entries(defaults).forEach(([symbol, price]) => {
    priceCache[symbol] = {
      symbol,
      price,
      change: 0,
      changePercent: 0,
      timestamp: Date.now()
    };
    price24hAgo[symbol] = price;
    setMarketPrice(symbol, price);
  });

  console.log(`[CryptoPrices] ✅ Initialized ${Object.keys(defaults).length} default prices`);
}

/**
 * Fetch prices from CoinGecko API (fallback)
 */
async function fetchCoinGeckoPrices(): Promise<PriceUpdate[] | null> {
  try {
    const ids = Object.values(SYMBOL_MAPS.coingecko).join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[CoinGecko] API error ${response.status}`);
      return null;
    }

    const data = await response.json();
    const updates: PriceUpdate[] = [];

    for (const coin of data) {
      const symbol = Object.entries(SYMBOL_MAPS.coingecko).find(
        ([_, id]) => id === coin.id
      )?.[0];

      if (symbol) {
        const price = coin.current_price;
        const changePercent = coin.price_change_percentage_24h || 0;
        const change = (price * changePercent) / 100;

        const update: PriceUpdate = {
          symbol,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          timestamp: Date.now(),
          volume: coin.total_volume,
          marketCap: coin.market_cap,
        };

        updates.push(update);
        priceCache[symbol] = update;
        setMarketPrice(symbol, update.price);
      }
    }

    console.log(`[CoinGecko] ✅ Fetched ${updates.length} prices`);
    return updates;

  } catch (error: any) {
    console.error("[CoinGecko] Error:", error?.message || error);
    return null;
  }
}

/**
 * Connect to Coinbase WebSocket for real-time prices
 */
function connectCoinbase() {
  if (coinbaseWs && coinbaseWs.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    console.log('[Coinbase WS] Connecting...');
    coinbaseWs = new WebSocket('wss://ws-feed.exchange.coinbase.com');

    coinbaseWs.on('open', () => {
      console.log('[Coinbase WS] ✅ Connected');
      activeSource = 'coinbase';
      
      // Subscribe to ticker channel for all symbols
      const productIds = Object.values(SYMBOL_MAPS.coinbase);
      coinbaseWs?.send(JSON.stringify({
        type: 'subscribe',
        product_ids: productIds,
        channels: ['ticker']
      }));
    });

    coinbaseWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'ticker') {
          const symbol = Object.entries(SYMBOL_MAPS.coinbase).find(
            ([_, pair]) => pair === message.product_id
          )?.[0];

          if (symbol) {
            const price = parseFloat(message.price);
            const oldPrice = price24hAgo[symbol] || price;
            const change = price - oldPrice;
            const changePercent = ((change / oldPrice) * 100);

            const update: PriceUpdate = {
              symbol,
              price: parseFloat(price.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              timestamp: Date.now(),
              volume: parseFloat(message.volume_24h || '0'),
            };

            // Log first few updates to verify 24h data is working
            if (update.price && Math.abs(update.changePercent) > 0) {
              console.log(`[LIVE UPDATE] ${symbol}: $${update.price} (${update.changePercent > 0 ? '+' : ''}${update.changePercent.toFixed(2)}%, 24h ago=$${oldPrice.toFixed(2)})`);
            }

            priceCache[symbol] = update;
            setMarketPrice(symbol, update.price);
            
            // Debug: verify priceCache was updated correctly
            if (symbol === 'BTC' && Math.abs(update.changePercent) > 0) {
              console.log(`[COINBASE DEBUG] Just stored BTC in priceCache:`, JSON.stringify(priceCache['BTC']));
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    coinbaseWs.on('error', (error) => {
      console.error('[Coinbase WS] Error:', error.message);
      // Fallback to Kraken
      if (activeSource === 'coinbase') {
        connectKraken();
      }
    });

    coinbaseWs.on('close', () => {
      console.log('[Coinbase WS] Disconnected');
      coinbaseWs = null;
      
      // Reconnect after 5 seconds if this is the active source
      if (activeSource === 'coinbase') {
        setTimeout(() => connectCoinbase(), 5000);
      }
    });

  } catch (error: any) {
    console.error('[Coinbase WS] Connection error:', error?.message);
    // Fallback to Kraken
    connectKraken();
  }
}

/**
 * Connect to Kraken WebSocket for real-time prices
 */
function connectKraken() {
  if (krakenWs && krakenWs.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    console.log('[Kraken WS] Connecting...');
    krakenWs = new WebSocket('wss://ws.kraken.com');

    krakenWs.on('open', () => {
      console.log('[Kraken WS] ✅ Connected');
      activeSource = 'kraken';
      
      // Subscribe to ticker for all symbols
      const pairs = Object.values(SYMBOL_MAPS.kraken);
      krakenWs?.send(JSON.stringify({
        event: 'subscribe',
        pair: pairs,
        subscription: { name: 'ticker' }
      }));
    });

    krakenWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Kraken sends arrays for ticker updates
        if (Array.isArray(message) && message[2] === 'ticker') {
          const pairName = message[3];
          const tickerData = message[1];
          
          const symbol = Object.entries(SYMBOL_MAPS.kraken).find(
            ([_, pair]) => pair === pairName
          )?.[0];

          if (symbol && tickerData.c) {
            const price = parseFloat(tickerData.c[0]); // Current price
            const oldPrice = price24hAgo[symbol] || price;
            const change = price - oldPrice;
            const changePercent = ((change / oldPrice) * 100);

            const update: PriceUpdate = {
              symbol,
              price: parseFloat(price.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              timestamp: Date.now(),
              volume: parseFloat(tickerData.v[1] || '0'), // 24h volume
            };

            priceCache[symbol] = update;
            setMarketPrice(symbol, update.price);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    krakenWs.on('error', (error) => {
      console.error('[Kraken WS] Error:', error.message);
      // Fallback to CoinGecko polling
      if (activeSource === 'kraken') {
        activeSource = 'coingecko';
        startCoinGeckoPolling();
      }
    });

    krakenWs.on('close', () => {
      console.log('[Kraken WS] Disconnected');
      krakenWs = null;
      
      // Reconnect after 5 seconds if this is the active source
      if (activeSource === 'kraken') {
        setTimeout(() => connectKraken(), 5000);
      }
    });

  } catch (error: any) {
    console.error('[Kraken WS] Connection error:', error?.message);
    // Fallback to CoinGecko
    activeSource = 'coingecko';
    startCoinGeckoPolling();
  }
}

/**
 * Start CoinGecko polling (fallback)
 */
let coinGeckoInterval: NodeJS.Timeout | null = null;

function startCoinGeckoPolling() {
  if (coinGeckoInterval) {
    return;
  }

  console.log('[CoinGecko] Starting polling (fallback mode)');
  
  // Initial fetch
  fetchCoinGeckoPrices();
  
  // Poll every 10 seconds (CoinGecko rate limit)
  coinGeckoInterval = setInterval(() => {
    fetchCoinGeckoPrices();
  }, 10000);
}

function stopCoinGeckoPolling() {
  if (coinGeckoInterval) {
    clearInterval(coinGeckoInterval);
    coinGeckoInterval = null;
  }
}

/**
 * Initialize the price service
 */
export async function initializePriceService() {
  if (isInitialized) {
    return;
  }

  console.log('[CryptoPrices] 🚀 Initializing multi-source price service...');
  
  // Set default prices first
  initializeDefaultPrices();
  
  // Fetch initial 24h data from CoinGecko (includes 24h change data)
  await fetchCoinGeckoPrices();
  
  // Calculate and store 24h-ago prices from CoinGecko data
  Object.entries(priceCache).forEach(([symbol, data]) => {
    // Calculate what the price was 24h ago using the current price and 24h change percent
    // Formula: price24hAgo = currentPrice / (1 + (changePercent / 100))
    const price24h = data.price / (1 + (data.changePercent / 100));
    price24hAgo[symbol] = price24h;
    console.log(`[PRICE 24H] ${symbol}: Current=$${data.price}, 24h ago=$${price24h.toFixed(2)}, Change=${data.changePercent.toFixed(2)}%`);
  });
  
  // Update 24h-ago prices every hour to keep them accurate
  setInterval(() => {
    Object.entries(priceCache).forEach(([symbol, data]) => {
      const price24h = data.price / (1 + (data.changePercent / 100));
      price24hAgo[symbol] = price24h;
    });
    console.log('[PRICE 24H] Updated 24h-ago baseline prices');
  }, 3600000); // Every hour
  
  // Try Coinbase WebSocket first (fastest, free)
  connectCoinbase();
  
  // If Coinbase fails after 3 seconds, try Kraken
  setTimeout(() => {
    if (!coinbaseWs || coinbaseWs.readyState !== WebSocket.OPEN) {
      connectKraken();
    }
  }, 3000);
  
  // If both fail after 6 seconds, use CoinGecko polling
  setTimeout(() => {
    if ((!coinbaseWs || coinbaseWs.readyState !== WebSocket.OPEN) &&
        (!krakenWs || krakenWs.readyState !== WebSocket.OPEN)) {
      activeSource = 'coingecko';
      startCoinGeckoPolling();
    }
  }, 6000);
  
  isInitialized = true;
  console.log('[CryptoPrices] ✅ Price service initialized');
}

/**
 * Get all current market prices
 */
export function getAllMarketPrices(): PriceUpdate[] {
  const prices = Object.values(priceCache);
  console.log(`[getAllMarketPrices] Returning ${prices.length} prices, BTC:`, priceCache['BTC']);
  return prices;
}

/**
 * Get price for a specific symbol
 */
export function getMarketPrice(symbol: string): PriceUpdate | null {
  return priceCache[symbol] || null;
}

/**
 * Get current active source
 */
export function getActiveSource(): string {
  return activeSource;
}

/**
 * Cleanup on shutdown
 */
export function shutdownPriceService() {
  if (coinbaseWs) {
    coinbaseWs.close();
    coinbaseWs = null;
  }
  if (krakenWs) {
    krakenWs.close();
    krakenWs = null;
  }
  stopCoinGeckoPolling();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  isInitialized = false;
  console.log('[CryptoPrices] Shutdown complete');
}
