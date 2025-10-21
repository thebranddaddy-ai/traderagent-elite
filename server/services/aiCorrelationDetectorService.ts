import { db } from '../db';
import { correlations, paperPositions, paperWallets } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CorrelationAnalysis {
  asset1: string;
  asset2: string;
  correlationScore: number; // -100 to 100
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  alternatives: string[];
}

// Historical correlation data (simplified - in production would use real price data)
const KNOWN_CORRELATIONS: Record<string, Record<string, number>> = {
  'BTC': { 'ETH': 75, 'SOL': 70, 'USDT': -5 },
  'ETH': { 'BTC': 75, 'SOL': 80, 'USDT': -5 },
  'SOL': { 'BTC': 70, 'ETH': 80, 'USDT': -5 },
  'USDT': { 'BTC': -5, 'ETH': -5, 'SOL': -5 },
};

function calculateCorrelation(asset1: string, asset2: string): number {
  const a1 = asset1.replace('USDT', '');
  const a2 = asset2.replace('USDT', '');
  
  if (KNOWN_CORRELATIONS[a1] && KNOWN_CORRELATIONS[a1][a2] !== undefined) {
    return KNOWN_CORRELATIONS[a1][a2];
  }
  if (KNOWN_CORRELATIONS[a2] && KNOWN_CORRELATIONS[a2][a1] !== undefined) {
    return KNOWN_CORRELATIONS[a2][a1];
  }
  
  // Default moderate positive correlation for crypto assets
  if (a1 !== a2 && !a1.includes('USD') && !a2.includes('USD')) {
    return 60;
  }
  
  return 0;
}

export async function analyzePortfolioCorrelations(userId: string) {
  try {
    // Get user's positions
    const wallet = await db.query.paperWallets.findFirst({
      where: eq(paperWallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const positions = await db.query.paperPositions.findMany({
      where: eq(paperPositions.walletId, wallet.id),
    });

    if (positions.length < 2) {
      return null; // Need at least 2 assets to analyze correlation
    }

    const correlationResults: CorrelationAnalysis[] = [];

    // Analyze each pair of assets
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const asset1 = positions[i].symbol;
        const asset2 = positions[j].symbol;

        const correlationScore = calculateCorrelation(asset1, asset2);

        // Determine risk level based on correlation
        let riskLevel: 'low' | 'medium' | 'high';
        if (Math.abs(correlationScore) >= 70) {
          riskLevel = 'high';
        } else if (Math.abs(correlationScore) >= 40) {
          riskLevel = 'medium';
        } else {
          riskLevel = 'low';
        }

        // Use AI to generate recommendations
        const correlationPrompt = `As a portfolio risk analyst, analyze this asset correlation:

Assets: ${asset1} and ${asset2}
Correlation Score: ${correlationScore} (-100 to 100 scale)
Risk Level: ${riskLevel}

Provide:
1. Risk assessment and recommendation
2. 2-3 alternative uncorrelated assets to improve diversification

Format as JSON:
{
  "recommendation": "...",
  "alternatives": ["...", "...", "..."]
}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: correlationPrompt }],
          max_tokens: 250,
          temperature: 0.6,
          response_format: { type: 'json_object' },
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

        // Default alternatives if AI doesn't provide
        const defaultAlternatives = correlationScore > 0 
          ? ['Stablecoins (USDT, USDC)', 'Precious metals', 'DeFi tokens with low correlation']
          : ['Major cryptocurrencies', 'Layer 2 solutions', 'Emerging altcoins'];

        const analysis: CorrelationAnalysis = {
          asset1,
          asset2,
          correlationScore,
          riskLevel,
          recommendation: aiResponse.recommendation || 
            `${Math.abs(correlationScore)}% correlation detected - consider diversification`,
          alternatives: aiResponse.alternatives || defaultAlternatives,
        };

        correlationResults.push(analysis);

        // Save to database
        await db.insert(correlations).values({
          userId,
          asset1,
          asset2,
          correlationScore: correlationScore.toString(),
          riskLevel,
          recommendation: analysis.recommendation,
          alternatives: JSON.stringify(analysis.alternatives),
        });
      }
    }

    // Calculate overall portfolio correlation risk
    const avgCorrelation = correlationResults.reduce((sum, c) => sum + Math.abs(c.correlationScore), 0) / correlationResults.length;
    const highCorrelationPairs = correlationResults.filter(c => Math.abs(c.correlationScore) >= 70).length;

    return {
      correlations: correlationResults,
      overallCorrelationRisk: avgCorrelation >= 70 ? 'high' : avgCorrelation >= 40 ? 'medium' : 'low',
      highCorrelationPairs,
      diversificationScore: Math.max(0, 100 - avgCorrelation),
    };
  } catch (error) {
    console.error('Error analyzing portfolio correlations:', error);
    throw error;
  }
}

export async function getCorrelationAnalysis(userId: string) {
  try {
    const analysis = await db.query.correlations.findMany({
      where: eq(correlations.userId, userId),
      orderBy: [desc(correlations.timestamp)],
      limit: 20,
    });

    return analysis.map(item => ({
      ...item,
      alternatives: JSON.parse(item.alternatives),
    }));
  } catch (error) {
    console.error('Error fetching correlation analysis:', error);
    throw error;
  }
}

export async function suggestUncorrelatedAssets(userId: string, currentAssets: string[]) {
  try {
    const prompt = `As a portfolio diversification expert, suggest 3-5 cryptocurrency assets that have low correlation with these current holdings:

Current Assets: ${currentAssets.join(', ')}

Provide assets that:
1. Have different use cases/sectors
2. Low price correlation (< 40%)
3. Strong fundamentals

Format as JSON:
{
  "suggestions": [
    {"symbol": "...", "reason": "...", "correlation_estimate": 0}
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
    return aiResponse.suggestions || [];
  } catch (error) {
    console.error('Error suggesting uncorrelated assets:', error);
    throw error;
  }
}
