import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Newspaper, 
  PieChart, 
  GraduationCap, 
  TrendingUp, 
  GitBranch, 
  Activity,
  Calculator,
  Shield,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronRight,
  Target,
  Zap
} from "lucide-react";

interface AIFeaturesHubProps {
  userId: string;
  currentPrices: Record<string, number>;
}

export default function AIFeaturesHub({ userId, currentPrices }: AIFeaturesHubProps) {
  const { toast } = useToast();

  // Risk Assessment
  const { data: riskAssessment, isLoading: riskLoading } = useQuery({
    queryKey: ["/api/ai/risk/latest", userId],
    enabled: !!userId,
  });

  const assessRisk = useMutation({
    mutationFn: () => apiRequest("/api/ai/risk/assess", "POST", { currentPrices }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/risk/latest", userId] });
      toast({ title: "Risk Assessment Complete", description: "Portfolio risk analyzed successfully" });
    },
  });

  // News Analysis
  const { data: newsData } = useQuery({
    queryKey: ["/api/ai/news/latest"],
    enabled: !!userId,
  });

  const generateNews = useMutation({
    mutationFn: () => apiRequest("/api/ai/news/generate", "POST", { symbols: ["BTC", "ETH", "SOL"] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/news/latest"] });
      toast({ title: "News Briefing Generated", description: "Latest market news analyzed" });
    },
  });

  // Portfolio Optimization
  const { data: optimization, isLoading: optLoading } = useQuery({
    queryKey: ["/api/ai/portfolio/latest", userId],
    enabled: !!userId,
  });

  const optimizePortfolio = useMutation({
    mutationFn: () => apiRequest("/api/ai/portfolio/optimize", "POST", { currentPrices }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/portfolio/latest", userId] });
      toast({ title: "Portfolio Optimized", description: "Rebalancing recommendations generated" });
    },
  });

  // Trading Coach
  const { data: coachingInsights } = useQuery({
    queryKey: ["/api/ai/coach/insights", userId],
    enabled: !!userId,
  });

  const analyzeCoaching = useMutation({
    mutationFn: () => apiRequest("/api/ai/coach/analyze", "POST", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/coach/insights", userId] });
      toast({ title: "Coaching Analysis Complete", description: "New learning insights available" });
    },
  });

  // Price Predictions
  const { data: btcPrediction } = useQuery({
    queryKey: ["/api/ai/predictions", "BTC"],
    select: (data: any[]) => data?.[0],
  });

  const generatePrediction = useMutation({
    mutationFn: (symbol: string) => apiRequest("/api/ai/predictions/generate", "POST", {
      symbol,
      currentPrice: currentPrices[symbol] || 0,
      timeframe: "24h",
      marketData: {}
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/predictions"] });
      toast({ title: "Prediction Generated", description: "Price forecast updated" });
    },
  });

  // Correlation Analysis
  const { data: correlations } = useQuery({
    queryKey: ["/api/ai/correlations", userId],
    enabled: !!userId,
  });

  const analyzeCorrelations = useMutation({
    mutationFn: () => apiRequest("/api/ai/correlations/analyze", "POST", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/correlations", userId] });
      toast({ title: "Correlation Analysis Complete", description: "Portfolio correlations analyzed" });
    },
  });

  // Volatility Forecast
  const { data: volatilityOverview } = useQuery({
    queryKey: ["/api/ai/volatility/market/overview"],
  });

  const forecastVolatility = useMutation({
    mutationFn: (symbol: string) => {
      const historicalPrices = [currentPrices[symbol] || 0]; // Simplified
      return apiRequest("/api/ai/volatility/forecast", "POST", {
        symbol,
        currentPrice: currentPrices[symbol] || 0,
        historicalPrices,
        timeframe: "24h"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/volatility/market/overview"] });
      toast({ title: "Volatility Forecast Updated", description: "Market volatility analyzed" });
    },
  });

  // Position Sizing
  const [positionSizeSymbol, setPositionSizeSymbol] = useState("BTC");
  const [positionSizeResult, setPositionSizeResult] = useState<any>(null);

  const calculatePositionSize = useMutation({
    mutationFn: (params: { symbol: string; entryPrice: number; stopLoss?: number }) => 
      apiRequest("/api/ai/position-size/calculate", "POST", params),
    onSuccess: (data) => {
      setPositionSizeResult(data);
      toast({ title: "Position Size Calculated", description: "Optimal sizing determined" });
    },
  });

  return (
    <Card data-testid="card-ai-features-hub" className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Advanced AI Tools
        </CardTitle>
        <CardDescription>
          8 AI-powered features to enhance your trading strategy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="risk" className="w-full">
          <ScrollArea className="w-full pb-2">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              <TabsTrigger value="risk" data-testid="tab-risk-advisor">
                <Shield className="h-4 w-4 mr-2" />
                Risk
              </TabsTrigger>
              <TabsTrigger value="news" data-testid="tab-news-analyzer">
                <Newspaper className="h-4 w-4 mr-2" />
                News
              </TabsTrigger>
              <TabsTrigger value="portfolio" data-testid="tab-portfolio-optimizer">
                <PieChart className="h-4 w-4 mr-2" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger value="coach" data-testid="tab-trading-coach">
                <GraduationCap className="h-4 w-4 mr-2" />
                Coach
              </TabsTrigger>
              <TabsTrigger value="predictions" data-testid="tab-price-predictions">
                <TrendingUp className="h-4 w-4 mr-2" />
                Predict
              </TabsTrigger>
              <TabsTrigger value="correlations" data-testid="tab-correlation-detector">
                <GitBranch className="h-4 w-4 mr-2" />
                Correlate
              </TabsTrigger>
              <TabsTrigger value="volatility" data-testid="tab-volatility-forecaster">
                <Activity className="h-4 w-4 mr-2" />
                Volatility
              </TabsTrigger>
              <TabsTrigger value="sizing" data-testid="tab-position-sizing">
                <Calculator className="h-4 w-4 mr-2" />
                Sizing
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          {/* Risk Advisor Tab */}
          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Risk Assessment</h3>
              <Button 
                onClick={() => assessRisk.mutate()} 
                disabled={assessRisk.isPending}
                size="sm"
                data-testid="button-assess-risk"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${assessRisk.isPending ? 'animate-spin' : ''}`} />
                Analyze Risk
              </Button>
            </div>
            
            {riskLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : riskAssessment && typeof riskAssessment === 'object' && 'riskLevel' in riskAssessment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Level</p>
                    <p className="text-2xl font-semibold capitalize">{(riskAssessment as any).riskLevel}</p>
                  </div>
                  <Badge variant={
                    (riskAssessment as any).riskLevel === 'low' ? 'default' : 
                    (riskAssessment as any).riskLevel === 'medium' ? 'secondary' : 'destructive'
                  }>
                    Score: {(riskAssessment as any).riskScore}
                  </Badge>
                </div>
                
                {(() => {
                  try {
                    const warnings = (riskAssessment as any).warnings && JSON.parse((riskAssessment as any).warnings);
                    return warnings && warnings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Warnings</p>
                        {warnings.map((warning: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <p className="text-sm">{warning}</p>
                          </div>
                        ))}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No risk assessment available. Click analyze to generate.</p>
              </div>
            )}
          </TabsContent>

          {/* News Analyzer Tab */}
          <TabsContent value="news" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Market News Analysis</h3>
              <Button 
                onClick={() => generateNews.mutate()} 
                disabled={generateNews.isPending}
                size="sm"
                data-testid="button-generate-news"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${generateNews.isPending ? 'animate-spin' : ''}`} />
                Refresh News
              </Button>
            </div>
            
            {newsData && Array.isArray(newsData) && newsData.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {newsData.slice(0, 5).map((item: any, i: number) => (
                    <div key={i} className="p-4 border rounded-lg hover-elevate">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-2">{item.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{item.symbol}</Badge>
                            <Badge variant={item.sentiment === 'bullish' ? 'default' : item.sentiment === 'bearish' ? 'destructive' : 'secondary'}>
                              {item.sentiment}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No news available. Click refresh to analyze latest market news.</p>
              </div>
            )}
          </TabsContent>

          {/* Portfolio Optimizer Tab */}
          <TabsContent value="portfolio" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Optimization</h3>
              <Button 
                onClick={() => optimizePortfolio.mutate()} 
                disabled={optimizePortfolio.isPending}
                size="sm"
                data-testid="button-optimize-portfolio"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${optimizePortfolio.isPending ? 'animate-spin' : ''}`} />
                Optimize
              </Button>
            </div>
            
            {optLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : optimization && typeof optimization === 'object' && 'diversificationScore' in optimization ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Diversification Score</p>
                    <p className="text-2xl font-semibold">{(optimization as any).diversificationScore}/100</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
                    <p className="text-2xl font-semibold">{parseFloat((optimization as any).riskRewardRatio).toFixed(2)}</p>
                  </div>
                </div>
                
                {(() => {
                  try {
                    const recommendations = (optimization as any).recommendations && JSON.parse((optimization as any).recommendations);
                    return recommendations && recommendations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recommendations</p>
                        {recommendations.map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-3 border rounded-md">
                            <ChevronRight className="h-4 w-4 text-primary mt-0.5" />
                            <p className="text-sm">{rec.action}: {rec.symbol} ({rec.percentage}%)</p>
                          </div>
                        ))}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No optimization available. Click optimize to analyze your portfolio.</p>
              </div>
            )}
          </TabsContent>

          {/* Trading Coach Tab */}
          <TabsContent value="coach" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Trading Coach Insights</h3>
              <Button 
                onClick={() => analyzeCoaching.mutate()} 
                disabled={analyzeCoaching.isPending}
                size="sm"
                data-testid="button-analyze-coaching"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${analyzeCoaching.isPending ? 'animate-spin' : ''}`} />
                Get Insights
              </Button>
            </div>
            
            {coachingInsights && Array.isArray(coachingInsights) && coachingInsights.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {coachingInsights.map((insight: any) => (
                    <div key={insight.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="capitalize">{insight.category}</Badge>
                            <Badge variant={insight.priority === 'high' ? 'destructive' : 'secondary'}>
                              {insight.priority}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{insight.insight}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No coaching insights available. Click to analyze your trading patterns.</p>
              </div>
            )}
          </TabsContent>

          {/* Price Predictions Tab */}
          <TabsContent value="predictions" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Price Predictions</h3>
              <div className="flex gap-2">
                {["BTC", "ETH", "SOL"].map(symbol => (
                  <Button
                    key={symbol}
                    onClick={() => generatePrediction.mutate(symbol)}
                    disabled={generatePrediction.isPending}
                    size="sm"
                    variant="outline"
                    data-testid={`button-predict-${symbol}`}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>
            
            {btcPrediction ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">BTC 24h Forecast</p>
                    <Badge variant={parseFloat(btcPrediction.confidence) > 70 ? 'default' : 'secondary'}>
                      {btcPrediction.confidence}% confidence
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-lg font-semibold">${parseFloat(btcPrediction.predictedPrice).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Low</p>
                      <p className="text-lg">${parseFloat(btcPrediction.lowerBound).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">High</p>
                      <p className="text-lg">${parseFloat(btcPrediction.upperBound).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No predictions available. Select a symbol to generate forecast.</p>
              </div>
            )}
          </TabsContent>

          {/* Correlation Detector Tab */}
          <TabsContent value="correlations" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Correlations</h3>
              <Button 
                onClick={() => analyzeCorrelations.mutate()} 
                disabled={analyzeCorrelations.isPending}
                size="sm"
                data-testid="button-analyze-correlations"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${analyzeCorrelations.isPending ? 'animate-spin' : ''}`} />
                Analyze
              </Button>
            </div>
            
            {correlations && Array.isArray(correlations) && correlations.length > 0 ? (
              <div className="space-y-3">
                {correlations.slice(0, 5).map((corr: any) => (
                  <div key={corr.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{corr.assetPair}</p>
                          <p className="text-sm text-muted-foreground">Correlation: {parseFloat(corr.correlationCoefficient).toFixed(2)}</p>
                        </div>
                      </div>
                      <Badge variant={corr.correlationType === 'positive' ? 'default' : 'secondary'}>
                        {corr.correlationType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No correlation data available. Click analyze to check portfolio correlations.</p>
              </div>
            )}
          </TabsContent>

          {/* Volatility Forecaster Tab */}
          <TabsContent value="volatility" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Market Volatility Forecast</h3>
              <div className="flex gap-2">
                {["BTC", "ETH", "SOL"].map(symbol => (
                  <Button
                    key={symbol}
                    onClick={() => forecastVolatility.mutate(symbol)}
                    disabled={forecastVolatility.isPending}
                    size="sm"
                    variant="outline"
                    data-testid={`button-volatility-${symbol}`}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>
            
            {volatilityOverview && typeof volatilityOverview === 'object' && 'marketCondition' in volatilityOverview ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Market Condition</p>
                  <Badge variant={
                    (volatilityOverview as any).marketCondition === 'calm' ? 'default' :
                    (volatilityOverview as any).marketCondition === 'volatile' ? 'destructive' : 'secondary'
                  } className="text-base">
                    {((volatilityOverview as any).marketCondition || '').toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">High Vol</p>
                    <p className="text-lg font-semibold">{(volatilityOverview as any).highVolatility?.length || 0}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Normal</p>
                    <p className="text-lg font-semibold">{(volatilityOverview as any).normalVolatility?.length || 0}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Low Vol</p>
                    <p className="text-lg font-semibold">{(volatilityOverview as any).lowVolatility?.length || 0}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No volatility data available. Select a symbol to forecast volatility.</p>
              </div>
            )}
          </TabsContent>

          {/* Position Sizing Tab */}
          <TabsContent value="sizing" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Position Size Calculator</h3>
              <div className="flex gap-2">
                {["BTC", "ETH", "SOL"].map(symbol => (
                  <Button
                    key={symbol}
                    onClick={() => {
                      setPositionSizeSymbol(symbol);
                      calculatePositionSize.mutate({
                        symbol,
                        entryPrice: currentPrices[symbol] || 0
                      });
                    }}
                    disabled={calculatePositionSize.isPending}
                    size="sm"
                    variant="outline"
                    data-testid={`button-size-${symbol}`}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>
            
            {positionSizeResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Suggested Size</p>
                    <p className="text-2xl font-semibold">${positionSizeResult.suggestedSize.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {positionSizeResult.suggestedPercentage.toFixed(1)}% of portfolio
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Kelly Criterion</p>
                    <p className="text-2xl font-semibold">{positionSizeResult.kellyPercentage.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Win Rate: {positionSizeResult.winRate.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Reasoning</p>
                  <p className="text-sm text-muted-foreground">{positionSizeResult.reasoning}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sizing calculation available. Select a symbol to calculate optimal position size.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
