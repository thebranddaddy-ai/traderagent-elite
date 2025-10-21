import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  RefreshCw, 
  Newspaper,
  BarChart3,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from "recharts";

interface MarketSentimentDashboardProps {
  onRefresh?: () => void;
}

export default function MarketSentimentDashboard({ onRefresh }: MarketSentimentDashboardProps) {
  // Fetch market sentiment
  const { data: sentiments, isLoading, refetch } = useQuery({
    queryKey: ["/api/ai/sentiment"],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "bullish": return "text-green-600 dark:text-green-500";
      case "bearish": return "text-red-600 dark:text-red-500";
      case "neutral": return "text-yellow-600 dark:text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  const getSentimentBgColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "bullish": return "bg-green-500/10 border-green-500/20";
      case "bearish": return "bg-red-500/10 border-red-500/20";
      case "neutral": return "bg-yellow-500/10 border-yellow-500/20";
      default: return "bg-muted";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "bullish": return <TrendingUp className="h-5 w-5" />;
      case "bearish": return <TrendingDown className="h-5 w-5" />;
      case "neutral": return <Activity className="h-5 w-5" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Calculate overall market sentiment
  const calculateOverallSentiment = () => {
    if (!sentiments || !Array.isArray(sentiments) || sentiments.length === 0) return null;
    
    const scores = sentiments.map((s: any) => {
      const score = typeof s.score === 'number' ? s.score : parseFloat(s.score || 0);
      return score;
    });
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const bullish = sentiments.filter((s: any) => s.sentiment?.toLowerCase() === 'bullish').length;
    const bearish = sentiments.filter((s: any) => s.sentiment?.toLowerCase() === 'bearish').length;
    const neutral = sentiments.filter((s: any) => s.sentiment?.toLowerCase() === 'neutral').length;
    
    return {
      avgScore,
      bullish,
      bearish,
      neutral,
      total: sentiments.length,
      dominant: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral'
    };
  };

  const overall = calculateOverallSentiment();

  // Prepare chart data
  const sentimentDistribution = overall ? [
    { name: 'Bullish', value: overall.bullish, color: '#10b981' },
    { name: 'Bearish', value: overall.bearish, color: '#ef4444' },
    { name: 'Neutral', value: overall.neutral, color: '#f59e0b' }
  ] : [];

  const scoreHistory = sentiments && Array.isArray(sentiments) ? sentiments.map((s: any) => ({
    symbol: s.symbol,
    score: typeof s.score === 'number' ? s.score : parseFloat(s.score || 0)
  })) : [];

  if (isLoading) {
    return (
      <Card data-testid="card-market-sentiment">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Sentiment Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing market sentiment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-market-sentiment">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Market Sentiment Analysis
            </CardTitle>
            <CardDescription>
              AI-powered analysis of crypto market sentiment from news sources
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            data-testid="button-refresh-sentiment"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="details" data-testid="tab-details">
              <Newspaper className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts">
              <TrendingUp className="h-4 w-4 mr-2" />
              Charts
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {overall && (
              <>
                {/* Overall Market Mood */}
                <div className={`p-4 rounded-lg border ${getSentimentBgColor(overall.dominant)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Overall Market Mood</h3>
                    <div className={`flex items-center gap-2 ${getSentimentColor(overall.dominant)}`}>
                      {getSentimentIcon(overall.dominant)}
                      <Badge variant="outline" className={getSentimentColor(overall.dominant)}>
                        {overall.dominant.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Average Sentiment Score</span>
                      <span className="font-mono font-semibold">{overall.avgScore.toFixed(2)}</span>
                    </div>
                    <Progress 
                      value={((overall.avgScore + 100) / 200) * 100} 
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>-100 (Extreme Bear)</span>
                      <span>0 (Neutral)</span>
                      <span>+100 (Extreme Bull)</span>
                    </div>
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-500" />
                      <span className="text-sm font-medium">Bullish</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                      {overall.bullish}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((overall.bullish / overall.total) * 100).toFixed(0)}% of assets
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-500" />
                      <span className="text-sm font-medium">Bearish</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                      {overall.bearish}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((overall.bearish / overall.total) * 100).toFixed(0)}% of assets
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Minus className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                      <span className="text-sm font-medium">Neutral</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                      {overall.neutral}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((overall.neutral / overall.total) * 100).toFixed(0)}% of assets
                    </p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details">
            <ScrollArea className="h-[400px]">
              {sentiments && Array.isArray(sentiments) && sentiments.length > 0 ? (
                <div className="space-y-3 pr-4">
                  {sentiments.map((item: any) => (
                    <div 
                      key={item.symbol} 
                      className={`border rounded-lg p-4 ${getSentimentBgColor(item.sentiment)}`}
                      data-testid={`sentiment-${item.symbol.toLowerCase()}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-background/50`}>
                            {getSentimentIcon(item.sentiment)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{item.symbol}</h4>
                            <Badge variant="outline" className={`${getSentimentColor(item.sentiment)} mt-1`}>
                              {item.sentiment}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Score</p>
                          <p className={`text-xl font-bold font-mono ${getSentimentColor(item.sentiment)}`}>
                            {typeof item.score === 'number' ? item.score.toFixed(1) : parseFloat(item.score || 0).toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Analysis</p>
                          <p className="text-sm">{item.summary}</p>
                        </div>

                        {item.newsCount && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Newspaper className="h-3 w-3" />
                            <span>Based on {item.newsCount} news sources</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No sentiment data available</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefresh}
                    className="mt-4"
                  >
                    Load Sentiment Data
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sentiment Distribution Pie Chart */}
              <div className="h-[250px]">
                <h3 className="text-sm font-medium mb-4">Sentiment Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sentimentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Sentiment Scores Bar Chart */}
              <div className="h-[250px]">
                <h3 className="text-sm font-medium mb-4">Sentiment Scores by Asset</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="symbol" fontSize={12} />
                    <YAxis domain={[-100, 100]} fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar 
                      dataKey="score" 
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
