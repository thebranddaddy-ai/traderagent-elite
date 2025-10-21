/**
 * What-If Scenario Simulation Service (Phase D)
 * 
 * Provides probabilistic P&L simulations using Monte-Carlo methods with historical resampling.
 * Helps traders preview potential outcomes before executing trades.
 * 
 * REQUEST/RESPONSE CONTRACT:
 * 
 * Request:
 * {
 *   userId: string,
 *   symbol: string,           // e.g. "BTC", "ETH", "SOL"
 *   side: "buy" | "sell",
 *   size: number,             // Position size in USD
 *   entryPrice?: number,      // Entry price (optional for market orders)
 *   slippagePct: number,      // Expected slippage percentage
 *   timeframe: "1h" | "4h" | "24h",
 *   lookbackDays: number      // Days of historical data to sample
 * }
 * 
 * Response:
 * {
 *   summary: string,
 *   confidence: number,       // 0-100
 *   distributions: {
 *     "1h": { median, p5, p95, mean, stdDev },
 *     "4h": { ... },
 *     "24h": { ... }
 *   },
 *   probabilityBuckets: [
 *     { range: "<-3%", probability: 0.12 },
 *     { range: "-3%..0%", probability: 0.28 },
 *     ...
 *   ],
 *   riskSignals: string[],
 *   suggestedAlternatives: Array<{
 *     reason: string,
 *     size: number,
 *     entryPrice?: number,
 *     slippagePct: number
 *   }>
 * }
 */

import { db } from "../db";
import { paperOrders } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getMarketPrice } from "./paperTrading";

// Deterministic random number generator for testing
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

interface SimulationRequest {
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  entryPrice?: number;
  slippagePct: number;
  timeframe: "1h" | "4h" | "24h";
  lookbackDays: number;
}

interface Distribution {
  median: number;
  p5: number;
  p95: number;
  mean: number;
  stdDev: number;
}

interface ProbabilityBucket {
  range: string;
  probability: number;
}

interface SuggestedAlternative {
  reason: string;
  size: number;
  entryPrice?: number;
  slippagePct: number;
}

interface SimulationResult {
  summary: string;
  confidence: number;
  distributions: {
    "1h": Distribution;
    "4h": Distribution;
    "24h": Distribution;
  };
  probabilityBuckets: {
    veryNegative: number;
    negative: number;
    neutral: number;
    positive: number;
    veryPositive: number;
  };
  riskSignals: string[];
  suggestedAlternatives: SuggestedAlternative[];
}

/**
 * Fetch historical price returns for Monte-Carlo simulation
 * 
 * Note: Currently uses synthetic returns based on typical crypto volatility.
 * Future enhancement: Integrate with CoinGecko API for real historical data.
 */
async function getHistoricalReturns(
  symbol: string,
  lookbackDays: number
): Promise<number[]> {
  // Generate synthetic returns based on typical crypto volatility
  // Using deterministic seed based on symbol for consistency
  console.log(`[WHATIF] Generating synthetic returns for ${symbol} based on ${lookbackDays} day volatility model`);
  
  const returns: number[] = [];
  const random = new SeededRandom(symbol.charCodeAt(0) + lookbackDays);
  
  // Typical crypto hourly volatility varies by asset
  const volatilityMap: Record<string, number> = {
    'BTC': 0.008,  // 0.8% hourly volatility
    'ETH': 0.012,  // 1.2% hourly volatility
    'SOL': 0.015,  // 1.5% hourly volatility
  };
  
  const baseVolatility = volatilityMap[symbol.toUpperCase()] || 0.01; // Default 1%
  const drift = 0; // No trend bias (neutral market assumption)
  
  // Generate 200 sample returns for robust statistics
  for (let i = 0; i < 200; i++) {
    const u1 = random.next();
    const u2 = random.next();
    // Box-Muller transform for normal distribution
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const returnPct = drift + baseVolatility * z;
    returns.push(returnPct);
  }
  
  return returns;
}

/**
 * Run Monte-Carlo simulation using historical resampling
 */
function runMonteCarloSimulation(
  historicalReturns: number[],
  numSimulations: number,
  numPeriods: number,
  seed?: number
): number[] {
  const random = new SeededRandom(seed);
  const results: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    let cumulativeReturn = 1;

    for (let period = 0; period < numPeriods; period++) {
      // Randomly sample from historical returns
      const randomIndex = Math.floor(random.next() * historicalReturns.length);
      const sampledReturn = historicalReturns[randomIndex];
      cumulativeReturn *= (1 + sampledReturn);
    }

    // Convert to percentage return
    const totalReturn = (cumulativeReturn - 1) * 100;
    results.push(totalReturn);
  }

  return results;
}

