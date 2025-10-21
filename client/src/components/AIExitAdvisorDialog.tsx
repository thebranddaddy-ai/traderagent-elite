import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Brain, TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle2, LogOut, Percent } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

interface Asset {
  id?: string;
  symbol: string;
  quantity: string | number;
  avgPrice: string | number;
  currentPrice: string | number;
  pnl: string | number;
  pnlPercent: string | number;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
}

interface AIExitAdvisorDialogProps {
  open: boolean;
  onClose: () => void;
  asset: Asset;
  onExitAll?: (positionId: string) => void;
  onExitPartial?: (asset: Asset) => void;
}

interface ExitAdvice {
  recommendation: "HOLD" | "EXIT_PARTIAL" | "EXIT_ALL" | "TIGHTEN_STOP";
  reasoning: string;
  confidence: number;
  keyPoints: string[];
  suggestedAction?: string;
}

export default function AIExitAdvisorDialog({
  open,
  onClose,
  asset,
  onExitAll,
  onExitPartial
}: AIExitAdvisorDialogProps) {
  const [advice, setAdvice] = useState<ExitAdvice | null>(null);

  const exitAdvisorMutation = useMutation({
    mutationFn: async () => {
      const positionContext = {
        symbol: asset.symbol,
        quantity: typeof asset.quantity === 'string' ? parseFloat(asset.quantity) : asset.quantity,
        avgPrice: typeof asset.avgPrice === 'string' ? parseFloat(asset.avgPrice) : asset.avgPrice,
        currentPrice: typeof asset.currentPrice === 'string' ? parseFloat(asset.currentPrice) : asset.currentPrice,
        pnl: typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl,
        pnlPercent: typeof asset.pnlPercent === 'string' ? parseFloat(asset.pnlPercent) : asset.pnlPercent,
        stopLoss: asset.stopLoss ? (typeof asset.stopLoss === 'string' ? parseFloat(asset.stopLoss) : asset.stopLoss) : null,
        takeProfit: asset.takeProfit ? (typeof asset.takeProfit === 'string' ? parseFloat(asset.takeProfit) : asset.takeProfit) : null,
      };

      const response = await fetch("/api/ai/exit-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionContext }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to get exit advice");
      }

      const data: ExitAdvice = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setAdvice(data);
    }
  });

  // Trigger AI analysis when dialog opens or asset changes
  useEffect(() => {
    if (open && !exitAdvisorMutation.isPending) {
      // Reset advice when asset changes
      setAdvice(null);
      // Trigger new analysis
      exitAdvisorMutation.mutate();
    }
  }, [open, asset.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const pnl = typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl;
  const pnlPercent = typeof asset.pnlPercent === 'string' ? parseFloat(asset.pnlPercent) : asset.pnlPercent;

  const recommendationConfig = {
    HOLD: { icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10", label: "Hold Position" },
    EXIT_PARTIAL: { icon: Percent, color: "text-blue-500", bg: "bg-blue-500/10", label: "Exit Partial" },
    EXIT_ALL: { icon: LogOut, color: "text-destructive", bg: "bg-destructive/10", label: "Exit All" },
    TIGHTEN_STOP: { icon: Shield, color: "text-orange-500", bg: "bg-orange-500/10", label: "Tighten Stop-Loss" }
  };

  const handleAction = () => {
    if (!advice) return;

    if (advice.recommendation === "EXIT_ALL" && onExitAll && asset.id) {
      onExitAll(asset.id);
      onClose();
    } else if (advice.recommendation === "EXIT_PARTIAL" && onExitPartial) {
      onExitPartial(asset);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-exit-advisor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Exit Advisor: {asset.symbol}
          </DialogTitle>
          <DialogDescription>
            Fast, logical exit decision based on price action and market sentiment
          </DialogDescription>
        </DialogHeader>

        {/* Position Summary */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current P/L</p>
                <p className={`text-2xl font-mono font-semibold ${pnl >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">P/L Percentage</p>
                <div className={`text-2xl font-semibold flex items-center gap-2 ${pnl >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                  {pnl >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                  {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Entry Price</p>
                <p className="text-sm font-mono">${typeof asset.avgPrice === 'string' ? parseFloat(asset.avgPrice).toFixed(2) : asset.avgPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Price</p>
                <p className="text-sm font-mono">${typeof asset.currentPrice === 'string' ? parseFloat(asset.currentPrice).toFixed(2) : asset.currentPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Analysis */}
        {exitAdvisorMutation.isPending && (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">AI analyzing your position...</p>
            </div>
          </Card>
        )}

        {exitAdvisorMutation.isError && (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">Failed to generate exit advice. Please try again.</p>
            </div>
          </Card>
        )}

        {advice && (
          <div className="space-y-4">
            {/* Recommendation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = recommendationConfig[advice.recommendation];
                    const Icon = config.icon;
                    return (
                      <>
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Recommendation</p>
                          <p className="text-lg font-semibold">{config.label}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <Badge variant="outline" className="text-sm">
                  {advice.confidence}% Confidence
                </Badge>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-muted-foreground mb-4">{advice.reasoning}</p>

              {/* Key Points */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Key Points:</p>
                <ul className="space-y-1">
                  {advice.keyPoints.map((point, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggested Action */}
              {advice.suggestedAction && (
                <div className="mt-4 p-3 rounded-lg bg-accent/50 border border-accent">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Action:</p>
                  <p className="text-sm font-medium">{advice.suggestedAction}</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            data-testid="button-close-exit-advisor"
          >
            Close
          </Button>
          {advice && (advice.recommendation === "EXIT_ALL" || advice.recommendation === "EXIT_PARTIAL") && (
            <Button
              variant={advice.recommendation === "EXIT_ALL" ? "destructive" : "default"}
              className="flex-1"
              onClick={handleAction}
              data-testid="button-execute-exit-advice"
            >
              {advice.recommendation === "EXIT_ALL" ? "Exit All" : "Exit Partial"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
