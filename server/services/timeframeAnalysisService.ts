import { storage } from "../storage";
import OpenAI from "openai";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalysisRequest {
  userId: string;
  dateFrom: Date;
  dateTo: Date;
}

interface TradeWithPnL {
  id: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  timestamp: Date;
  pnl?: number;
  pnlPercent?: number;
  holdTime?: number; // in seconds
  stopLoss?: string;
  takeProfit?: string;
  closedBy?: string;
}

interface MistakeTag {
  type: string;
  description: string;
  count: number;
  tradeIds: string[];
  icon: string;
}

interface AnalysisResult {
  runId: string;
  summary: string;
  stats: {
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    avgProfit: number;
    avgLoss: number;
    avgHoldTime: number; // in minutes
    totalTrades: number;
  };
  winningTrades: TradeWithPnL[];
  losingTrades: TradeWithPnL[];
  mistakeTags: MistakeTag[];
  suggestions: Array<{
    category: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
  strengths: string[];
  tokenUsage: number;
}

/**
 * Computes SHA-256 hash of a prompt for audit purposes
 */
function computePromptHash(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

/**
 * Redacts PII from trade data before sending to OpenAI
 */
function redactPII(data: any): any {
  const redacted = { ...data };
  delete redacted.userId;
  delete redacted.email;
  delete redacted.username;
  return redacted;
}

/**
 * Detect mistake patterns in trades
 */
function detectMistakes(trades: TradeWithPnL[]): MistakeTag[] {
  const mistakes: MistakeTag[] = [];
  
  // 1. Exited winners too early (sold before hitting take profit with minimal gain)
  const earlyExitWinners = trades.filter(t => 
    t.side === 'sell' && 
    t.pnl && t.pnl > 0 && 
    t.pnl < 50 && // Small profit < $50
    t.closedBy === 'manual' &&
    t.takeProfit && parseFloat(t.takeProfit) > parseFloat(t.price)
  );
  
  if (earlyExitWinners.length > 0) {
    mistakes.push({
      type: "early_exit_winners",
      description: "Exited winning positions too early before reaching take profit targets",
      count: earlyExitWinners.length,
      tradeIds: earlyExitWinners.map(t => t.id),
      icon: "TrendingUp"
    });
  }

  // 2. No Stop Loss used (high risk trades without protection)
  const noStopLossTrades = trades.filter(t => 
    t.side === 'buy' && !t.stopLoss
  );
  
  if (noStopLossTrades.length > 2) {
    mistakes.push({
      type: "no_stop_loss",
      description: "Entered positions without stop loss protection",
      count: noStopLossTrades.length,
      tradeIds: noStopLossTrades.map(t => t.id),
      icon: "Shield"
    });
  }

  // 3. Averaged down in high volatility (bought more when losing)
  const avgDownTrades = trades.filter((t, idx) => {
    if (t.side !== 'buy' || idx === 0) return false;
    const prevTrade = trades[idx - 1];
    return prevTrade?.symbol === t.symbol && 
           prevTrade?.side === 'buy' &&
           parseFloat(t.price) < parseFloat(prevTrade.price);
  });
  
  if (avgDownTrades.length > 0) {
    mistakes.push({
      type: "averaged_down",
      description: "Averaged down by buying more at lower prices (catching falling knife)",
      count: avgDownTrades.length,
      tradeIds: avgDownTrades.map(t => t.id),
      icon: "TrendingDown"
    });
  }

  // 4. Held losers too long (didn't cut losses quickly)
  const heldLosers = trades.filter(t => 
    t.pnl && 
    t.pnl < -100 && // Significant loss > $100
    t.holdTime && t.holdTime > 3600 * 24 // Held > 24 hours
  );
  
  if (heldLosers.length > 0) {
    mistakes.push({
      type: "held_losers_long",
      description: "Held losing positions too long instead of cutting losses quickly",
      count: heldLosers.length,
      tradeIds: heldLosers.map(t => t.id),
      icon: "Clock"
    });
  }

  // 5. Overtrading (too many trades in short period)
  if (trades.length > 20) {
    const timeRangeHours = (new Date(trades[trades.length - 1].timestamp).getTime() - 
                            new Date(trades[0].timestamp).getTime()) / (1000 * 60 * 60);
    const tradesPerDay = trades.length / (timeRangeHours / 24);
    
    if (tradesPerDay > 5) {
      mistakes.push({
        type: "overtrading",
        description: `High trading frequency (${tradesPerDay.toFixed(1)} trades/day) may indicate overtrading`,
        count: trades.length,
        tradeIds: trades.slice(0, 10).map(t => t.id), // First 10 as examples
        icon: "Zap"
      });
    }
  }

  return mistakes;
}

/**
 * Calculate P&L and holding time for completed trades
 */
function calculateTradeMetrics(orders: any[]): TradeWithPnL[] {
  const tradesWithMetrics: TradeWithPnL[] = [];
  
  // Group orders by symbol to track position lifecycle
  const symbolGroups = new Map<string, any[]>();
  
  orders.forEach(order => {
    const symbol = order.symbol;
    if (!symbolGroups.has(symbol)) {
      symbolGroups.set(symbol, []);
    }
    symbolGroups.get(symbol)!.push(order);
  });

  // Calculate P&L for each completed trade cycle (buy -> sell)
  symbolGroups.forEach((symbolOrders, symbol) => {
    let position: { buyPrice: number; buyTime: Date; quantity: number; orderId: string } | null = null;
    
    symbolOrders.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    symbolOrders.forEach(order => {
      if (order.side === 'buy') {
        // Open or add to position
        const buyPrice = parseFloat(order.price);
        const buyQty = parseFloat(order.quantity);
        
        if (!position) {
          position = { 
            buyPrice, 
            buyTime: new Date(order.timestamp), 
            quantity: buyQty,
            orderId: order.id 
          };
        } else {
          // Average down/up
          const totalQty = position.quantity + buyQty;
          position.buyPrice = (position.buyPrice * position.quantity + buyPrice * buyQty) / totalQty;
          position.quantity = totalQty;
        }
        
        tradesWithMetrics.push({
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          timestamp: new Date(order.timestamp),
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
        });
      } else if (order.side === 'sell' && position) {
        // Close position
        const sellPrice = parseFloat(order.price);
        const sellQty = parseFloat(order.quantity);
        const pnl = (sellPrice - position.buyPrice) * sellQty;
        const pnlPercent = ((sellPrice - position.buyPrice) / position.buyPrice) * 100;
        const holdTime = (new Date(order.timestamp).getTime() - position.buyTime.getTime()) / 1000; // seconds
        
        tradesWithMetrics.push({
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          timestamp: new Date(order.timestamp),
          pnl,
          pnlPercent,
          holdTime,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
          closedBy: order.closedBy || 'manual',
        });
        
        // Reset position if fully closed
        if (sellQty >= position.quantity) {
          position = null;
        } else {
          position.quantity -= sellQty;
        }
      }
    });
  });
  
  return tradesWithMetrics;
}

/**
 * Analyzes trades within a timeframe and generates insights
 */
export async function analyzeTimeframe(request: AnalysisRequest): Promise<AnalysisResult> {
  const { userId, dateFrom, dateTo } = request;

  // 1. Fetch completed paper orders
  const allOrders = await storage.getPaperOrdersByUserId(userId);
  
  const completedOrders = allOrders.filter((order: any) => order.status === 'completed');
  
  const timeframeTrades = completedOrders.filter((trade: any) => {
    const tradeTime = new Date(trade.timestamp);
    return tradeTime >= dateFrom && tradeTime <= dateTo;
  });

  if (timeframeTrades.length === 0) {
    throw new Error("No trades found in the selected timeframe");
  }

  // 2. Calculate trade metrics (P&L, holding time)
  const tradesWithMetrics = calculateTradeMetrics(timeframeTrades);

  // 3. Separate winning and losing trades
  const winningTrades = tradesWithMetrics.filter(t => t.pnl && t.pnl > 0);
  const losingTrades = tradesWithMetrics.filter(t => t.pnl && t.pnl < 0);

  // 4. Calculate statistics
  const totalPnL = tradesWithMetrics.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgProfit = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length
    : 0;
  
  const tradesWithHoldTime = tradesWithMetrics.filter(t => t.holdTime);
  const avgHoldTime = tradesWithHoldTime.length > 0
    ? tradesWithHoldTime.reduce((sum, t) => sum + (t.holdTime || 0), 0) / tradesWithHoldTime.length / 60 // Convert to minutes
    : 0;

  const winRate = (winningTrades.length + losingTrades.length) > 0
    ? (winningTrades.length / (winningTrades.length + losingTrades.length)) * 100
    : 0;

  // 5. Detect mistake patterns
  const mistakeTags = detectMistakes(tradesWithMetrics);

  // 6. Prepare compact summary for OpenAI
  const tradeSummary = redactPII({
    totalTrades: tradesWithMetrics.length,
    wins: winningTrades.length,
    losses: losingTrades.length,
    winRate: winRate.toFixed(1),
    avgHoldTime: `${avgHoldTime.toFixed(1)} minutes`,
    mistakePatterns: mistakeTags.map(m => ({ type: m.type, count: m.count })),
  });

  // 7. Build OpenAI prompt
  const prompt = `Analyze this trader's performance from ${dateFrom.toISOString()} to ${dateTo.toISOString()}.

Trading Summary:
${JSON.stringify(tradeSummary, null, 2)}

Provide structured insights focusing on:
1. Top 3 strengths in their trading approach
2. Key learning opportunities based on mistake patterns
3. Actionable recommendations with priority levels

Return structured JSON:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "insights": [
    {
      "category": "discipline|strategy|risk_management|psychology",
      "recommendation": "specific actionable advice",
      "priority": "high|medium|low"
    }
  ]
}`;

  // 8. Compute prompt hash for audit
  const promptHash = computePromptHash(prompt);

  // 9. Call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a calm, supportive trading coach. Provide educational insights, never financial advice. Focus on behavioral patterns and learning opportunities."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const tokenUsage = completion.usage?.total_tokens || 0;
  const aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
  
  // 10. Build result object
  const result: AnalysisResult = {
    runId: "",
    summary: `Analyzed ${tradesWithMetrics.length} trades: ${winningTrades.length} wins (${winRate.toFixed(1)}%), ${losingTrades.length} losses. Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`,
    stats: {
      wins: winningTrades.length,
      losses: losingTrades.length,
      winRate,
      totalPnL,
      avgProfit,
      avgLoss,
      avgHoldTime,
      totalTrades: tradesWithMetrics.length,
    },
    winningTrades: winningTrades.slice(0, 20), // Top 20
    losingTrades: losingTrades.slice(0, 20), // Top 20
    mistakeTags,
    suggestions: aiResponse.insights || [],
    strengths: aiResponse.strengths || [],
    tokenUsage,
  };

  // 11. Store analysis run in database
  const analysisRun = await storage.createAIAnalysisRun({
    userId,
    dateFrom,
    dateTo,
    result: result as any,
    tokenUsage,
    privacyLearnOnly: true,
    promptHash,
    modelVersion: "gpt-4o-mini",
  });

  result.runId = analysisRun.id;

  // 12. Update personal agent snapshot
  await updatePersonalAgent(userId, analysisRun.id, result);

  return result;
}

/**
 * Update personal agent with latest analysis
 */
async function updatePersonalAgent(userId: string, runId: string, result: AnalysisResult) {
  try {
    let agent = await storage.getPersonalAgent(userId);
    
    if (!agent) {
      agent = await storage.createPersonalAgent({
        userId,
        snapshot: {
          dna_snapshot: {},
          last_analysis_run_id: runId,
          labeled_mistakes: [],
          practice_modules: [],
          vectors_meta: { count: 0 }
        }
      });
    } else {
      const snapshot = agent.snapshot as any;
      snapshot.last_analysis_run_id = runId;
      
      if (result.mistakeTags && result.mistakeTags.length > 0) {
        snapshot.labeled_mistakes = snapshot.labeled_mistakes || [];
        result.mistakeTags.forEach(mistake => {
          snapshot.labeled_mistakes.push({
            type: mistake.type,
            trade_ids: mistake.tradeIds,
            notes: mistake.description,
            identified_at: new Date().toISOString(),
          });
        });
      }

      await storage.updatePersonalAgent(agent.id, { snapshot });
    }
  } catch (error) {
    console.error("[TimeframeAnalysis] Failed to update personal agent:", error);
  }
}

/**
 * Get analysis history for a user
 */
export async function getAnalysisHistory(userId: string, limit: number = 10) {
  return await storage.getAIAnalysisRuns(userId, limit);
}

/**
 * Get personal agent state for a user
 */
export async function getPersonalAgentState(userId: string) {
  return await storage.getPersonalAgent(userId);
}
