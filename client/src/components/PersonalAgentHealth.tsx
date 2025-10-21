import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Shield, Sparkles } from "lucide-react";

interface AgentHealth {
  readinessLevel: string;
  readinessScore: string;
  confidenceScore: string;
  totalExamples: number;
  positiveExamples: number;
  negativeExamples: number;
  userId: string;
}

export function PersonalAgentHealth() {
  const { data: health, isLoading } = useQuery<AgentHealth>({
    queryKey: ['/api/ai/agent-health'],
  });

  if (isLoading) {
    return (
      <Card className="max-h-[300px] overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Personal AI Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const readinessLevel = health?.readinessLevel || 'learning';
  const readinessScore = parseFloat(health?.readinessScore || '0');
  const confidenceScore = parseFloat(health?.confidenceScore || '0');
  const totalExamples = health?.totalExamples || 0;
  const positiveExamples = health?.positiveExamples || 0;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'text-chart-2';
      case 'ready': return 'text-blue-500';
      case 'training': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const getLevelBadgeVariant = (level: string): "default" | "secondary" | "outline" => {
    switch (level) {
      case 'expert': return 'default';
      case 'ready': return 'secondary';
      default: return 'outline';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'expert': return <Sparkles className="w-3 h-3" />;
      case 'ready': return <Shield className="w-3 h-3" />;
      case 'training': return <TrendingUp className="w-3 h-3" />;
      default: return <Brain className="w-3 h-3" />;
    }
  };

  const getLevelDescription = (level: string) => {
    switch (level) {
      case 'expert': return 'Highly trained - expert guidance ready';
      case 'ready': return 'Trained and ready to assist';
      case 'training': return 'Learning from your feedback';
      default: return 'Early learning - provide more feedback';
    }
  };

  return (
    <Card className="max-h-[300px] overflow-hidden" data-testid="card-agent-health">
      <CardHeader className="pb-2 px-4 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" />
          Personal AI Agent
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-4 pb-3 h-[calc(100%-52px)] overflow-y-auto card-scroll">
        <div className="space-y-3">
          {/* Status Badge & Description */}
          <div className="flex items-center justify-between gap-2">
            <Badge variant={getLevelBadgeVariant(readinessLevel)} className="flex items-center gap-1 text-xs" data-testid="badge-readiness-level">
              {getLevelIcon(readinessLevel)}
              {readinessLevel}
            </Badge>
            <p className="text-xs text-muted-foreground">{getLevelDescription(readinessLevel)}</p>
          </div>

          {/* Agent Readiness */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Agent Readiness</span>
              <span className={getLevelColor(readinessLevel)} data-testid="text-readiness-score">
                {readinessScore.toFixed(0)}%
              </span>
            </div>
            <Progress value={readinessScore} className="h-1.5" data-testid="progress-readiness" />
          </div>

          {/* Confidence Level */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Confidence Level</span>
              <span className="text-primary" data-testid="text-confidence-score">
                {confidenceScore.toFixed(0)}%
              </span>
            </div>
            <Progress value={confidenceScore} className="h-1.5" data-testid="progress-confidence" />
            <p className="text-[11px] text-muted-foreground">
              {positiveExamples} positive / {totalExamples} total feedback
            </p>
          </div>

          {/* Learning Stats */}
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <div className="text-xl font-bold font-mono" data-testid="text-total-examples">{totalExamples}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Training Examples</div>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <div className="text-xl font-bold font-mono text-chart-2" data-testid="text-positive-examples">
                {positiveExamples}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Helpful Insights</div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-0.5 border-t border-border pt-2">
            <Shield className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
            <p className="leading-snug">
              Private by default. Learns only from your actions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
