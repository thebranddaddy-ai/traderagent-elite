import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, TrendingUp, TrendingDown, Info, Lightbulb, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AITransparencyLayer } from "@/components/AITransparencyLayer";

interface WhatIfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  tradeParams: {
    symbol: string;
    side: "buy" | "sell";
    size: number;
    entryPrice?: number;
    slippagePct?: number;
  };
}

// Zod schema for validating What-If API responses
const DistributionSchema = z.object({
  median: z.number().finite(),
  p5: z.number().finite(),
  p95: z.number().finite(),
  mean: z.number().finite(),
  stdDev: z.number().finite(),
});

const SuggestedAlternativeSchema = z.object({
  reason: z.string(),
  size: z.number().finite().positive(),
  entryPrice: z.number().finite().positive().optional(),
  slippagePct: z.number().finite().min(0).max(10),
});

const WhatIfResultSchema = z.object({
  distributions: z.object({
    "1h": DistributionSchema,
    "4h": DistributionSchema,
    "24h": DistributionSchema,
  }),
  probabilityBuckets: z.object({
    veryNegative: z.number().finite().min(0).max(100),
    negative: z.number().finite().min(0).max(100),
    neutral: z.number().finite().min(0).max(100),
    positive: z.number().finite().min(0).max(100),
    veryPositive: z.number().finite().min(0).max(100),
  }),
  riskSignals: z.array(z.string()),
  suggestedAlternatives: z.array(SuggestedAlternativeSchema),
  summary: z.string(),
  confidence: z.number().finite().min(0).max(100),
  explanation: z.string().optional(),
});

type WhatIfResult = z.infer<typeof WhatIfResultSchema>;

