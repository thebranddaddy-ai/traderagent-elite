import { db } from '../db';
import { volatilityForecasts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VolatilityForecast {
  symbol: string;
  currentVolatility: number;
  predictedVolatility: number;
  timeframe: '4h' | '24h' | '7d';
  volatilityTrend: 'increasing' | 'decreasing' | 'stable';
  tradingRecommendation: 'reduce_exposure' | 'normal' | 'opportunity';
  bestTimeToTrade?: { start: string; end: string }[];
}

function calculateVolatility(priceData: number[]): number {
  if (priceData.length < 2) return 0;

  const returns = [];
  for (let i = 1; i < priceData.length; i++) {
    returns.push((priceData[i] - priceData[i - 1]) / priceData[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return stdDev * 100; // Convert to percentage
}

export async function generateVolatilityForecast(
  symbol: string,
  currentPrice: number,
  historicalPrices: number[],
  timeframe: '4h' | '24h' | '7d'
) {
  try {
    // Calculate current volatility from historical data
    const currentVolatility = calculateVolatility(historicalPrices);

    // Use AI to predict future volatility
    const forecastPrompt = `As a market volatility expert, forecast ${symbol} volatility for the next ${timeframe}:

Current Data:
- Current Price: $${currentPrice}
- Current Volatility: ${currentVolatility.toFixed(2)}%
- Price Range (recent): $${Math.min(...historicalPrices)} - $${Math.max(...historicalPrices)}

Analyze and predict:
1. Expected volatility level
2. Volatility trend (increasing/decreasing/stable)
3. Trading recommendation (reduce_exposure/normal/opportunity)
4. Best trading time windows if applicable

Format as JSON:
{
  "predicted_volatility": 0,
  "volatility_trend": "...",
  "trading_recommendation": "...",
  "best_time_to_trade": [{"start": "09:00", "end": "11:00"}],
  "reasoning": "..."
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: forecastPrompt }],
      max_tokens: 400,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    // Calculate realistic prediction
    const predictedVolatility = aiResponse.predicted_volatility || currentVolatility * 1.1;
    
    let volatilityTrend: 'increasing' | 'decreasing' | 'stable';
    if (predictedVolatility > currentVolatility * 1.15) {
      volatilityTrend = 'increasing';
    } else if (predictedVolatility < currentVolatility * 0.85) {
      volatilityTrend = 'decreasing';
    } else {
      volatilityTrend = 'stable';
    }

    // Determine trading recommendation
    let tradingRecommendation: 'reduce_exposure' | 'normal' | 'opportunity';
    if (predictedVolatility > 15) {
      tradingRecommendation = 'reduce_exposure'; // High volatility = risk
    } else if (predictedVolatility < 5) {
      tradingRecommendation = 'opportunity'; // Low volatility = potential breakout
    } else {
      tradingRecommendation = 'normal';
    }

    const forecast: VolatilityForecast = {
      symbol,
      currentVolatility,
      predictedVolatility,
      timeframe,
      volatilityTrend: aiResponse.volatility_trend || volatilityTrend,
      tradingRecommendation: aiResponse.trading_recommendation || tradingRecommendation,
      bestTimeToTrade: aiResponse.best_time_to_trade,
    };

    // Save to database
    await db.insert(volatilityForecasts).values({
      symbol,
      currentVolatility: currentVolatility.toString(),
      predictedVolatility: predictedVolatility.toString(),
      timeframe,
      volatilityTrend: forecast.volatilityTrend,
      tradingRecommendation: forecast.tradingRecommendation,
      bestTimeToTrade: forecast.bestTimeToTrade ? JSON.stringify(forecast.bestTimeToTrade) : null,
    });

    return forecast;
  } catch (error) {
    console.error('Error generating volatility forecast:', error);
    throw error;
  }
}

export async function getVolatilityForecasts(symbol: string) {
  try {
    const forecasts = await db.query.volatilityForecasts.findMany({
      where: eq(volatilityForecasts.symbol, symbol),
      orderBy: [desc(volatilityForecasts.timestamp)],
      limit: 10,
    });

    return forecasts.map(forecast => ({
      ...forecast,
      bestTimeToTrade: forecast.bestTimeToTrade ? JSON.parse(forecast.bestTimeToTrade) : null,
    }));
  } catch (error) {
    console.error('Error fetching volatility forecasts:', error);
    throw error;
  }
}

export async function getLatestVolatilityAnalysis(symbols: string[]) {
  try {
    const analysis = [];

    for (const symbol of symbols) {
      const latest = await db.query.volatilityForecasts.findFirst({
        where: eq(volatilityForecasts.symbol, symbol),
        orderBy: [desc(volatilityForecasts.timestamp)],
      });

      if (latest) {
        analysis.push({
          ...latest,
          bestTimeToTrade: latest.bestTimeToTrade ? JSON.parse(latest.bestTimeToTrade) : null,
        });
      }
    }

    return analysis;
  } catch (error) {
    console.error('Error fetching latest volatility analysis:', error);
    throw error;
  }
}

export async function getMarketVolatilityOverview(symbols: string[] = ['BTC', 'ETH', 'SOL']) {
  try {
    const overview = {
      highVolatility: [] as string[],
      normalVolatility: [] as string[],
      lowVolatility: [] as string[],
      marketCondition: 'normal' as 'calm' | 'normal' | 'volatile' | 'extreme',
    };

    for (const symbol of symbols) {
      const latest = await db.query.volatilityForecasts.findFirst({
        where: eq(volatilityForecasts.symbol, symbol),
        orderBy: [desc(volatilityForecasts.timestamp)],
      });

      if (latest) {
        const vol = parseFloat(latest.predictedVolatility);
        if (vol > 15) {
          overview.highVolatility.push(symbol);
        } else if (vol < 5) {
          overview.lowVolatility.push(symbol);
        } else {
          overview.normalVolatility.push(symbol);
        }
      }
    }

    // Determine overall market condition
    if (overview.highVolatility.length >= symbols.length * 0.7) {
      overview.marketCondition = 'volatile';
    } else if (overview.highVolatility.length >= symbols.length * 0.5) {
      overview.marketCondition = 'normal';
    } else if (overview.lowVolatility.length >= symbols.length * 0.7) {
      overview.marketCondition = 'calm';
    } else {
      overview.marketCondition = 'normal';
    }

    return overview;
  } catch (error) {
    console.error('Error generating market volatility overview:', error);
    throw error;
  }
}