/**
 * Calculate distribution statistics
 */
function calculateDistribution(returns: number[]): Distribution {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;

  const median = sorted[Math.floor(n / 2)];
  const p5 = sorted[Math.floor(n * 0.05)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const mean = returns.reduce((sum, r) => sum + r, 0) / n;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    median: parseFloat(median.toFixed(2)),
    p5: parseFloat(p5.toFixed(2)),
    p95: parseFloat(p95.toFixed(2)),
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
  };
}

/**
 * Calculate probability buckets as object with named categories (percentages)
 */
function calculateProbabilityBuckets(returns: number[]): {
  veryNegative: number;
  negative: number;
  neutral: number;
  positive: number;
  veryPositive: number;
} {
  const buckets = [
    { range: "<-10%", count: 0 },
    { range: "-10%..-5%", count: 0 },
    { range: "-5%..-3%", count: 0 },
    { range: "-3%..0%", count: 0 },
    { range: "0..+3%", count: 0 },
    { range: "+3..+5%", count: 0 },
    { range: "+5..+10%", count: 0 },
    { range: "+10%", count: 0 },
  ];

  returns.forEach((r) => {
    if (r < -10) buckets[0].count++;
    else if (r < -5) buckets[1].count++;
    else if (r < -3) buckets[2].count++;
    else if (r < 0) buckets[3].count++;
    else if (r < 3) buckets[4].count++;
    else if (r < 5) buckets[5].count++;
    else if (r < 10) buckets[6].count++;
    else buckets[7].count++;
  });

  const total = returns.length;
  
  // Return as object with percentages (0-100)
  return {
    veryNegative: parseFloat(((buckets[0].count / total) * 100).toFixed(1)),
    negative: parseFloat((((buckets[1].count + buckets[2].count) / total) * 100).toFixed(1)),
    neutral: parseFloat((((buckets[3].count + buckets[4].count) / total) * 100).toFixed(1)),
    positive: parseFloat((((buckets[5].count + buckets[6].count) / total) * 100).toFixed(1)),
    veryPositive: parseFloat(((buckets[7].count / total) * 100).toFixed(1)),
  };
}

/**
 * Detect risk signals based on simulation results and user context
 */
async function detectRiskSignals(
  userId: string,
  symbol: string,
  side: string,
  size: number,
  distributions: { "1h": Distribution; "4h": Distribution; "24h": Distribution }
): Promise<string[]> {
  const signals: string[] = [];

  // Check for high downside risk
  if (distributions["1h"].p5 < -5) {
    signals.push(`High downside risk: 5% chance of losing ${Math.abs(distributions["1h"].p5).toFixed(1)}% or more in 1 hour`);
  }

  if (distributions["24h"].p5 < -15) {
    signals.push(`Severe 24h risk: 5% chance of ${Math.abs(distributions["24h"].p5).toFixed(1)}% or greater loss`);
  }

  // Check for high volatility
  if (distributions["1h"].stdDev > 3) {
    signals.push(`High volatility detected: ${distributions["1h"].stdDev.toFixed(1)}% standard deviation`);
  }

  // Check position size
  const LARGE_POSITION_THRESHOLD = 5000; // $5k
  if (size > LARGE_POSITION_THRESHOLD) {
    signals.push(`Large position size: $${size.toLocaleString()} could amplify losses`);
  }

  // Check recent trading patterns
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTrades = await db
    .select()
    .from(paperOrders)
    .where(
      and(
        sql`${paperOrders.walletId} IN (SELECT id FROM paper_wallets WHERE user_id = ${userId})`,
        sql`${paperOrders.timestamp} > ${oneDayAgo}`,
        eq(paperOrders.symbol, symbol)
      )
    )
    .limit(10);

  if (recentTrades.length >= 5) {
    signals.push(`Frequent trading in ${symbol}: ${recentTrades.length} trades in 24h may indicate overtrading`);
  }

  // Check for negative expected value
  if (distributions["24h"].mean < -2) {
    signals.push(`Negative expected return: Average outcome is ${distributions["24h"].mean.toFixed(1)}% loss`);
  }

  return signals;
}

/**
 * Generate alternative trade suggestions
 */
