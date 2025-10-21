import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Shield, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentHealth {
  readinessLevel: string;
  readinessScore: string;
  confidenceScore: string;
  totalExamples: number;
}

export function AgentConfidenceBadge({ showLevel = true, size = "default" }: { showLevel?: boolean; size?: "sm" | "default" }) {
  const { data: health, isLoading } = useQuery<AgentHealth>({
    queryKey: ['/api/ai/agent-health'],
  });

  if (isLoading) {
    return <Skeleton className={size === "sm" ? "h-5 w-20" : "h-6 w-24"} />;
  }

  if (!health) return null;

  const confidenceScore = parseFloat(health.confidenceScore || '0');
  const readinessLevel = health.readinessLevel || 'learning';

  const getLevelIcon = () => {
    switch (readinessLevel) {
      case 'expert': return <Sparkles className="w-3 h-3" />;
      case 'ready': return <Shield className="w-3 h-3" />;
      case 'training': return <TrendingUp className="w-3 h-3" />;
      default: return <Brain className="w-3 h-3" />;
    }
  };

  const getLevelColor = () => {
    switch (readinessLevel) {
      case 'expert': return 'default';
      case 'ready': return 'secondary';
      case 'training': return 'outline';
      default: return 'outline';
    }
  };

  const getConfidenceColor = () => {
    if (confidenceScore >= 80) return "text-green-600";
    if (confidenceScore >= 60) return "text-blue-600";
    if (confidenceScore >= 40) return "text-yellow-600";
    return "text-gray-600";
  };

  const getLevelLabel = () => {
    switch (readinessLevel) {
      case 'expert': return 'Expert';
      case 'ready': return 'Ready';
      case 'training': return 'Training';
      default: return 'Learning';
    }
  };

  if (!showLevel) {
    return (
      <Badge 
        variant="outline" 
        className={`gap-1.5 ${size === "sm" ? "text-xs" : ""}`}
        data-testid="badge-agent-confidence"
      >
        <Brain className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span className={getConfidenceColor()}>{Math.round(confidenceScore)}%</span>
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="agent-confidence-display">
      <Badge 
        variant={getLevelColor() as any}
        className={`gap-1.5 ${size === "sm" ? "text-xs" : ""}`}
        data-testid="badge-agent-level"
      >
        {getLevelIcon()}
        {getLevelLabel()}
      </Badge>
      <Badge 
        variant="outline"
        className={`gap-1.5 ${size === "sm" ? "text-xs" : ""}`}
        data-testid="badge-confidence-score"
      >
        <span className={getConfidenceColor()}>{Math.round(confidenceScore)}%</span>
      </Badge>
    </div>
  );
}
