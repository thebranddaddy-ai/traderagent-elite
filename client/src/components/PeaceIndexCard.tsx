import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PeaceIndexData {
  score: number;
  stressLevel: number;
  tradeFrequency: number;
  lossStreak: number;
  winStreak: number;
  dailyPnL: string;
  insights?: {
    message: string;
    recommendation: string;
  };
  recommendsFocus: boolean;
  recommendsBreak: boolean;
}

export function PeaceIndexCard({ userId }: { userId: string }) {
  const { data: peaceData, isLoading } = useQuery<PeaceIndexData>({
    queryKey: [`/api/peace/index/${userId}`],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-peace-index" className="h-[160px] overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-3.5 w-3.5" />
              Peace Index
            </div>
            <span className="text-sm font-mono">--</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-0 pb-3">
          <div className="animate-pulse">
            <div className="h-12 bg-muted rounded mb-3"></div>
            <div className="h-2 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const peaceScore = peaceData?.score ?? 50;
  const stressLevel = peaceData?.stressLevel ?? 0;
  
  const getPeaceMessage = (score: number) => {
    if (score >= 80) return "All systems calm.";
    if (score >= 60) return "Your balance feels stable.";
    if (score >= 40) return "Consider a moment of reflection.";
    return "Peace mode recommended.";
  };

  const getEncouragementMessage = (score: number, stress: number) => {
    if (score >= 80 && stress < 30) {
      return {
        title: "You're trading with clarity and control.",
        subtitle: "Keep this rhythm. Your disciplined approach is working."
      };
    }
    if (score >= 60) {
      return {
        title: "You're maintaining good balance.",
        subtitle: "Stay focused. Your patience is showing results."
      };
    }
    if (score >= 40) {
      return {
        title: "Take a moment to recenter.",
        subtitle: "A brief pause can sharpen your edge."
      };
    }
    return {
      title: "Consider stepping back.",
      subtitle: "Your best trades come from a calm mind."
    };
  };

  const encouragement = getEncouragementMessage(peaceScore, stressLevel);

  return (
    <Card data-testid="card-peace-index" className="h-[160px] overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Heart className="h-3.5 w-3.5" />
            Peace Index
          </div>
          <span className="text-sm font-mono" data-testid="text-stress-level">{stressLevel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* Large Peace Score Display */}
        <div className="text-center -mt-1">
          <div className="text-3xl font-mono font-bold leading-none" data-testid="text-peace-score">
            {peaceScore}/100
          </div>
        </div>

        {/* Progress Bar */}
        <Progress 
          value={peaceScore} 
          className="h-1.5"
          data-testid="progress-peace-score"
        />

        {/* Status Message */}
        <p className="text-xs text-center text-muted-foreground leading-tight">
          {getPeaceMessage(peaceScore)}
        </p>

        {/* Encouragement Card */}
        <div className="bg-accent/50 border border-border/50 rounded-md p-2">
          <p className="text-xs font-medium text-foreground leading-snug">
            {encouragement.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {encouragement.subtitle}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
