import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, TrendingUp, TrendingDown, Brain, CheckCircle2, XCircle, RefreshCw, AlertTriangle, ArrowRightCircle, AlertCircle, Activity } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePriceSocket } from "@/hooks/usePriceSocket";
import ExecuteSuggestionDialog from "@/components/ExecuteSuggestionDialog";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { AgentConfidenceBadge } from "@/components/AgentConfidenceBadge";
import { AITransparencyLayer } from "@/components/AITransparencyLayer";
import { useState } from "react";

interface AIInsightsCardProps {
  userId: string;
}

export default function AIInsightsCard({ userId }: AIInsightsCardProps) {
  const { toast } = useToast();
  const { prices, connected } = usePriceSocket();
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);

  // Fetch market sentiment
  const { data: sentiments, isLoading: sentimentsLoading } = useQuery({
    queryKey: ["/api/ai/sentiment"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch trading patterns
  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ["/api/ai/patterns", userId],
  });

  // Fetch active suggestions
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["/api/ai/suggestions/active", userId],
  });

  // Analyze patterns mutation
  const analyzePatterns = useMutation({
    mutationFn: () => apiRequest("/api/ai/patterns/analyze", "POST", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/patterns", userId] });
      toast({
        title: "Analysis Complete",
        description: "Your trading patterns have been analyzed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze patterns",
        variant: "destructive",
      });
    },
  });

  // Generate suggestions mutation
  const generateSuggestions = useMutation({
    mutationFn: () => apiRequest("/api/ai/suggestions/generate", "POST", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggestions/active", userId] });
      toast({
        title: "Suggestions Generated",
        description: "New AI trade suggestions are available",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate suggestions",
        variant: "destructive",
      });
    },
  });

  // Handle execute button click - open dialog
  const handleExecuteClick = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setExecuteDialogOpen(true);
  };

  // Dismiss suggestion mutation
  const dismissSuggestion = useMutation({
    mutationFn: (suggestionId: string) => apiRequest("PUT", `/api/ai/suggestions/${suggestionId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggestions/active", userId] });
      toast({
        title: "Suggestion Dismissed",
        description: "Trade suggestion has been dismissed",
      });
    },
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "bullish": return "text-green-500";
      case "bearish": return "text-red-500";
      case "neutral": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "bullish": return <TrendingUp className="h-4 w-4" />;
      case "bearish": return <TrendingDown className="h-4 w-4" />;
      case "neutral": return <ArrowRightCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card data-testid="card-ai-insights">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>AI Insights</CardTitle>
          </div>
          <AgentConfidenceBadge showLevel={true} size="sm" />
        </div>
        <CardDescription>Market analysis, patterns, and AI-powered suggestions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sentiment" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sentiment" data-testid="tab-sentiment">
              <TrendingUp className="w-4 h-4 mr-2" />
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">
              <Brain className="w-4 h-4 mr-2" />
              Patterns
            </TabsTrigger>
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              <Sparkles className="w-4 h-4 mr-2" />
              Suggestions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sentiment" className="space-y-4 mt-4">
            {sentimentsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading sentiment...</p>
              </div>
            ) : sentiments && Array.isArray(sentiments) && sentiments.length > 0 ? (
              <div className="space-y-3">
                {sentiments.map((item: any) => (
                  <div key={item.symbol} className="border border-border rounded-lg p-4" data-testid={`sentiment-${item.symbol.toLowerCase()}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={getSentimentColor(item.sentiment)}>
                          {getSentimentIcon(item.sentiment)}
                        </div>
                        <span className="font-semibold">{item.symbol}</span>
                      </div>
                      <Badge variant="outline" className={getSentimentColor(item.sentiment)}>
                        {item.sentiment}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.summary}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Score: {typeof item.score === 'number' ? item.score.toFixed(2) : parseFloat(item.score || 0).toFixed(2)}</span>
                      <span>{item.newsCount} news sources</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No sentiment data available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4 mt-4">
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => analyzePatterns.mutate()}
                disabled={analyzePatterns.isPending}
                data-testid="button-analyze-patterns"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${analyzePatterns.isPending ? "animate-spin" : ""}`} />
                Analyze Now
              </Button>
            </div>
            {patternsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading patterns...</p>
              </div>
            ) : patterns && Array.isArray(patterns) && patterns.length > 0 ? (
              <div className="space-y-3">
                {patterns.map((pattern: any) => (
                  <div key={pattern.id} className="border border-border rounded-lg p-4" data-testid={`pattern-${pattern.patternType}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold capitalize">{pattern.patternType.replace('_', ' ')}</span>
                      <Badge variant="outline">
                        {pattern.confidence ? (pattern.confidence * 100).toFixed(0) : 0}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{pattern.description}</p>
                    {pattern.recommendation && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {pattern.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No patterns analyzed yet</p>
                <Button
                  variant="outline"
                  onClick={() => analyzePatterns.mutate()}
                  disabled={analyzePatterns.isPending}
                  data-testid="button-analyze-patterns-empty"
                >
                  {analyzePatterns.isPending ? "Analyzing..." : "Analyze My Trading Patterns"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4 mt-4">
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateSuggestions.mutate()}
                disabled={generateSuggestions.isPending}
                data-testid="button-generate-suggestions"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${generateSuggestions.isPending ? "animate-spin" : ""}`} />
                Generate New
              </Button>
            </div>
            {suggestionsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading suggestions...</p>
              </div>
            ) : suggestions && Array.isArray(suggestions) && suggestions.length > 0 ? (
              <ScrollArea className="h-[420px] pr-4">
                <div className="space-y-3">
                  {suggestions.map((suggestion: any) => {
                    const livePrice = prices[suggestion.symbol as keyof typeof prices]?.price || 0;
                    const priceChange = prices[suggestion.symbol as keyof typeof prices]?.change || 0;
                    
                    return (
                      <div key={suggestion.id} className="border border-border rounded-lg p-4" data-testid={`suggestion-${suggestion.symbol.toLowerCase()}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{suggestion.symbol}</span>
                            <Badge variant={suggestion.action === 'buy' ? 'default' : 'secondary'}>
                              {suggestion.action.toUpperCase()}
                            </Badge>
                          </div>
                          <Badge variant="outline">
                            {suggestion.confidence ? suggestion.confidence.toFixed(0) : 0}%
                          </Badge>
                        </div>
                        
                        {/* Live Price */}
                        {connected && livePrice > 0 && (
                          <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded">
                            <Activity className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-muted-foreground">Live Price:</span>
                            <span className="text-sm font-mono font-bold">${livePrice.toLocaleString()}</span>
                            <span className={`text-xs font-mono ${priceChange >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground mb-3">{suggestion.reasoning}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-muted-foreground">Entry: </span>
                            <span className="font-medium">${suggestion.suggestedEntry ? suggestion.suggestedEntry.toFixed(2) : '0.00'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Target: </span>
                            <span className="font-medium text-green-500">${suggestion.targetPrice ? suggestion.targetPrice.toFixed(2) : '0.00'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stop Loss: </span>
                            <span className="font-medium text-red-500">${suggestion.stopLoss ? suggestion.stopLoss.toFixed(2) : '0.00'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Risk/Reward: </span>
                            <span className="font-medium">{suggestion.riskRewardRatio ? suggestion.riskRewardRatio.toFixed(2) : '0.00'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={() => handleExecuteClick(suggestion)}
                            data-testid={`button-execute-${suggestion.symbol.toLowerCase()}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Execute
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => dismissSuggestion.mutate(suggestion.id)}
                            disabled={dismissSuggestion.isPending}
                            data-testid={`button-dismiss-${suggestion.symbol.toLowerCase()}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                        
                        {/* Phase 4: Feedback & Transparency */}
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          <FeedbackButtons
                            contextType="trade_suggestion"
                            contextId={suggestion.id}
                            aiInput={{
                              symbol: suggestion.symbol,
                              marketPrice: livePrice,
                              patterns: suggestion.detectedPatterns || []
                            }}
                            aiOutput={{
                              action: suggestion.action,
                              entryPrice: suggestion.suggestedEntry,
                              targetPrice: suggestion.targetPrice,
                              stopLoss: suggestion.stopLoss,
                              riskReward: suggestion.riskRewardRatio
                            }}
                            aiReasoning={suggestion.reasoning}
                            userAction={suggestion.status === 'dismissed' ? 'rejected' : 'ignored'}
                            onFeedbackSubmitted={() => {
                              queryClient.invalidateQueries({ queryKey: ['/api/ai/suggestions/active', userId] });
                            }}
                          />
                          
                          <AITransparencyLayer
                            reasoning={suggestion.reasoning}
                            dataUsed={{
                              symbol: suggestion.symbol,
                              action: suggestion.action,
                              entryPrice: `$${suggestion.suggestedEntry?.toFixed(2)}`,
                              targetPrice: `$${suggestion.targetPrice?.toFixed(2)}`,
                              stopLoss: `$${suggestion.stopLoss?.toFixed(2)}`,
                              riskRewardRatio: suggestion.riskRewardRatio?.toFixed(2),
                              marketPrice: livePrice > 0 ? `$${livePrice.toLocaleString()}` : 'N/A',
                              priceChange: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`
                            }}
                            confidence={suggestion.confidence ? suggestion.confidence * 100 : 0}
                            variant="compact"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No active suggestions</p>
                <Button
                  variant="outline"
                  onClick={() => generateSuggestions.mutate()}
                  disabled={generateSuggestions.isPending}
                  data-testid="button-generate-suggestions-empty"
                >
                  {generateSuggestions.isPending ? "Generating..." : "Generate AI Suggestions"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Execute Suggestion Dialog */}
      {selectedSuggestion && (
        <ExecuteSuggestionDialog
          suggestion={selectedSuggestion}
          userId={userId}
          open={executeDialogOpen}
          onOpenChange={setExecuteDialogOpen}
        />
      )}
    </Card>
  );
}
