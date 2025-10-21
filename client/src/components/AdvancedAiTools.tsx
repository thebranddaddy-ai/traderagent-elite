import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Newspaper,
  PieChart,
  MessageSquare,
  TrendingUp,
  GitBranch,
  Activity,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type AITool = 
  | "risk"
  | "news"
  | "portfolio"
  | "coach"
  | "predict"
  | "correlate"
  | "volatility"
  | "sizing";

const AI_TOOLS = [
  { id: "risk" as AITool, label: "Risk", icon: Brain },
  { id: "news" as AITool, label: "News", icon: Newspaper },
  { id: "portfolio" as AITool, label: "Portfolio", icon: PieChart },
  { id: "coach" as AITool, label: "Coach", icon: MessageSquare },
  { id: "predict" as AITool, label: "Predict", icon: TrendingUp },
  { id: "correlate" as AITool, label: "Correlate", icon: GitBranch },
  { id: "volatility" as AITool, label: "Volatility", icon: Activity },
  { id: "sizing" as AITool, label: "Sizing", icon: Maximize2 },
];

interface AdvancedAiToolsProps {
  onTradeAction?: (symbol: string, side: 'buy' | 'sell', quantity: number) => void;
}

export default function AdvancedAiTools({ onTradeAction }: AdvancedAiToolsProps) {
  const [activeTool, setActiveTool] = useState<AITool>("predict");

  return (
    <Card className="max-h-[400px] overflow-hidden" data-testid="card-advanced-ai-tools">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Advanced AI Tools
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          8 AI-powered features to enhance your trading strategy
        </p>
      </CardHeader>
      
      {/* Tab Navigation */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            
            return (
              <Button
                key={tool.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${
                  isActive ? "" : "text-muted-foreground"
                }`}
                data-testid={`tab-${tool.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tool.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <CardContent className="px-4 pb-4 overflow-y-auto card-scroll" style={{ height: "calc(400px - 140px)" }}>
        {activeTool === "risk" && <RiskAssessment />}
        {activeTool === "news" && <NewsAnalysis />}
        {activeTool === "portfolio" && <PortfolioAnalysis />}
        {activeTool === "coach" && <AICoach />}
        {activeTool === "predict" && <PredictiveAnalysis onTradeAction={onTradeAction} />}
        {activeTool === "correlate" && <CorrelationAnalysis />}
        {activeTool === "volatility" && <VolatilityAnalysis />}
        {activeTool === "sizing" && <PositionSizing />}
      </CardContent>
    </Card>
  );
}

function RiskAssessment() {
  return (
    <div className="space-y-4" data-testid="content-risk">
      <div>
        <h3 className="text-sm font-semibold mb-3">Portfolio Risk Assessment</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Risk Level</span>
            <Badge variant="default" className="bg-chart-2/20 text-chart-2 hover:bg-chart-2/30">
              Low
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Score</span>
            <span className="text-sm font-semibold">14.59</span>
          </div>
          <Button size="sm" className="w-full mt-2" data-testid="button-analyze-risk">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Analyze Risk
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewsAnalysis() {
  return (
    <div className="space-y-3" data-testid="content-news">
      <h3 className="text-sm font-semibold">Market News Analysis</h3>
      <p className="text-xs text-muted-foreground">
        AI-powered analysis of latest market news and sentiment trends.
      </p>
      <div className="space-y-2 pt-2">
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="font-medium mb-1">Bitcoin ETF Approval Impact</div>
          <div className="text-muted-foreground">Sentiment: Bullish • 2h ago</div>
        </div>
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="font-medium mb-1">Fed Rate Decision Analysis</div>
          <div className="text-muted-foreground">Sentiment: Neutral • 4h ago</div>
        </div>
      </div>
    </div>
  );
}

function PortfolioAnalysis() {
  return (
    <div className="space-y-3" data-testid="content-portfolio">
      <h3 className="text-sm font-semibold">Portfolio Insights</h3>
      <p className="text-xs text-muted-foreground">
        Deep analysis of your portfolio composition and performance.
      </p>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="p-2 rounded-md bg-muted/50">
          <div className="text-xs text-muted-foreground">Diversification</div>
          <div className="text-sm font-semibold mt-1">Good</div>
        </div>
        <div className="p-2 rounded-md bg-muted/50">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="text-sm font-semibold mt-1">Optimal</div>
        </div>
      </div>
    </div>
  );
}

function AICoach() {
  return (
    <div className="space-y-3" data-testid="content-coach">
      <h3 className="text-sm font-semibold">AI Trading Coach</h3>
      <p className="text-xs text-muted-foreground">
        Personalized guidance based on your trading patterns and goals.
      </p>
      <div className="space-y-2 pt-2">
        <div className="text-xs p-2 rounded-md bg-primary/10 border border-primary/20">
          <div className="font-medium mb-1">💡 Suggestion</div>
          <div className="text-muted-foreground">
            Consider taking profits on BTC position. You're up 12.5% and approaching resistance.
          </div>
        </div>
      </div>
    </div>
  );
}

interface TradeOpportunity {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  confidence: number;
  targetPrice: number;
  currentPrice: number;
  expectedGain: number;
  reasoning: string;
  basedOn: string[];
  createdAt: string;
}

function PredictiveAnalysis({ onTradeAction }: { onTradeAction?: (symbol: string, side: 'buy' | 'sell', quantity: number) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: opportunities, isLoading, refetch } = useQuery<TradeOpportunity[]>({
    queryKey: ['/api/ai/suggestions/active', user?.id],
    enabled: !!user?.id,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/ai/suggestions/generate`, 'POST', { userId: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/suggestions/active', user?.id] });
      toast({
        title: "New Opportunities Generated",
        description: "AI analyzed your trading patterns and found new opportunities",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return await apiRequest(`/api/ai/suggestions/${suggestionId}/execute`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/suggestions/active', user?.id] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return await apiRequest(`/api/ai/suggestions/${suggestionId}/dismiss`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/suggestions/active', user?.id] });
      toast({
        title: "Opportunity Dismissed",
        description: "This suggestion has been removed",
      });
    },
  });

  const handleAccept = (opp: TradeOpportunity) => {
    executeMutation.mutate(opp.id);
    if (onTradeAction) {
      const quantity = 0.01;
      onTradeAction(opp.symbol, opp.side, quantity);
    }
    toast({
      title: "Trade Accepted",
      description: `Opening trade modal for ${opp.symbol}`,
    });
  };

  const handleReject = (opp: TradeOpportunity) => {
    dismissMutation.mutate(opp.id);
  };

  return (
    <div className="space-y-3" data-testid="content-predict">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">AI Trading Opportunities</h3>
          <p className="text-xs text-muted-foreground">
            Based on your behavior, mistakes, and trading patterns
          </p>
        </div>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-opportunities"
        >
          <RefreshCw className={`h-3 w-3 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-xs text-muted-foreground mt-2">Analyzing your patterns...</p>
        </div>
      ) : opportunities && opportunities.length > 0 ? (
        <div className="space-y-2 pt-2">
          {opportunities.map((opp) => (
            <div 
              key={opp.id}
              className="text-xs p-3 rounded-lg border border-border bg-card"
              data-testid={`opportunity-${opp.symbol.toLowerCase()}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{opp.symbol}</span>
                  <Badge 
                    variant={opp.side === 'buy' ? 'default' : 'destructive'}
                    className="text-[10px] flex items-center gap-1"
                  >
                    {opp.side === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {opp.side?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {opp.confidence}% confidence
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Target:</span>
                  <span className="font-medium text-foreground">${opp.targetPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expected Gain:</span>
                  <span className="font-medium text-chart-2">+{opp.expectedGain}%</span>
                </div>
              </div>

              <p className="text-muted-foreground mb-2 leading-relaxed">
                {opp.reasoning}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {opp.basedOn.map((reason, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[9px]">
                    {reason}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleAccept(opp)}
                  disabled={executeMutation.isPending}
                  data-testid={`button-accept-${opp.symbol.toLowerCase()}`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleReject(opp)}
                  disabled={dismissMutation.isPending}
                  data-testid={`button-reject-${opp.symbol.toLowerCase()}`}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">
            No opportunities found yet
          </p>
          <Button
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-first"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Generate Opportunities
          </Button>
        </div>
      )}
    </div>
  );
}

function CorrelationAnalysis() {
  return (
    <div className="space-y-3" data-testid="content-correlate">
      <h3 className="text-sm font-semibold">Asset Correlations</h3>
      <p className="text-xs text-muted-foreground">
        Identify correlated assets to optimize portfolio diversification.
      </p>
      <div className="space-y-2 pt-2">
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="flex justify-between items-center">
            <span>BTC - ETH</span>
            <span className="font-semibold text-chart-2">+0.87</span>
          </div>
        </div>
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="flex justify-between items-center">
            <span>SOL - ADA</span>
            <span className="font-semibold text-chart-2">+0.64</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VolatilityAnalysis() {
  return (
    <div className="space-y-3" data-testid="content-volatility">
      <h3 className="text-sm font-semibold">Volatility Monitor</h3>
      <p className="text-xs text-muted-foreground">
        Real-time volatility tracking across your portfolio assets.
      </p>
      <div className="space-y-2 pt-2">
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="flex justify-between items-center">
            <span>BTC</span>
            <Badge variant="secondary" className="text-[10px]">Low</Badge>
          </div>
          <div className="text-muted-foreground mt-1">IV: 45.2%</div>
        </div>
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="flex justify-between items-center">
            <span>ETH</span>
            <Badge variant="default" className="text-[10px] bg-yellow-500/20 text-yellow-600">Medium</Badge>
          </div>
          <div className="text-muted-foreground mt-1">IV: 58.7%</div>
        </div>
      </div>
    </div>
  );
}

function PositionSizing() {
  return (
    <div className="space-y-3" data-testid="content-sizing">
      <h3 className="text-sm font-semibold">Smart Position Sizing</h3>
      <p className="text-xs text-muted-foreground">
        AI-recommended position sizes based on risk tolerance and market conditions.
      </p>
      <div className="space-y-2 pt-2">
        <div className="text-xs p-2 rounded-md bg-muted/50">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium">Recommended Size</span>
            <span className="font-semibold">$2,500</span>
          </div>
          <div className="text-muted-foreground">Risk: 2% of portfolio</div>
        </div>
      </div>
    </div>
  );
}
