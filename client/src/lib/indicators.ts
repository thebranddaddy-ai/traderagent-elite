import { CandlestickData } from "lightweight-charts";

export interface IndicatorData {
  ema?: number | null;
  rsi?: number | null;
  macd?: { value: number; signal: number; histogram: number } | null;
  vwap?: number | null;
  bollinger?: { upper: number; middle: number; lower: number } | null;
  stochastic?: { k: number; d: number } | null;
}

// Calculate EMA (Exponential Moving Average)
export function calculateEMA(data: CandlestickData[], period: number): number | null {
  if (data.length < period) return null;

  const prices = data.map(d => d.close);
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

// Calculate RSI (Relative Strength Index)
export function calculateRSI(data: CandlestickData[], period: number = 14): number | null {
  if (data.length < period + 1) return null;

  const prices = data.map(d => d.close);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

// Calculate MACD (Moving Average Convergence Divergence)
export function calculateMACD(
  data: CandlestickData[], 
  fast: number = 12, 
  slow: number = 26, 
  signal: number = 9
): { value: number; signal: number; histogram: number } | null {
  if (data.length < slow + signal) return null;

  const prices = data.map(d => d.close);
  
  // Calculate EMA fast and EMA slow for each point
  const macdValues: number[] = [];
  
  for (let i = slow - 1; i < prices.length; i++) {
    const subset = data.slice(0, i + 1);
    const emaFast = calculateEMA(subset, fast);
    const emaSlow = calculateEMA(subset, slow);
    
    if (emaFast && emaSlow) {
      macdValues.push(emaFast - emaSlow);
    }
  }

  if (macdValues.length < signal) return null;

  // Calculate signal line (signal-period EMA of MACD values)
  const macdAsCandles = macdValues.map((val, i) => ({
    time: i,
    open: val,
    high: val,
    low: val,
    close: val,
  })) as CandlestickData[];
  
  const signalLine = calculateEMA(macdAsCandles, signal) || 0;
  const currentMacd = macdValues[macdValues.length - 1];
  const histogram = currentMacd - signalLine;

  return {
    value: currentMacd,
    signal: signalLine,
    histogram,
  };
}

// Calculate VWAP (Volume Weighted Average Price)
export function calculateVWAP(data: CandlestickData[]): number | null {
  if (data.length === 0) return null;

  // Note: TradingView Lightweight Charts doesn't include volume in CandlestickData by default
  // For now, we'll use a simple average price. In production, volume data would be needed.
  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
  const vwap = typicalPrices.reduce((sum, price) => sum + price, 0) / typicalPrices.length;

  return vwap;
}

// Calculate Bollinger Bands
export function calculateBollingerBands(
  data: CandlestickData[], 
  period: number = 20, 
  stdDev: number = 2
): { upper: number; middle: number; lower: number } | null {
  if (data.length < period) return null;

  const prices = data.slice(-period).map(d => d.close);
  const sma = prices.reduce((sum, price) => sum + price, 0) / period;

  const squaredDiffs = prices.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
  const sd = Math.sqrt(variance);

  return {
    upper: sma + stdDev * sd,
    middle: sma,
    lower: sma - stdDev * sd,
  };
}

// Calculate Stochastic Oscillator
export function calculateStochastic(
  data: CandlestickData[], 
  kPeriod: number = 14, 
  dPeriod: number = 3
): { k: number; d: number } | null {
  if (data.length < kPeriod + dPeriod - 1) return null;

  // Calculate %K values for the last dPeriod points
  const kValues: number[] = [];
  
  for (let i = data.length - dPeriod; i < data.length; i++) {
    const subset = data.slice(Math.max(0, i - kPeriod + 1), i + 1);
    
    const lowestLow = Math.min(...subset.map(d => d.low));
    const highestHigh = Math.max(...subset.map(d => d.high));
    const currentClose = subset[subset.length - 1].close;
    
    const k = highestHigh !== lowestLow 
      ? ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100 
      : 50;
    
    kValues.push(k);
  }

  // Calculate %D (SMA of %K)
  const currentK = kValues[kValues.length - 1];
  const d = kValues.reduce((sum, val) => sum + val, 0) / kValues.length;

  return { k: currentK, d };
}

// Calculate all indicators at once (with default parameters)
export function calculateAllIndicators(data: CandlestickData[]): IndicatorData {
  return {
    ema: calculateEMA(data, 20),
    rsi: calculateRSI(data, 14),
    macd: calculateMACD(data, 12, 26, 9),
    vwap: calculateVWAP(data),
    bollinger: calculateBollingerBands(data, 20, 2),
    stochastic: calculateStochastic(data, 14, 3),
  };
}
