import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThumbsUp, ThumbsDown, Brain, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MistakePrediction {
  id: string;
  riskScore: number;
  recommendation: 'approve' | 'reject' | 'modify';
  reasoning: string;
  aiAnalysis: {
    patternMatches?: string[];
    riskFactors?: string[];
    suggestions?: string[];
  };
}

interface AIAgentHealth {
  totalExamples: number;
  positiveExamples: number;
  negativeExamples: number;
  confidenceScore: string;
  readinessScore: string;
  readinessLevel: 'learning' | 'training' | 'ready' | 'expert';
}

export default function AICoach() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [symbol, setSymbol] = useState('BTC');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('0.5');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [prediction, setPrediction] = useState<MistakePrediction | null>(null);

  const { data: agentHealth } = useQuery<AIAgentHealth>({
    queryKey: ['/api/ai/agent-health'],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      const response = await apiRequest('/api/mistake-prediction/analyze', 'POST', tradeData);
      return response.json();
    },
    onSuccess: (data: MistakePrediction) => {
      setPrediction(data);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze trade",
        variant: "destructive",
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ feedbackType, userAction }: { feedbackType: string; userAction: string }) => {
      if (!prediction) return;
      
      const response = await apiRequest('/api/ai/feedback', 'POST', {
        contextType: 'mistake_prediction',
        contextData: {
          symbol,
          side,
          quantity,
          orderType,
          predictionId: prediction.id,
        },
        aiOutput: {
          riskScore: prediction.riskScore,
          recommendation: prediction.recommendation,
          reasoning: prediction.reasoning,
        },
        aiReasoning: prediction.reasoning,
        feedbackType,
        userAction,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Recorded",
        description: "Your AI agent is learning from your preferences",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/agent-health'] });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate({
      symbol,
      side,
      quantity: parseFloat(quantity),
      orderType,
    });
  };

  const handleFeedback = (type: 'thumbs_up' | 'thumbs_down') => {
    const userAction = type === 'thumbs_up' ? 'accepted' : 'rejected';
    feedbackMutation.mutate({ feedbackType: type, userAction });
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'approve': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'reject': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <TrendingUp className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getReadinessColor = (level: string) => {
    switch (level) {
      case 'expert': return 'text-purple-500';
      case 'ready': return 'text-green-500';
      case 'training': return 'text-yellow-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">AI Coach & Mistake Prediction</h1>
          <p className="text-muted-foreground">Get personalized trade analysis powered by your AI agent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade Analysis Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Analyze Trade</CardTitle>
            <CardDescription>Enter trade details to get AI-powered risk analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="BTC"
                  data-testid="input-symbol"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="side">Side</Label>
                <Select value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
                  <SelectTrigger id="side" data-testid="select-side">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderType">Order Type</Label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
                  <SelectTrigger id="orderType" data-testid="select-order-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              className="w-full"
              data-testid="button-analyze-trade"
            >
              {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Trade'}
            </Button>
          </CardFooter>
        </Card>

        {/* Agent Health */}
        <Card>
          <CardHeader>
            <CardTitle>Personal AI Agent</CardTitle>
            <CardDescription>Learning progress & readiness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Readiness Level</span>
                <span className={`text-sm font-semibold uppercase ${getReadinessColor(agentHealth?.readinessLevel || 'learning')}`}>
                  {agentHealth?.readinessLevel || 'learning'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Confidence</span>
                <span className="text-sm font-semibold">{agentHealth?.confidenceScore || '0'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Examples</span>
                <span className="text-sm font-semibold">{agentHealth?.totalExamples || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Positive Feedback</span>
                <span className="text-sm font-semibold text-green-500">{agentHealth?.positiveExamples || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Negative Feedback</span>
                <span className="text-sm font-semibold text-red-500">{agentHealth?.negativeExamples || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prediction Results */}
      {prediction && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getRecommendationIcon(prediction.recommendation)}
                <CardTitle>AI Analysis Result</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Risk Score:</span>
                <span className={`text-2xl font-bold ${getRiskColor(prediction.riskScore)}`}>
                  {prediction.riskScore}/100
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Recommendation: {prediction.recommendation.toUpperCase()}</h3>
              <p className="text-muted-foreground">{prediction.reasoning}</p>
            </div>
            
            {prediction.aiAnalysis?.riskFactors && prediction.aiAnalysis.riskFactors.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Risk Factors:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {prediction.aiAnalysis.riskFactors.map((factor, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {prediction.aiAnalysis?.suggestions && prediction.aiAnalysis.suggestions.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Suggestions:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {prediction.aiAnalysis.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFeedback('thumbs_up')}
              disabled={feedbackMutation.isPending}
              data-testid="button-feedback-up"
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              Helpful
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFeedback('thumbs_down')}
              disabled={feedbackMutation.isPending}
              data-testid="button-feedback-down"
            >
              <ThumbsDown className="w-4 h-4 mr-2" />
              Not Helpful
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
