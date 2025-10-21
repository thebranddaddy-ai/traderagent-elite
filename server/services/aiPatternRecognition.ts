import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertTradingPattern, PaperOrder } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class PatternRecognitionService {
  
  /**
   * Analyze user's trading history for patterns
   */
  async analyzeUserPatterns(userId: string): Promise<InsertTradingPattern[]> {
    try {
      // Get user's recent orders
      const orders = await storage.getPaperOrdersByUserId(userId);
      
      if (orders.length < 5) {
        console.log(`Not enough orders for pattern analysis (${orders.length})`);
        return [];
      }

      // Sort orders by timestamp
      const sortedOrders = orders.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Prepare order data for AI analysis
      const orderData = sortedOrders.slice(-30).map(order => ({
        symbol: order.symbol,
        side: order.side,
        type: order.orderType,
        quantity: order.quantity,
        price: order.price,
        status: order.status,
        timestamp: order.timestamp,
        closedBy: order.closedBy
      }));

      const prompt = `Analyze this trading history and identify behavioral patterns:

${JSON.stringify(orderData, null, 2)}

Identify trading patterns such as:
- Revenge trading (trading immediately after losses)
- Overtrading (excessive trading frequency)
- Profit taking patterns (when/how user takes profits)
- Loss cutting patterns (stop-loss discipline)
- Time-based patterns (trading at specific times)
- Asset concentration (over-focus on specific assets)

Provide a JSON array of patterns with:
{
  "patterns": [
    {
      "type": "revenge_trading|overtrading|profit_taking|loss_cutting|time_based|asset_concentration",
      "description": "brief description of the pattern",
      "frequency": number of times detected,
      "impact": "positive|negative|neutral",
      "recommendation": "actionable advice to improve"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a trading behavior analyst. Identify patterns in trading history and provide constructive feedback to help traders improve their discipline and profitability."
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
      const patterns: InsertTradingPattern[] = [];

      if (result.patterns && Array.isArray(result.patterns)) {
        for (const pattern of result.patterns) {
          // Check if this pattern already exists
          const existingPatterns = await storage.getPatternsByUserId(userId);
          const existing = existingPatterns.find(p => p.patternType === pattern.type);

          if (existing) {
            // Update frequency of existing pattern
            await storage.updatePatternFrequency(
              existing.id,
              existing.frequency + pattern.frequency,
              new Date()
            );
          } else {
            // Create new pattern
            const newPattern: InsertTradingPattern = {
              userId,
              patternType: pattern.type,
              description: pattern.description || `${pattern.type} pattern detected`,
              frequency: pattern.frequency || 1,
              impact: pattern.impact || "neutral",
              recommendation: pattern.recommendation || "Monitor this pattern",
              lastOccurrence: new Date()
            };
            
            await storage.createTradingPattern(newPattern);
            patterns.push(newPattern);
          }
        }
      }

      return patterns;
    } catch (error) {
      console.error("Error analyzing patterns:", error);
      return [];
    }
  }

  /**
   * Detect revenge trading pattern
   */
  async detectRevengeTradingPattern(userId: string, orders: PaperOrder[]): Promise<boolean> {
    // Look for rapid trades after losses
    for (let i = 1; i < orders.length; i++) {
      const prevOrder = orders[i - 1];
      const currOrder = orders[i];
      
      // Check if previous order was likely a loss and current order followed quickly
      const timeDiff = new Date(currOrder.timestamp).getTime() - new Date(prevOrder.timestamp).getTime();
      const quickTrade = timeDiff < 5 * 60 * 1000; // 5 minutes
      
      if (quickTrade && prevOrder.side === currOrder.side) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect overtrading pattern
   */
  async detectOvertradingPattern(userId: string, orders: PaperOrder[]): Promise<boolean> {
    // Check if user has made more than 10 trades in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTrades = orders.filter(order => 
      new Date(order.timestamp) >= oneHourAgo
    );
    
    return recentTrades.length > 10;
  }

  /**
   * Get user's detected patterns
   */
  async getUserPatterns(userId: string): Promise<InsertTradingPattern[]> {
    try {
      const patterns = await storage.getPatternsByUserId(userId);
      return patterns;
    } catch (error) {
      console.error("Error getting user patterns:", error);
      return [];
    }
  }
}

export const patternRecognitionService = new PatternRecognitionService();
