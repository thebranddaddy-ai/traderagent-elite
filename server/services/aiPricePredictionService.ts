import { db } from '../db';
import { pricePredictions } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PriceForecast {
  symbol: string;
  timeframe: '1h' | '4h' | '24h';
  currentPrice: number;
  predictedPrice: number;
  confidenceLevel: number;
  priceRange: { min: number; max: number };
  factors: string[];
}

export async function generatePricePrediction(
  symbol: string,
  currentPrice: number,
  timeframe: '1h' | '4h' | '24h',
  marketData?: {
    volume24h?: number;
    priceChange24h?: number;
    marketCap?: number;
  }
) {
  try {
    // Use AI to analyze market conditions and predict price
    const predictionPrompt = `As a crypto market analyst, predict ${symbol} price movement for the next ${timeframe}:

Current Market Data:
- Current Price: $${currentPrice}
- 24h Volume: ${marketData?.volume24h ? '$' + marketData.volume24h.toLocaleString() : 'N/A'}
- 24h Change: ${marketData?.priceChange24h ? marketData.priceChange24h.toFixed(2) + '%' : 'N/A'}

Provide prediction with:
1. Predicted price
2. Confidence level (0-100)
3. Price range (min-max)
4. Key factors influencing prediction

Format as JSON:
{
  "predicted_price": 0,
  "confidence": 0,
  "price_range": {"min": 0, "max": 0},
  "factors": ["...", "...", "..."]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: predictionPrompt }],
      max_tokens: 400,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    // Calculate realistic prediction based on current price and AI suggestion
    const volatilityFactor = {
      '1h': 0.02,  // 2% max change
      '4h': 0.05,  // 5% max change
      '24h': 0.10, // 10% max change
    };

    const maxChange = currentPrice * volatilityFactor[timeframe];
    const aiPrediction = aiResponse.predicted_price || currentPrice;
    
    // Constrain prediction to realistic range
    const predictedPrice = Math.max(
      currentPrice - maxChange,
      Math.min(currentPrice + maxChange, aiPrediction)
    );

    const priceRange = {
      min: aiResponse.price_range?.min || predictedPrice * 0.97,
      max: aiResponse.price_range?.max || predictedPrice * 1.03,
    };

    const forecast: PriceForecast = {
      symbol,
      timeframe,
      currentPrice,
      predictedPrice,
      confidenceLevel: aiResponse.confidence || 65,
      priceRange,
      factors: aiResponse.factors || ['Technical analysis', 'Market sentiment', 'Trading volume'],
    };

    // Save prediction to database
    await db.insert(pricePredictions).values({
      symbol,
      timeframe,
      currentPrice: currentPrice.toString(),
      predictedPrice: predictedPrice.toString(),
      confidenceLevel: forecast.confidenceLevel.toString(),
      priceRange: JSON.stringify(priceRange),
      factors: JSON.stringify(forecast.factors),
    });

    return forecast;
  } catch (error) {
    console.error('Error generating price prediction:', error);
    throw error;
  }
}

export async function getPredictions(symbol: string, timeframe?: '1h' | '4h' | '24h') {
  try {
    const conditions = timeframe
      ? and(eq(pricePredictions.symbol, symbol), eq(pricePredictions.timeframe, timeframe))
      : eq(pricePredictions.symbol, symbol);

    const predictions = await db.query.pricePredictions.findMany({
      where: conditions,
      orderBy: [desc(pricePredictions.timestamp)],
      limit: 10,
    });

    return predictions.map(pred => ({
      ...pred,
      priceRange: JSON.parse(pred.priceRange),
      factors: JSON.parse(pred.factors),
    }));
  } catch (error) {
    console.error('Error fetching predictions:', error);
    throw error;
  }
}

export async function updatePredictionAccuracy(predictionId: string, actualPrice: number) {
  try {
    const prediction = await db.query.pricePredictions.findFirst({
      where: eq(pricePredictions.id, predictionId),
    });

    if (!prediction) {
      return;
    }

    const predictedPrice = parseFloat(prediction.predictedPrice);
    const currentPrice = parseFloat(prediction.currentPrice);
    
    // Calculate accuracy based on how close prediction was
    const maxExpectedChange = Math.abs(predictedPrice - currentPrice);
    const actualChange = Math.abs(actualPrice - currentPrice);
    const accuracy = Math.max(0, 100 - (Math.abs(actualChange - maxExpectedChange) / currentPrice * 100));

    await db.update(pricePredictions)
      .set({ accuracy: accuracy.toString() })
      .where(eq(pricePredictions.id, predictionId));
  } catch (error) {
    console.error('Error updating prediction accuracy:', error);
  }
}

export async function getBulkPredictions(symbols: string[], timeframes: ('1h' | '4h' | '24h')[], currentPrices: Record<string, number>) {
  try {
    const predictions: PriceForecast[] = [];

    for (const symbol of symbols) {
      const price = currentPrices[symbol];
      if (!price) continue;

      for (const timeframe of timeframes) {
        const prediction = await generatePricePrediction(symbol, price, timeframe);
        predictions.push(prediction);
      }
    }

    return predictions;
  } catch (error) {
    console.error('Error generating bulk predictions:', error);
    throw error;
  }
}