export default function WhatIfModal({
  open,
  onOpenChange,
  userId,
  tradeParams,
}: WhatIfModalProps) {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<"1h" | "4h" | "24h">("24h");
  const [result, setResult] = useState<WhatIfResult | null>(null);

  const whatIfMutation = useMutation({
    mutationFn: async (requestTimeframe: "1h" | "4h" | "24h") => {
      const response = await apiRequest("/api/ai/whatif", "POST", {
        userId,
        symbol: tradeParams.symbol,
        side: tradeParams.side,
        size: tradeParams.size,
        entryPrice: tradeParams.entryPrice,
        slippagePct: tradeParams.slippagePct || 0.1,
        timeframe: requestTimeframe,
        lookbackDays: 90,
      });
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      // Validate response structure with Zod schema
      const validation = WhatIfResultSchema.safeParse(data);
      
      if (validation.success) {
        setResult(validation.data);
      } else {
        console.error("[WhatIf] Invalid response structure:", validation.error);
        toast({
          title: "Simulation Error",
          description: "Server returned incomplete or invalid data",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("[WhatIf] Error:", error);
      toast({
        title: "Simulation Failed",
        description: error.message || "Failed to run What-If simulation",
        variant: "destructive",
      });
    },
  });

  const handleRunSimulation = () => {
    setResult(null);
    whatIfMutation.mutate(timeframe);
  };

  const handleTimeframeChange = (newTimeframe: "1h" | "4h" | "24h") => {
    setTimeframe(newTimeframe);
    // Auto-run simulation when timeframe changes
    if (result) {
      setResult(null);
      whatIfMutation.mutate(newTimeframe);
    }
  };

  const handleClose = () => {
    setResult(null);
    setTimeframe("24h");
    onOpenChange(false);
  };

  const distribution = result?.distributions?.[timeframe];
  const probabilities = result?.probabilityBuckets;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="dialog-whatif">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            What-If Scenario Simulator
          </DialogTitle>
          <DialogDescription>
            Preview probabilistic P&L outcomes before placing your trade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trade Summary */}
          <div className="p-4 rounded-lg bg-accent/50 border">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Symbol:</span>{" "}
                <span className="font-semibold" data-testid="text-whatif-symbol">{tradeParams.symbol}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Side:</span>{" "}
                <Badge variant={tradeParams.side === "buy" ? "default" : "destructive"} className="ml-2" data-testid="badge-whatif-side">
                  {tradeParams.side.toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span>{" "}
                <span className="font-mono font-semibold" data-testid="text-whatif-size">${tradeParams.size.toFixed(2)}</span>
              </div>
              {tradeParams.entryPrice && (
                <div>
                  <span className="text-muted-foreground">Entry:</span>{" "}
                  <span className="font-mono" data-testid="text-whatif-entry">${tradeParams.entryPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeframe Selection */}
          <div className="space-y-2">
            <Label htmlFor="timeframe">Forecast Timeframe</Label>
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger id="timeframe" data-testid="select-whatif-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="4h">4 Hours</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Run Simulation Button */}
          {!result && (
            <Button
              onClick={handleRunSimulation}
              disabled={whatIfMutation.isPending}
              className="w-full"
              data-testid="button-run-whatif"
            >
              {whatIfMutation.isPending ? "Running Simulation..." : "Run Monte-Carlo Simulation"}
            </Button>
          )}

          {/* Simulation Results */}
          {result && distribution && probabilities && (
            <>
              {/* P&L Distribution */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Expected Returns ({timeframe})
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Downside (5th %)</div>
                    <div className="text-lg font-mono font-semibold text-red-500" data-testid="text-whatif-p5">
                      {distribution.p5.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Expected (Median)</div>
                    <div className="text-lg font-mono font-semibold text-blue-500" data-testid="text-whatif-median">
                      {distribution.median.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Upside (95th %)</div>
                    <div className="text-lg font-mono font-semibold text-green-500" data-testid="text-whatif-p95">
                      {distribution.p95.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Probability Distribution */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Probability Distribution
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-sm text-muted-foreground">Very Negative</div>
                    <div className="flex-1 bg-accent rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-red-600 h-full flex items-center justify-end pr-2"
                        style={{ width: `${probabilities.veryNegative}%` }}
                        data-testid="bar-prob-verynegative"
                      >
                        {probabilities.veryNegative > 5 && (
                          <span className="text-xs text-white font-semibold">
                            {probabilities.veryNegative.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right" data-testid="text-prob-verynegative">
                      {probabilities.veryNegative.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-sm text-muted-foreground">Negative</div>
                    <div className="flex-1 bg-accent rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-orange-500 h-full flex items-center justify-end pr-2"
                        style={{ width: `${probabilities.negative}%` }}
                        data-testid="bar-prob-negative"
                      >
                        {probabilities.negative > 5 && (
                          <span className="text-xs text-white font-semibold">
                            {probabilities.negative.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right" data-testid="text-prob-negative">
                      {probabilities.negative.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-sm text-muted-foreground">Neutral</div>
                    <div className="flex-1 bg-accent rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-gray-500 h-full flex items-center justify-end pr-2"
                        style={{ width: `${probabilities.neutral}%` }}
                        data-testid="bar-prob-neutral"
                      >
                        {probabilities.neutral > 5 && (
                          <span className="text-xs text-white font-semibold">
                            {probabilities.neutral.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right" data-testid="text-prob-neutral">
                      {probabilities.neutral.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-sm text-muted-foreground">Positive</div>
                    <div className="flex-1 bg-accent rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-lime-500 h-full flex items-center justify-end pr-2"
                        style={{ width: `${probabilities.positive}%` }}
                        data-testid="bar-prob-positive"
                      >
                        {probabilities.positive > 5 && (
                          <span className="text-xs text-white font-semibold">
                            {probabilities.positive.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right" data-testid="text-prob-positive">
                      {probabilities.positive.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 text-sm text-muted-foreground">Very Positive</div>
                    <div className="flex-1 bg-accent rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-green-600 h-full flex items-center justify-end pr-2"
                        style={{ width: `${probabilities.veryPositive}%` }}
                        data-testid="bar-prob-verypositive"
                      >
                        {probabilities.veryPositive > 5 && (
                          <span className="text-xs text-white font-semibold">
                            {probabilities.veryPositive.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right" data-testid="text-prob-verypositive">
                      {probabilities.veryPositive.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk Signals */}
              {result.riskSignals && result.riskSignals.length > 0 && (
                <Alert variant="destructive" data-testid="alert-risk-signals">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Risk Signals Detected:</div>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {result.riskSignals.map((signal, idx) => (
                        <li key={idx} data-testid={`text-risk-signal-${idx}`}>{signal}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* AI Explanation with Transparency Layer */}
              {result.explanation && (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      AI Simulation Analysis
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-ai-explanation">
                      {result.explanation}
                    </p>
                  </div>
                  
                  {/* Transparency Layer */}
                  <AITransparencyLayer
                    reasoning={result.explanation}
                    dataUsed={{
                      "Timeframe": timeframe,
                      "Historical lookback": "90 days",
                      "Simulation type": "Monte Carlo",
                      "Risk signals": result.riskSignals?.length ? `${result.riskSignals.length} detected` : "None",
                    }}
                    confidence={result.confidence}
                  />
                </div>
              )}

              {/* Alternative Suggestions */}
              {result.suggestedAlternatives && result.suggestedAlternatives.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Alternative Approaches
                  </h3>
                  <div className="space-y-2">
                    {result.suggestedAlternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md bg-accent/50 border space-y-1"
                        data-testid={`card-alternative-${idx}`}
                      >
                        <div className="text-sm font-medium" data-testid={`text-alternative-reason-${idx}`}>
                          {alt.reason}
                        </div>
                        <div className="text-xs text-muted-foreground space-x-3">
                          <span data-testid={`text-alternative-size-${idx}`}>
                            Size: ${alt.size.toFixed(2)}
                          </span>
                          <span data-testid={`text-alternative-slippage-${idx}`}>
                            Slippage: {alt.slippagePct.toFixed(1)}%
                          </span>
                          {alt.entryPrice && (
                            <span data-testid={`text-alternative-entry-${idx}`}>
                              Entry: ${alt.entryPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Simulation Confidence:</span>
                <span className="font-semibold" data-testid="text-confidence">
                  {result.confidence.toFixed(0)}%
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleRunSimulation}
                  disabled={whatIfMutation.isPending}
                  className="flex-1"
                  data-testid="button-rerun-whatif"
                >
                  Rerun Simulation
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1"
                  data-testid="button-close-whatif"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
