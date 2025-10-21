import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Clock, TrendingUp, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { AgentConfidenceBadge } from "@/components/AgentConfidenceBadge";
import { AITransparencyLayer } from "@/components/AITransparencyLayer";

interface BriefingInsight {
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  title: string;
  description: string;
}

interface BriefingRecommendation {
  action: string;
  symbol: string;
  reasoning: string;
  confidence: number;
}

interface AIBriefingCardProps {
  timestamp?: Date;
  insights?: BriefingInsight[];
  recommendations?: BriefingRecommendation[];
  summary?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AIBriefingCard({
  timestamp = new Date(),
  insights = [],
  recommendations = [],
  summary = "No briefing available",
  onRefresh,
  isRefreshing = false
}: AIBriefingCardProps) {
  const getInsightIcon = (type: BriefingInsight['type']) => {
    switch (type) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-chart-2" />;
      case 'bearish': return <TrendingUp className="h-4 w-4 text-chart-3 rotate-180" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-chart-4" />;
      default: return <Info className="h-4 w-4 text-chart-5" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-chart-2";
    if (confidence >= 60) return "text-chart-1";
    return "text-chart-4";
  };

  return (
    <Card data-testid="card-ai-briefing">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Daily Briefing
          </CardTitle>
          <AgentConfidenceBadge showLevel={true} size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-timestamp">
            <Clock className="h-4 w-4" />
            {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-briefing"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs">Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]" data-testid="scroll-briefing">
          <div className="space-y-4">
            {/* Summary Section */}
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm leading-relaxed" data-testid="text-summary">{summary}</p>
            </div>

            {/* Key Insights */}
            {insights.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Key Insights</h3>
                <ul className="space-y-2">
                  {insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`insight-${index}`}>
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Recommendations</h3>
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className="bg-card p-4 rounded-md border border-border"
                      data-testid={`recommendation-${index}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" data-testid={`badge-action-${index}`}>{rec.action}</Badge>
                          <span className="font-mono font-medium">{rec.symbol}</span>
                        </div>
                        <div className={`text-sm font-medium ${getConfidenceColor(rec.confidence)}`} data-testid={`text-confidence-${index}`}>
                          {rec.confidence}% confidence
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{rec.reasoning}</p>
                      
                      {/* Phase 4: Feedback & Transparency */}
                      <div className="space-y-3 pt-3 border-t border-border">
                        <FeedbackButtons
                          contextType="briefing"
                          contextId={`briefing-${timestamp.toISOString()}-${index}`}
                          aiInput={{
                            symbol: rec.symbol,
                            marketConditions: summary
                          }}
                          aiOutput={{
                            action: rec.action,
                            confidence: rec.confidence
                          }}
                          aiReasoning={rec.reasoning}
                        />
                        
                        <AITransparencyLayer
                          reasoning={rec.reasoning}
                          dataUsed={{
                            symbol: rec.symbol,
                            action: rec.action,
                            briefingTime: timestamp.toLocaleTimeString(),
                            marketSummary: summary.substring(0, 100) + '...'
                          }}
                          confidence={rec.confidence}
                          variant="compact"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                AI-generated insights are for informational purposes only. Always do your own research before trading.
              </p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
