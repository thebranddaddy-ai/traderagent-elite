import OpenAI from "openai";
import { storage } from "../storage";
import { aiSentimentService } from "./aiSentiment";
import { patternRecognitionService } from "./aiPatternRecognition";
import type { InsertAITradeSuggestion, MarketSentiment } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AITradeSuggestionsService {
  
  /**
   * Generate AI-powered trade suggestions for a user
   */
  async generateTradeSuggestions(
    userId: string,
    currentPrices: Record<string, number>
  ): Promise<InsertAITradeSuggestion[]> {
    try {
      // Get user's wallet and positions
      const wallet = await storage.getPaperWalletByUserId(userId);
      if (!wallet) {
        console.log("No wallet found for user");
        return [];
      }

      const positions = await storage.getPaperPositionsByWalletId(wallet.id);
      const orders = await storage.getPaperOrdersByUserId(userId);
      
      // Get market sentiments for all symbols
      const sentiments = await aiSentimentService.getAllSentiments(currentPrices);
      
      // Get user's trading patterns
      const patterns = await storage.getPatternsByUserId(userId);
      
      // Get risk guard settings
      const riskSettings = await storage.getRiskGuardSettings(userId);

      // Prepare data for AI analysis
      const portfolioData = {
        balance: wallet.balance,
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avgPrice: p.avgPrice,
          currentPrice: currentPrices[p.symbol],
          pnl: (parseFloat(p.quantity) * (currentPrices[p.symbol] - parseFloat(p.avgPrice))).toFixed(2)
        })),
        recentOrders: orders.slice(-10).map(o => ({
          symbol: o.symbol,
          side: o.side,
          quantity: o.quantity,
          price: o.price,
          status: o.status
        }))
      };

      const marketData = {
        prices: currentPrices,
        sentiments: sentiments.map(s => ({
          symbol: s.symbol,
          sentiment: s.sentiment,
          score: s.score,
          analysis: s.analysis
        }))
      };

      const behaviorData = {
        patterns: patterns.map(p => ({
          type: p.patternType,
          impact: p.impact,
          recommendation: p.recommendation
        })),
        riskLevel: riskSettings?.autoPauseEnabled ? "moderate" : "aggressive"
      };

      const prompt = `You are an AI trading advisor. Analyze this data and generate 1-3 actionable trade suggestions with COMPLETE trade parameters:

Portfolio:
${JSON.stringify(portfolioData, null, 2)}

Market Conditions:
${JSON.stringify(marketData, null, 2)}

User Behavior:
${JSON.stringify(behaviorData, null, 2)}

Generate trade suggestions considering:
1. Market sentiment and momentum
2. Portfolio diversification
3. User's trading patterns and risk profile
4. Current positions and potential opportunities

CRITICAL: Provide COMPLETE trade parameters including entry price, target price, stop loss, and risk/reward ratio.

For BUY suggestions:
- entry_price: Current market price
- target_price: Entry price + reasonable profit target (3-8% for conservative, 8-15% for aggressive)
- stop_loss: Entry price - protective stop (2-5% below entry)
- Calculate risk_reward_ratio: (target_price - entry_price) / (entry_price - stop_loss)

For SELL suggestions:
- entry_price: Current market price
- target_price: Entry price - expected decline target
- stop_loss: Entry price + protective stop (above entry for sells)

Provide JSON with:
{
  "suggestions": [
    {
      "symbol": "BTC|ETH|SOL",
      "action": "buy|sell",
      "suggested_quantity": 0.01,
      "entry_price": 50000.00,
      "target_price": 52500.00,
      "stop_loss": 49000.00,
      "risk_reward_ratio": 2.5,
      "reasoning": "clear explanation why this trade makes sense with specific entry, target, and stop levels",
      "confidence": 75,
      "risk_level": "low|medium|high"
    }
  ]
}

Only suggest trades with confidence > 60. Max 3 suggestions. ALWAYS include entry_price, target_price, stop_loss, and risk_reward_ratio.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency trading advisor who provides data-driven, balanced recommendations based on market analysis, portfolio optimization, and risk management principles."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      const suggestions: InsertAITradeSuggestion[] = [];

      if (result.suggestions && Array.isArray(result.suggestions)) {
        for (const suggestion of result.suggestions) {
          if (suggestion.confidence >= 60) {
            const currentPrice = currentPrices[suggestion.symbol];
            
            // Use AI-provided prices or fallback to current price
            const entryPrice = suggestion.entry_price || currentPrice;
            const targetPrice = suggestion.target_price || (entryPrice * 1.05); // 5% default target
            const stopLoss = suggestion.stop_loss || (entryPrice * 0.97); // 3% default stop
            
            // Calculate risk/reward ratio with safety checks
            let riskRewardRatio = 0;
            if (suggestion.risk_reward_ratio) {
              riskRewardRatio = suggestion.risk_reward_ratio;
            } else {
              const risk = entryPrice - stopLoss;
              const reward = targetPrice - entryPrice;
              // Only calculate if risk is meaningful (> 0.01% of entry price)
              if (Math.abs(risk) > entryPrice * 0.0001) {
                riskRewardRatio = reward / risk;
                // Cap ratio at reasonable bounds (-100 to 100)
                riskRewardRatio = Math.max(-100, Math.min(100, riskRewardRatio));
              }
            }
            
            const newSuggestion: InsertAITradeSuggestion = {
              userId,
              symbol: suggestion.symbol,
              action: suggestion.action,
              suggestedQuantity: suggestion.suggested_quantity?.toString() || "0.01",
              suggestedPrice: currentPrice?.toString() || "0",
              suggestedEntry: entryPrice?.toString() || "0",
              targetPrice: targetPrice?.toString() || "0",
              stopLoss: stopLoss?.toString() || "0",
              riskRewardRatio: riskRewardRatio?.toString() || "0",
              reasoning: suggestion.reasoning || "AI-generated suggestion",
              confidence: suggestion.confidence?.toString() || "60",
              status: "active",
              marketConditions: JSON.stringify({
                sentiment: sentiments.find(s => s.symbol === suggestion.symbol)?.sentiment,
                price: currentPrice,
                riskLevel: suggestion.risk_level
              })
            };
            
            // Store suggestion in database
            await storage.createAITradeSuggestion(newSuggestion);
            suggestions.push(newSuggestion);
          }
        }
      }

      return suggestions;
    } catch (error) {
      console.error("Error generating trade suggestions:", error);
      return [];
    }
  }

  /**
   * Get active trade suggestions for a user
   */
  async getActiveSuggestions(userId: string): Promise<InsertAITradeSuggestion[]> {
    try {
      const suggestions = await storage.getActiveSuggestionsByUserId(userId);
      return suggestions;
    } catch (error) {
      console.error("Error getting active suggestions:", error);
      return [];
    }
  }

  /**
   * Mark a suggestion as executed
   */
  async executeSuggestion(suggestionId: string): Promise<void> {
    try {
      await storage.updateSuggestionStatus(suggestionId, "executed");
    } catch (error) {
      console.error("Error executing suggestion:", error);
      throw error;
    }
  }

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(suggestionId: string): Promise<void> {
    try {
      await storage.updateSuggestionStatus(suggestionId, "dismissed");
    } catch (error) {
      console.error("Error dismissing suggestion:", error);
      throw error;
    }
  }

  /**
   * Get all suggestions for a user (including historical)
   */
  async getAllSuggestions(userId: string): Promise<InsertAITradeSuggestion[]> {
    try {
      const suggestions = await storage.getAllSuggestionsByUserId(userId);
      return suggestions;
    } catch (error) {
      console.error("Error getting all suggestions:", error);
      return [];
    }
  }
}

export const aiTradeSuggestionsService = new AITradeSuggestionsService();
