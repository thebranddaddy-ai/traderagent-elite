import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sunrise, Sun, Moon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";

interface InsightCardProps {
  insightType: "morning" | "midday" | "evening";
  title: string;
  summary: string;
  insights: string[];
  recommendations: string[];
  emotionScore: number;
  timestamp: Date;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function InsightCard({
  insightType,
  title,
  summary,
  insights,
  recommendations,
  emotionScore,
  timestamp,
  onRefresh,
  isLoading
}: InsightCardProps) {
  const getInsightIcon = () => {
    switch (insightType) {
      case "morning":
        return <Sunrise className="w-5 h-5 text-primary" data-testid="icon-morning" />;
      case "midday":
        return <Sun className="w-5 h-5 text-amber-500" data-testid="icon-midday" />;
      case "evening":
        return <Moon className="w-5 h-5 text-indigo-500" data-testid="icon-evening" />;
    }
  };

  const getEmotionIndicator = () => {
    if (emotionScore >= 60) {
      return { icon: <TrendingUp className="w-4 h-4" />, color: "text-danger", label: "Greed" };
    } else if (emotionScore <= 40) {
      return { icon: <TrendingDown className="w-4 h-4" />, color: "text-primary", label: "Fear" };
    } else {
      return { icon: <Minus className="w-4 h-4" />, color: "text-muted-foreground", label: "Neutral" };
    }
  };

  const emotion = getEmotionIndicator();

  return (
    <Card className="h-full" data-testid={`card-insight-${insightType}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex items-center gap-3">
          {getInsightIcon()}
          <div>
            <CardTitle className="text-lg font-semibold" data-testid="text-insight-title">
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground" data-testid="text-insight-time">
              {format(new Date(timestamp), "h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={emotion.color} data-testid="badge-emotion">
            {emotion.icon}
            <span className="ml-1 text-xs">{emotion.label}</span>
          </Badge>
          {onRefresh && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="button-refresh-insight"
            >
              {isLoading ? "..." : "Refresh"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-base text-foreground mb-4" data-testid="text-insight-summary">
            {summary}
          </p>
        </div>

        {insights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Key Insights</h4>
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li
                  key={idx}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                  data-testid={`text-insight-${idx}`}
                >
                  <span className="text-primary mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Recommendations</h4>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-muted/50 p-3 rounded text-sm text-foreground"
                  data-testid={`text-recommendation-${idx}`}
                >
                  <span className="font-medium text-primary">{idx + 1}.</span> {rec}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
