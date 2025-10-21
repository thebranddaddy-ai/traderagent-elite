import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Clock,
  Target, 
  AlertTriangle,
  Brain,
  BarChart3,
  Calendar,
  Activity
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

export default function DetailedDnaInsights() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: dna, isLoading } = useQuery<TradingDNAMetrics>({
    queryKey: ["/api/users", userId, "dna"],
    enabled: !!userId,
  });

  if (isLoading || !dna) {
    return (
      <div className="space-y-3">
        <div className="h-24 bg-muted rounded animate-pulse"></div>
        <div className="h-32 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  const safeMetrics = {
    winRate: dna.winRate ?? 0,
    totalTrades: dna.totalTrades ?? 0,
    profitFactor: dna.profitFactor ?? 0,
    sharpeRatio: dna.sharpeRatio ?? 0,
    riskScore: dna.riskScore ?? 50,
    avgProfit: dna.avgProfit ?? 0,
    avgLoss: dna.avgLoss ?? 0,
    totalProfitLoss: dna.totalProfitLoss ?? 0,
    consecutiveWins: dna.consecutiveWins ?? 0,
    consecutiveLosses: dna.consecutiveLosses ?? 0,
    maxDrawdown: dna.maxDrawdown ?? 0,
    largestWin: dna.largestWin ?? 0,
    largestLoss: dna.largestLoss ?? 0,
    revengeTradeScore: dna.revengeTradeScore ?? 0,
    volatilitySensitivity: dna.volatilitySensitivity ?? 50,
    recommendedDailyLossLimit: dna.recommendedDailyLossLimit ?? 500,
    recommendedMonthlyLossLimit: dna.recommendedMonthlyLossLimit ?? 2000,
    tradingStyle: dna.tradingStyle ?? "Balanced",
    bestTimeframe: dna.bestTimeframe ?? "morning",
    winningTrades: dna.winningTrades ?? 0,
    losingTrades: dna.losingTrades ?? 0,
    avgHoldTime: dna.avgHoldTime ?? 0,
    averageTradeSize: dna.averageTradeSize ?? 0,
  };

  const getPerformanceGrade = (profitFactor: number, sharpe: number) => {
    if (profitFactor >= 2 && sharpe >= 1) return { grade: "A+", color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/20" };
    if (profitFactor >= 1.5 && sharpe >= 0.5) return { grade: "A", color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/20" };
    if (profitFactor >= 1 && sharpe >= 0) return { grade: "B", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (profitFactor >= 0.8) return { grade: "C", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { grade: "D", color: "text-chart-3", bg: "bg-chart-3/10", border: "border-chart-3/20" };
  };

  const performanceGrade = getPerformanceGrade(safeMetrics.profitFactor, safeMetrics.sharpeRatio);

  const getTradeEfficiency = () => {
    if (safeMetrics.totalTrades === 0) return 0;
    return (safeMetrics.winningTrades / safeMetrics.totalTrades) * safeMetrics.profitFactor * 100;
  };

  const getRecommendations = () => {
    const recommendations = [];
    
    if (safeMetrics.revengeTradeScore > 60) {
      recommendations.push({ 
        type: "warning", 
        text: "High revenge trading tendency detected. Consider implementing cooling-off periods after losses.",
        icon: AlertTriangle,
        color: "text-amber-500"
      });
    }
    
    if (safeMetrics.maxDrawdown > 20) {
      recommendations.push({ 
        type: "warning", 
        text: "Significant drawdown observed. Review risk management and position sizing.",
        icon: Target,
        color: "text-chart-3"
      });
    }
    
    if (safeMetrics.winRate < 40) {
      recommendations.push({ 
        type: "info", 
        text: "Win rate below 40%. Focus on trade quality over quantity.",
        icon: Brain,
        color: "text-blue-500"
      });
    }
    
    if (safeMetrics.profitFactor > 1.5) {
      recommendations.push({ 
        type: "success", 
        text: "Strong profit factor. Your edge is working - stay consistent.",
        icon: TrendingUp,
        color: "text-chart-2"
      });
    }

    return recommendations;
  };

  const recommendations = getRecommendations();

  return (
    <div className="space-y-3 text-xs">
      {/* Performance Grade */}
      <div className={`p-3 rounded-lg ${performanceGrade.bg} border ${performanceGrade.border}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance Grade
          </p>
          <span className={`text-2xl font-bold font-mono ${performanceGrade.color}`}>
            {performanceGrade.grade}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Profit Factor</p>
            <p className="font-mono font-semibold">{safeMetrics.profitFactor.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Sharpe Ratio</p>
            <p className="font-mono font-semibold">{safeMetrics.sharpeRatio.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Win Rate</p>
            <p className="font-mono font-semibold">{safeMetrics.winRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Trade Efficiency */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Trade Efficiency
          </p>
          <span className="font-mono font-semibold text-primary">
            {getTradeEfficiency().toFixed(1)}%
          </span>
        </div>
        <Progress value={Math.min(getTradeEfficiency(), 100)} className="h-1.5" />
        <p className="text-[11px] text-muted-foreground">
          Measures win rate and profit factor combined
        </p>
      </div>

      {/* Trading Patterns */}
      <div className="space-y-2">
        <p className="font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          Trading Patterns
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-md bg-accent/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-1">Best Timeframe</p>
            <Badge variant="outline" className="text-xs capitalize">
              {safeMetrics.bestTimeframe}
            </Badge>
          </div>
          <div className="p-2 rounded-md bg-accent/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-1">Avg Hold Time</p>
            <p className="font-mono font-semibold">{safeMetrics.avgHoldTime.toFixed(1)}h</p>
          </div>
          <div className="p-2 rounded-md bg-accent/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-1">Avg Trade Size</p>
            <p className="font-mono font-semibold">${safeMetrics.averageTradeSize.toFixed(0)}</p>
          </div>
          <div className="p-2 rounded-md bg-accent/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground mb-1">Trading Style</p>
            <Badge variant="secondary" className="text-xs">
              {safeMetrics.tradingStyle}
            </Badge>
          </div>
        </div>
      </div>

      {/* Behavioral Metrics */}
      <div className="space-y-2">
        <p className="font-medium flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" />
          Behavioral Analysis
        </p>
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Revenge Trade Risk</span>
              <span className="font-mono font-semibold">{safeMetrics.revengeTradeScore}/100</span>
            </div>
            <Progress 
              value={safeMetrics.revengeTradeScore} 
              className={`h-1 ${safeMetrics.revengeTradeScore > 60 ? '[&>div]:bg-chart-3' : '[&>div]:bg-chart-2'}`}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Volatility Sensitivity</span>
              <span className="font-mono font-semibold">{safeMetrics.volatilitySensitivity}/100</span>
            </div>
            <Progress value={safeMetrics.volatilitySensitivity} className="h-1" />
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-primary" />
            AI Insights
          </p>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => {
              const Icon = rec.icon;
              return (
                <div key={idx} className="p-2 rounded-md bg-accent/30 border border-border/50 flex gap-2">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${rec.color}`} />
                  <p className="text-[11px] leading-relaxed">{rec.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Win/Loss Breakdown */}
      {safeMetrics.totalTrades > 0 && (
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            Performance Breakdown
          </p>
          <div className="flex gap-1">
            <div 
              className="h-8 bg-chart-2 rounded-md flex items-center justify-center text-xs font-semibold text-white transition-all"
              style={{ width: `${(safeMetrics.winningTrades / safeMetrics.totalTrades) * 100}%` }}
            >
              {safeMetrics.winningTrades > 0 && `${safeMetrics.winningTrades}W`}
            </div>
            <div 
              className="h-8 bg-chart-3 rounded-md flex items-center justify-center text-xs font-semibold text-white transition-all"
              style={{ width: `${(safeMetrics.losingTrades / safeMetrics.totalTrades) * 100}%` }}
            >
              {safeMetrics.losingTrades > 0 && `${safeMetrics.losingTrades}L`}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Largest Win</p>
              <p className="font-mono font-bold text-chart-2">${safeMetrics.largestWin.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Largest Loss</p>
              <p className="font-mono font-bold text-chart-3">${Math.abs(safeMetrics.largestLoss).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
