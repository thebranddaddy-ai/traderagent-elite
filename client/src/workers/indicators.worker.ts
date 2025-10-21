// Web Worker for off-thread indicator calculations
// This prevents UI blocking when calculating indicators for large datasets

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorRequest {
  type: 'rsi' | 'macd' | 'ema' | 'sma' | 'bollinger' | 'stochastic' | 'obv' | 'all';
  data: OHLCVCandle[];
  params: any;
  requestId: string;
}

export interface IndicatorResponse {
  type: string;
  data: any;
  requestId: string;
  calcTime: number;
  error?: string;
}

// Helper function to calculate SMA
function calculateSMAArray(prices: number[], period: number): number[] {
  const smaArray: number[] = [];
  
  for (let i = 0; i < period - 1; i++) {
    smaArray.push(NaN); // Not enough data points
  }

  for (let i = period - 1; i < prices.length; i++) {
    const subset = prices.slice(i - period + 1, i + 1);
    const sma = subset.reduce((sum, price) => sum + price, 0) / period;
    smaArray.push(sma);
  }

  return smaArray;
}

// Helper function to calculate EMA
function calculateEMAArray(prices: number[], period: number): number[] {
  const emaArray: number[] = [];
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  
  for (let i = 0; i < period; i++) {
    emaArray.push(NaN); // Not enough data points
  }
  emaArray[period - 1] = ema;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    emaArray.push(ema);
  }

  return emaArray;
}

// Calculate RSI for all candles
function calculateRSIWorker(data: OHLCVCandle[], period: number = 14): { time: number; value: number }[] {
  const prices = data.map(d => d.close);
  const result: { time: number; value: number }[] = [];

  for (let i = period; i < prices.length; i++) {
    const subset = prices.slice(Math.max(0, i - period), i + 1);
    const gains: number[] = [];
    const losses: number[] = [];

    for (let j = 1; j < subset.length; j++) {
      const change = subset[j] - subset[j - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / period;
    
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

// Calculate MACD for all candles
function calculateMACDWorker(
  data: OHLCVCandle[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { time: number; macd: number; signal: number; histogram: number }[] {
  const prices = data.map(d => d.close);
  const emaFast = calculateEMAArray(prices, fast);
  const emaSlow = calculateEMAArray(prices, slow);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = calculateEMAArray(macdLine.slice(slow - 1), signal);
  const result: { time: number; macd: number; signal: number; histogram: number }[] = [];

  for (let i = slow - 1; i < data.length; i++) {
    const signalIdx = i - (slow - 1);
    const macdValue = macdLine[i];
    const signalValue = signalLine[signalIdx];
    const histogram = macdValue - signalValue;

    result.push({
      time: data[i].time,
      macd: macdValue,
      signal: signalValue,
      histogram,
    });
  }

  return result;
}

// Calculate Bollinger Bands for all candles
function calculateBollingerWorker(
  data: OHLCVCandle[],
  period: number = 20,
  stdDev: number = 2
): { time: number; upper: number; middle: number; lower: number }[] {
  const result: { time: number; upper: number; middle: number; lower: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const subset = data.slice(i - period + 1, i + 1).map(d => d.close);
    const sma = subset.reduce((sum, price) => sum + price, 0) / period;
    const variance = subset.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: sma + stdDev * sd,
      middle: sma,
      lower: sma - stdDev * sd,
    });
  }

  return result;
}

// Calculate Stochastic for all candles
function calculateStochasticWorker(
  data: OHLCVCandle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { time: number; k: number; d: number }[] {
  const kValues: { time: number; k: number }[] = [];

  // Calculate %K for all possible points
  for (let i = kPeriod - 1; i < data.length; i++) {
    const subset = data.slice(i - kPeriod + 1, i + 1);
    const lowestLow = Math.min(...subset.map(d => d.low));
    const highestHigh = Math.max(...subset.map(d => d.high));
    const currentClose = subset[subset.length - 1].close;
    
    const k = highestHigh !== lowestLow 
      ? ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100 
      : 50;
    
    kValues.push({ time: data[i].time, k });
  }

  // Calculate %D (SMA of %K)
  const result: { time: number; k: number; d: number }[] = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    const dSubset = kValues.slice(i - dPeriod + 1, i + 1);
    const d = dSubset.reduce((sum, val) => sum + val.k, 0) / dPeriod;
    
    result.push({
      time: kValues[i].time,
      k: kValues[i].k,
      d,
    });
  }

  return result;
}

// Calculate OBV (On-Balance Volume) for all candles
function calculateOBVWorker(data: OHLCVCandle[]): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  let obv = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      // First candle: OBV starts at 0
      result.push({ time: data[i].time, value: 0 });
    } else {
      // Compare current close to previous close
      if (data[i].close > data[i - 1].close) {
        obv += data[i].volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= data[i].volume;
      }
      // If close === previous close, OBV stays the same
      
      result.push({ time: data[i].time, value: obv });
    }
  }

  return result;
}

// Listen for messages from the main thread
self.onmessage = (event: MessageEvent<IndicatorRequest>) => {
  const startTime = performance.now();
  const { type, data, params, requestId } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'rsi':
        result = calculateRSIWorker(data, params.period || 14);
        break;

      case 'macd':
        result = calculateMACDWorker(
          data,
          params.fast || 12,
          params.slow || 26,
          params.signal || 9
        );
        break;

      case 'sma':
        const smaArray = calculateSMAArray(data.map(d => d.close), params.period || 20);
        result = data.map((d, i) => ({ time: d.time, value: smaArray[i] })).filter(d => !isNaN(d.value));
        break;

      case 'ema':
        const emaArray = calculateEMAArray(data.map(d => d.close), params.period || 20);
        result = data.map((d, i) => ({ time: d.time, value: emaArray[i] })).filter(d => !isNaN(d.value));
        break;

      case 'bollinger':
        result = calculateBollingerWorker(
          data,
          params.period || 20,
          params.stdDev || 2
        );
        break;

      case 'stochastic':
        result = calculateStochasticWorker(
          data,
          params.kPeriod || 14,
          params.dPeriod || 3
        );
        break;

      case 'obv':
        result = calculateOBVWorker(data);
        break;

      case 'all':
        result = {
          rsi: calculateRSIWorker(data, params.rsi?.period || 14),
          macd: calculateMACDWorker(data, params.macd?.fast || 12, params.macd?.slow || 26, params.macd?.signal || 9),
          bollinger: calculateBollingerWorker(data, params.bollinger?.period || 20, params.bollinger?.stdDev || 2),
          stochastic: calculateStochasticWorker(data, params.stochastic?.kPeriod || 14, params.stochastic?.dPeriod || 3),
        };
        break;

      default:
        throw new Error(`Unknown indicator type: ${type}`);
    }

    const calcTime = performance.now() - startTime;

    const response: IndicatorResponse = {
      type,
      data: result,
      requestId,
      calcTime,
    };

    self.postMessage(response);
  } catch (error: any) {
    const calcTime = performance.now() - startTime;

    const response: IndicatorResponse = {
      type,
      data: null,
      requestId,
      calcTime,
      error: error?.message || 'Unknown error during calculation',
    };

    self.postMessage(response);
  }
};

// Export empty object to satisfy TypeScript module requirements
export {};
