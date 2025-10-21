import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, 
  Brain,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TradingDNAMetrics {
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfitLoss: number;
  avgHoldTime: number;
  bestTimeframe: string;
  maxDrawdown: number;
  revengeTradeScore: number;
  volatilitySensitivity: number;
  riskScore: number;
  tradingStyle: "Aggressive" | "Conservative" | "Balanced";
  recommendedDailyLossLimit: number;
  recommendedMonthlyLossLimit: number;
  profitFactor: number;
  sharpeRatio: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  averageTradeSize: number;
}

export default function TradingDnaCard() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: dna, isLoading } = useQuery<TradingDNAMetrics>({
    queryKey: ["/api/users", userId, "dna"],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-trading-dna">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Trading DNA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!dna) {
    return null;
  }

  // Ensure all numeric values have defaults
  const safeMetrics = {
    winRate: dna.winRate ?? 0,
    totalTrades: dna.totalTrades ?? 0,
    profitFactor: dna.profitFactor ?? 0,
    riskScore: dna.riskScore ?? 50,
    totalProfitLoss: dna.totalProfitLoss ?? 0,
    consecutiveLosses: dna.consecutiveLosses ?? 0,
    maxDrawdown: dna.maxDrawdown ?? 0,
    revengeTradeScore: dna.revengeTradeScore ?? 0,
    recommendedDailyLossLimit: dna.recommendedDailyLossLimit ?? 500,
    tradingStyle: dna.tradingStyle ?? "Balanced",
    winningTrades: dna.winningTrades ?? 0,
    losingTrades: dna.losingTrades ?? 0,
  };

  const styleColor = 
    safeMetrics.tradingStyle === "Aggressive" ? "text-chart-3" : 
    safeMetrics.tradingStyle === "Conservative" ? "text-chart-4" : 
    "text-chart-2";

  const styleVariant = 
    safeMetrics.tradingStyle === "Aggressive" ? "destructive" : 
    safeMetrics.tradingStyle === "Conservative" ? "secondary" : 
    "default";

  // Determine what needs attention
  const needsAttention = [];
  if (safeMetrics.winRate < 50) needsAttention.push("Low Win Rate");
  if (safeMetrics.maxDrawdown > 20) needsAttention.push("High Drawdown");
  if (safeMetrics.consecutiveLosses >= 3) needsAttention.push("Loss Streak");
  if (safeMetrics.revengeTradeScore > 60) needsAttention.push("Revenge Trading");
  if (safeMetrics.riskScore > 70) needsAttention.push("High Risk");

  return (
    <Card data-testid="card-trading-dna" className="h-[340px] overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Trading DNA Overview
          </CardTitle>
          <Badge variant={styleVariant} className="text-[10px] h-5" data-testid="badge-trading-style">
            {safeMetrics.tradingStyle}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-0 pb-2 h-[calc(100%-56px)] overflow-y-auto card-scroll">
        <div className="space-y-3" data-testid="scrollable-dna-container">
        
        {/* Attention Needed Section */}
        {needsAttention.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <p className="text-xs font-semibold text-destructive">Needs Attention</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {needsAttention.map((item, idx) => (
                <Badge key={idx} variant="destructive" className="text-[9px] h-5">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Key Metrics - Simplified */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-md bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-0.5">Win Rate</p>
            <p className="text-xl font-mono font-bold text-chart-2" data-testid="text-win-rate">
              {safeMetrics.winRate.toFixed(1)}%
            </p>
            <p className="text-[9px] text-muted-foreground">
              {safeMetrics.winningTrades}W / {safeMetrics.losingTrades}L
            </p>
          </div>
          <div className="p-2.5 rounded-md bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Trades</p>
            <p className="text-xl font-mono font-bold" data-testid="text-total-trades">
              {safeMetrics.totalTrades}
            </p>
            <p className="text-[9px] text-muted-foreground">positions</p>
          </div>
        </div>

        {/* Risk Score - Highlighted */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Risk Score
            </p>
            <span className={`text-lg font-mono font-semibold ${styleColor}`} data-testid="text-risk-score">
              {safeMetrics.riskScore}/100
            </span>
          </div>
          <Progress value={safeMetrics.riskScore} className="h-1.5" />
          <p className="text-[9px] text-muted-foreground">
            {safeMetrics.riskScore < 40 ? 'Low risk - trading conservatively' : 
             safeMetrics.riskScore < 70 ? 'Moderate risk - balanced approach' : 
             'High risk - review your strategy'}
          </p>
        </div>

        {/* Total P&L */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total Profit & Loss</p>
          <p className={`text-2xl font-mono font-bold ${safeMetrics.totalProfitLoss >= 0 ? 'text-chart-2' : 'text-chart-3'}`} data-testid="text-total-pnl">
            {safeMetrics.totalProfitLoss >= 0 ? '+' : ''}${safeMetrics.totalProfitLoss.toFixed(2)}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">lifetime performance</p>
        </div>

        {/* Performance Indicators */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/30">
            <p className="text-[9px] text-muted-foreground mb-0.5">Profit Factor</p>
            <p className="text-sm font-mono font-semibold" data-testid="text-profit-factor">
              {safeMetrics.profitFactor.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <p className="text-[9px] text-muted-foreground mb-0.5">Drawdown</p>
            <p className="text-sm font-mono font-semibold text-chart-3" data-testid="text-max-drawdown">
              {safeMetrics.maxDrawdown.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <p className="text-[9px] text-muted-foreground mb-0.5">Loss Streak</p>
            <p className="text-sm font-mono font-semibold" data-testid="text-consecutive-losses">
              {safeMetrics.consecutiveLosses}
            </p>
          </div>
        </div>

        {/* Behavioral Risk Indicators */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[10px] font-medium text-muted-foreground">Behavioral Risks</p>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground">Revenge Trade Risk</p>
              <span className={`text-[10px] font-mono font-semibold ${safeMetrics.revengeTradeScore > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {safeMetrics.revengeTradeScore}/100
              </span>
            </div>
            <Progress value={safeMetrics.revengeTradeScore} className="h-1" />
          </div>
        </div>

        {/* AI Recommended Daily Limit */}
        <div className="p-2.5 rounded-md bg-destructive/5 border border-destructive/20">
          <p className="text-[10px] font-medium text-destructive mb-1">AI Recommended Daily Limit</p>
          <p className="text-base font-mono font-semibold text-destructive" data-testid="text-daily-limit">
            ${safeMetrics.recommendedDailyLossLimit.toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">maximum loss per day</p>
        </div>

        </div>
      </CardContent>
    </Card>
  );
}