function generateAlternatives(
  size: number,
  slippagePct: number,
  riskSignals: string[]
): SuggestedAlternative[] {
  const alternatives: SuggestedAlternative[] = [];

  // Suggest size reduction if position is large or risky
  if (size > 5000 || riskSignals.some(s => s.includes("Large position") || s.includes("downside risk"))) {
    alternatives.push({
      reason: "Reduce position size to limit potential loss",
      size: Math.floor(size * 0.5),
      slippagePct: slippagePct * 0.8, // Better slippage with smaller size
    });
  }

  // Suggest tighter slippage if current is high
  if (slippagePct > 1) {
    alternatives.push({
      reason: "Tighten slippage tolerance to improve entry price",
      size,
      slippagePct: 0.5,
    });
  }

  // Suggest dollar-cost averaging for high volatility
  if (riskSignals.some(s => s.includes("volatility"))) {
    alternatives.push({
      reason: "Split into multiple smaller entries to average out volatility",
      size: Math.floor(size * 0.3),
      slippagePct,
    });
  }

  return alternatives;
}

/**
 * Main simulation function
 */
export async function simulateWhatIf(
  request: SimulationRequest,
  seed?: number
): Promise<SimulationResult> {
  const {
    userId,
    symbol,
    side,
    size,
    entryPrice,
    slippagePct,
    timeframe,
    lookbackDays,
  } = request;

  // Fetch historical returns
  const historicalReturns = await getHistoricalReturns(symbol, lookbackDays);

  // Get current price if not provided
  const currentPrice = entryPrice || getMarketPrice(symbol);

  // Run simulations for different timeframes
  const NUM_SIMULATIONS = 1000;
  const timeframePeriods: Record<string, number> = {
    "1h": 1,
    "4h": 4,
    "24h": 24,
  };

  const distributions: any = {};
  const allReturns: number[] = [];

  for (const tf of ["1h", "4h", "24h"]) {
    const periods = timeframePeriods[tf];
    let returns = runMonteCarloSimulation(
      historicalReturns,
      NUM_SIMULATIONS,
      periods,
      seed
    );
    
    // Invert returns for sell/short positions
    // Sell: price goes up = loss, price goes down = profit
    if (side === "sell") {
      returns = returns.map(r => -r);
    }
    
    distributions[tf] = calculateDistribution(returns);
    if (tf === timeframe) {
      allReturns.push(...returns);
    }
  }

  // Calculate probability buckets for requested timeframe
  const probabilityBuckets = calculateProbabilityBuckets(allReturns);

  // Detect risk signals
  const riskSignals = await detectRiskSignals(
    userId,
    symbol,
    side,
    size,
    distributions
  );

  // Generate alternative suggestions
  const suggestedAlternatives = generateAlternatives(size, slippagePct, riskSignals);

  // Calculate confidence based on data quality and risk level
  const dataQuality = historicalReturns.length > 50 ? 1 : 0.7;
  const riskPenalty = Math.max(0, 1 - riskSignals.length * 0.1);
  const confidence = Math.round(dataQuality * riskPenalty * 100);

  // Defensive: Validate all required data exists before returning
  if (!distributions["1h"] || !distributions["4h"] || !distributions["24h"]) {
    throw new Error("Failed to generate all required distribution timeframes");
  }

  // Validate all distributions have required numeric fields
  for (const tf of ["1h", "4h", "24h"] as const) {
    const dist = distributions[tf];
    if (!dist || typeof dist.median !== 'number' || typeof dist.p5 !== 'number' || typeof dist.p95 !== 'number') {
      throw new Error(`Invalid distribution data for ${tf}`);
    }
  }

  // Validate probability buckets exist and are valid
  const requiredBuckets = ['veryNegative', 'negative', 'neutral', 'positive', 'veryPositive'];
  for (const bucket of requiredBuckets) {
    if (typeof (probabilityBuckets as any)[bucket] !== 'number') {
      throw new Error(`Missing or invalid probability bucket: ${bucket}`);
    }
  }

  // Generate summary
  const expectedReturn = distributions[timeframe].median;
  const dollarReturn = (expectedReturn / 100) * size;
  const summary = `${timeframe} simulation: ${expectedReturn > 0 ? '+' : ''}${expectedReturn.toFixed(1)}% expected return ($${dollarReturn > 0 ? '+' : ''}${dollarReturn.toFixed(0)}). ${riskSignals.length > 0 ? `⚠️ ${riskSignals.length} risk signal${riskSignals.length > 1 ? 's' : ''} detected.` : 'Risk levels within normal range.'}`;

  return {
    summary,
    confidence,
    distributions,
    probabilityBuckets,
    riskSignals,
    suggestedAlternatives,
  };
}
