import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/InsightCard";
import { PeaceIndexWidget } from "@/components/PeaceIndexWidget";
import { RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyInsightsSectionProps {
  userId: string;
}

interface TodayInsightsResponse {
  morning?: {
    id: string;
    userId: string;
    insightType: string;
    title: string;
    summary: string;
    insights: string[];
    recommendations: string[];
    peaceIndex: number;
    emotionScore: number;
    timestamp: string;
  };
  midday?: {
    id: string;
    userId: string;
    insightType: string;
    title: string;
    summary: string;
    insights: string[];
    recommendations: string[];
    peaceIndex: number;
    emotionScore: number;
    timestamp: string;
  };
  evening?: {
    id: string;
    userId: string;
    insightType: string;
    title: string;
    summary: string;
    insights: string[];
    recommendations: string[];
    peaceIndex: number;
    emotionScore: number;
    timestamp: string;
  };
  currentPeaceIndex: number;
}

export function DailyInsightsSection({ userId }: DailyInsightsSectionProps) {
  const { toast } = useToast();

  // Fetch today's insights
  const { data: todayData, isLoading } = useQuery<TodayInsightsResponse>({
    queryKey: ["/api/ai/insights/today", userId],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Generate new insight mutation
  const generateInsight = useMutation({
    mutationFn: () => apiRequest("/api/ai/insights/generate", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights/today", userId] });
      toast({
        title: "Insight Generated",
        description: "Your personalized daily insight is ready",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate insight",
        variant: "destructive",
      });
    },
  });

  const handleGenerateInsight = () => {
    generateInsight.mutate();
  };

  if (isLoading) {
    return (
      <div className="text-center py-8" data-testid="loading-insights">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading daily insights...</p>
      </div>
    );
  }

  const hasAnyInsight = todayData?.morning || todayData?.midday || todayData?.evening;

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Daily Insights Loop</h3>
            <p className="text-sm text-muted-foreground">Your personalized trading companion</p>
          </div>
        </div>
        <Button
          onClick={handleGenerateInsight}
          disabled={generateInsight.isPending}
          variant="outline"
          data-testid="button-generate-insight"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${generateInsight.isPending ? "animate-spin" : ""}`} />
          {generateInsight.isPending ? "Generating..." : "Generate Insight"}
        </Button>
      </div>

      {/* Peace Index Widget */}
      <PeaceIndexWidget peaceIndex={todayData?.currentPeaceIndex || 50} />

      {/* Insights Grid */}
      {hasAnyInsight ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {todayData?.morning && (
            <InsightCard
              insightType="morning"
              title={todayData.morning.title}
              summary={todayData.morning.summary}
              insights={todayData.morning.insights}
              recommendations={todayData.morning.recommendations}
              emotionScore={todayData.morning.emotionScore}
              timestamp={new Date(todayData.morning.timestamp)}
              onRefresh={handleGenerateInsight}
              isLoading={generateInsight.isPending}
            />
          )}
          {todayData?.midday && (
            <InsightCard
              insightType="midday"
              title={todayData.midday.title}
              summary={todayData.midday.summary}
              insights={todayData.midday.insights}
              recommendations={todayData.midday.recommendations}
              emotionScore={todayData.midday.emotionScore}
              timestamp={new Date(todayData.midday.timestamp)}
              onRefresh={handleGenerateInsight}
              isLoading={generateInsight.isPending}
            />
          )}
          {todayData?.evening && (
            <InsightCard
              insightType="evening"
              title={todayData.evening.title}
              summary={todayData.evening.summary}
              insights={todayData.evening.insights}
              recommendations={todayData.evening.recommendations}
              emotionScore={todayData.evening.emotionScore}
              timestamp={new Date(todayData.evening.timestamp)}
              onRefresh={handleGenerateInsight}
              isLoading={generateInsight.isPending}
            />
          )}
        </div>
      ) : (
        <div
          className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border"
          data-testid="empty-insights"
        >
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Insights Yet Today</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Generate your first daily insight to track your trading peace index
          </p>
          <Button onClick={handleGenerateInsight} disabled={generateInsight.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${generateInsight.isPending ? "animate-spin" : ""}`} />
            {generateInsight.isPending ? "Generating..." : "Generate Daily Insight"}
          </Button>
        </div>
      )}
    </div>
  );
}
