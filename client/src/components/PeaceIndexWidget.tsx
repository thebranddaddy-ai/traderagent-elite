import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

interface PeaceIndexWidgetProps {
  peaceIndex: number;
  trend?: "up" | "down" | "stable";
}

export function PeaceIndexWidget({ peaceIndex, trend = "stable" }: PeaceIndexWidgetProps) {
  // Peace index: 0-100 (0 = stressed, 100 = calm)
  const getColor = () => {
    if (peaceIndex >= 70) return "text-success";
    if (peaceIndex >= 40) return "text-amber-500";
    return "text-danger";
  };

  const getGradient = () => {
    if (peaceIndex >= 70) return "from-success/20 to-success/5";
    if (peaceIndex >= 40) return "from-amber-500/20 to-amber-500/5";
    return "from-danger/20 to-danger/5";
  };

  const getLabel = () => {
    if (peaceIndex >= 70) return "Calm & Focused";
    if (peaceIndex >= 40) return "Moderate Stress";
    return "High Stress";
  };

  const getTrendIcon = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "→";
  };

  return (
    <Card data-testid="card-peace-index">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Peace Index</CardTitle>
        <Heart className={`w-5 h-5 ${getColor()}`} data-testid="icon-peace" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Large number display */}
          <div className="flex items-baseline gap-2">
            <div
              className={`text-4xl font-mono font-bold ${getColor()}`}
              data-testid="text-peace-score"
            >
              {peaceIndex}
            </div>
            <div className="text-base text-muted-foreground">/100</div>
            <div className="text-sm text-muted-foreground ml-auto" data-testid="badge-trend">
              {getTrendIcon()}
            </div>
          </div>

          {/* Visual gauge */}
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full overflow-hidden" data-testid="gauge-peace">
              <div
                className={`h-full bg-gradient-to-r ${getGradient()} transition-all duration-500`}
                style={{ width: `${peaceIndex}%` }}
              />
            </div>
            <p className={`text-sm font-medium ${getColor()}`} data-testid="text-peace-label">
              {getLabel()}
            </p>
          </div>

          {/* Interpretation */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            <p data-testid="text-peace-description">
              {peaceIndex >= 70 && "You're in a good mental state for trading. Stay disciplined."}
              {peaceIndex >= 40 && peaceIndex < 70 && "Some stress detected. Consider reviewing your risk settings."}
              {peaceIndex < 40 && "High stress levels. Take a break and avoid impulsive decisions."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
