import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertMarketSentiment } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface NewsArticle {
  title: string;
  url: string;
  published_at: string;
  source: {
    title: string;
  };
}

interface CryptoPanicResponse {
  results: NewsArticle[];
}

export class AISentimentService {
  
  /**
   * Fetch latest crypto news from CryptoPanic API
   */
  async fetchCryptoNews(symbol: string, limit: number = 10): Promise<NewsArticle[]> {
    try {
      const currencyMap: Record<string, string> = {
        'BTC': 'BTC',
        'ETH': 'ETH',
        'SOL': 'SOL'
      };

      const currency = currencyMap[symbol] || symbol;
      // CryptoPanic free API endpoint (public access)
      const url = `https://cryptopanic.com/api/free/v1/posts/?currencies=${currency}&public=true`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`CryptoPanic API error: ${response.status}`);
        // Return mock news if API fails
        return this.getMockNews(symbol, limit);
      }

      const data: CryptoPanicResponse = await response.json();
      return data.results.slice(0, limit);
    } catch (error) {
      console.error("Error fetching crypto news:", error);
      // Return mock news on error
      return this.getMockNews(symbol, limit);
    }
  }

  /**
   * Get mock news data for fallback
   */
  private getMockNews(symbol: string, limit: number): NewsArticle[] {
    const mockNews: NewsArticle[] = [
      {
        title: `${symbol} Shows Strong Momentum as Trading Volume Increases`,
        url: "#",
        published_at: new Date().toISOString(),
        source: { title: "Crypto News" }
      },
      {
        title: `Analysts Predict ${symbol} Could Break Key Resistance Level`,
        url: "#",
        published_at: new Date().toISOString(),
        source: { title: "Market Watch" }
      },
      {
        title: `${symbol} Technical Analysis: What to Expect This Week`,
        url: "#",
        published_at: new Date().toISOString(),
        source: { title: "Trading Insights" }
      }
    ];

    return mockNews.slice(0, limit);
  }

  /**
   * Analyze market sentiment using OpenAI
   */
  async analyzeSentiment(
    symbol: string,
    newsArticles: NewsArticle[],
    currentPrice?: number
  ): Promise<InsertMarketSentiment> {
    try {
      const headlines = newsArticles.map(article => article.title).join('\n');
      
      const prompt = `Analyze the market sentiment for ${symbol} based on these recent news headlines:

${headlines}

Current ${symbol} price: $${currentPrice || 'N/A'}

Provide a JSON response with:
1. sentiment: "bullish", "bearish", or "neutral"
2. score: a number from -100 (extremely bearish) to +100 (extremely bullish)
3. analysis: a brief 2-3 sentence analysis of the market sentiment
4. key_factors: array of 2-3 key factors influencing sentiment

Format: {"sentiment": "...", "score": X, "analysis": "...", "key_factors": [...]}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a financial analyst specializing in cryptocurrency markets. Provide accurate, unbiased sentiment analysis based on news data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        symbol,
        sentiment: result.sentiment || "neutral",
        score: result.score?.toString() || "0",
        analysis: result.analysis || "Unable to determine sentiment",
        newsHeadlines: JSON.stringify(newsArticles.map(a => ({
          title: a.title,
          source: a.source.title,
          published_at: a.published_at
        }))),
        technicalFactors: JSON.stringify(result.key_factors || [])
      };
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      
      // Fallback sentiment
      return {
        symbol,
        sentiment: "neutral",
        score: "0",
        analysis: "Unable to analyze sentiment due to technical issues. Please try again later.",
        newsHeadlines: JSON.stringify(newsArticles.map(a => ({
          title: a.title,
          source: a.source.title
        }))),
        technicalFactors: JSON.stringify([])
      };
    }
  }

  /**
   * Get or create sentiment analysis for a symbol
   */
  async getSentimentForSymbol(symbol: string, currentPrice?: number): Promise<InsertMarketSentiment> {
    try {
      // Check if we have recent sentiment (within last hour)
      const recentSentiment = await storage.getRecentMarketSentiment(symbol, 60);
      
      if (recentSentiment) {
        return recentSentiment;
      }

      // Fetch fresh news and analyze
      const news = await this.fetchCryptoNews(symbol, 10);
      const sentiment = await this.analyzeSentiment(symbol, news, currentPrice);
      
      // Store sentiment in database
      await storage.createMarketSentiment(sentiment);
      
      return sentiment;
    } catch (error) {
      console.error("Error getting sentiment:", error);
      throw error;
    }
  }

  /**
   * Get sentiment for all supported symbols
   */
  async getAllSentiments(prices?: Record<string, number>): Promise<InsertMarketSentiment[]> {
    const symbols = ['BTC', 'ETH', 'SOL'];
    const sentiments: InsertMarketSentiment[] = [];

    for (const symbol of symbols) {
      try {
        const sentiment = await this.getSentimentForSymbol(symbol, prices?.[symbol]);
        sentiments.push(sentiment);
      } catch (error) {
        console.error(`Error getting sentiment for ${symbol}:`, error);
      }
    }

    return sentiments;
  }
}

export const aiSentimentService = new AISentimentService();
