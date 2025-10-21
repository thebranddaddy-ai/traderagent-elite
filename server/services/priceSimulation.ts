import { setMarketPrice, getMarketPrice } from "./paperTrading";

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  volume?: number;
  marketCap?: number;
}

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol?: number;
  usd_market_cap?: number;
}

interface CoinGeckoResponse {
  bitcoin?: CoinGeckoPrice;
  ethereum?: CoinGeckoPrice;
  solana?: CoinGeckoPrice;
  cardano?: CoinGeckoPrice;
  'avalanche-2'?: CoinGeckoPrice;
  'matic-network'?: CoinGeckoPrice;
  polkadot?: CoinGeckoPrice;
  chainlink?: CoinGeckoPrice;
  ripple?: CoinGeckoPrice;
}

// Map symbols to CoinGecko IDs
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

// Store base prices from real API and previous simulated prices
const basePrices: Record<string, number> = {};
const previousPrices: Record<string, number> = {};
const coinVolumes: Record<string, number> = {};
const coinMarketCaps: Record<string, number> = {};
let lastRealFetchTime = 0;
const REAL_FETCH_INTERVAL = 5 * 60 * 1000; // Fetch real prices every 5 minutes

// Volatility for micro-movements (smaller than before)
const MICRO_VOLATILITY = {
  BTC: 0.001,  // 0.1% max change
  ETH: 0.0015, // 0.15% max change  
  SOL: 0.002,  // 0.2% max change
  ADA: 0.0025, // 0.25% max change
  AVAX: 0.002, // 0.2% max change
  MATIC: 0.003, // 0.3% max change
  DOT: 0.002,  // 0.2% max change
  LINK: 0.0025, // 0.25% max change
  XRP: 0.003,  // 0.3% max change
};

async function fetchRealPricesFromAPI(): Promise<void> {
  try {
    const coinIds = Object.values(COINGECKO_IDS).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24h_change=true&include_24h_vol=true&include_market_cap=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[REAL API] CoinGecko returned ${response.status}, using cached prices`);
      return;
    }
    
    const data: CoinGeckoResponse = await response.json();
    
    for (const [symbol, coinId] of Object.entries(COINGECKO_IDS)) {
      const coinData = data[coinId as keyof CoinGeckoResponse];
      
      if (coinData) {
        const realPrice = coinData.usd;
        basePrices[symbol] = realPrice;
        previousPrices[symbol] = realPrice;
        if (coinData.usd_24h_vol) coinVolumes[symbol] = coinData.usd_24h_vol;
        if (coinData.usd_market_cap) coinMarketCaps[symbol] = coinData.usd_market_cap;
        setMarketPrice(symbol, parseFloat(realPrice.toFixed(2)));
        console.log(`[REAL API] ${symbol} base price updated -> $${realPrice.toLocaleString()}`);
      }
    }
    
    lastRealFetchTime = Date.now();
  } catch (error: any) {
    console.error("[REAL API ERROR]", error?.message || error);
  }
}

function simulateMicroMovement(symbol: string): PriceUpdate {
  // Use base price if available, otherwise current price
  const basePrice = basePrices[symbol] || getMarketPrice(symbol);
  const currentPrice = previousPrices[symbol] || basePrice;
  const volatility = MICRO_VOLATILITY[symbol as keyof typeof MICRO_VOLATILITY] || 0.001;
  
  // Random walk around the base price (±volatility)
  const changePercent = (Math.random() - 0.5) * volatility * 100;
  const change = currentPrice * (changePercent / 100);
  const newPrice = Math.max(currentPrice + change, currentPrice * 0.5);
  
  previousPrices[symbol] = parseFloat(newPrice.toFixed(2));
  setMarketPrice(symbol, parseFloat(newPrice.toFixed(2)));
  
  return {
    symbol,
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    timestamp: Date.now(),
    volume: coinVolumes[symbol],
    marketCap: coinMarketCaps[symbol],
  };
}

export async function fetchRealPrices(): Promise<PriceUpdate[]> {
  // Check if we need to fetch real prices
  const timeSinceLastFetch = Date.now() - lastRealFetchTime;
  if (timeSinceLastFetch > REAL_FETCH_INTERVAL || lastRealFetchTime === 0) {
    await fetchRealPricesFromAPI();
  }
  
  // Return simulated micro-movements based on real base prices
  return ["BTC", "ETH", "SOL", "ADA", "AVAX", "MATIC", "DOT", "LINK", "XRP"].map(symbol => simulateMicroMovement(symbol));
}

export function startPriceSimulation(
  broadcastFn: (updates: PriceUpdate[]) => void,
  intervalMs: number = 3000 // Update every 3 seconds with micro-movements
): NodeJS.Timeout {
  console.log(`[HYBRID PRICES] Real prices from CoinGecko every 5min + micro-movements every ${intervalMs / 1000}s`);
  
  // Fetch real prices immediately on start
  fetchRealPrices().then(updates => {
    if (updates.length > 0) {
      broadcastFn(updates);
    }
  });
  
  return setInterval(async () => {
    const updates = await fetchRealPrices();
    if (updates.length > 0) {
      broadcastFn(updates);
    }
  }, intervalMs);
}
