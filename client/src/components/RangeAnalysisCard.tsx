import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { format } from "date-fns";

interface Mistake {
  type: string;
  count: number;
  description: string;
  tradeIds: string[];
}

interface Suggestion {
  category: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
}

interface AnalysisResult {
  runId: string;
  summary: string;
  mistakes: Mistake[];
  suggestions: Suggestion[];
  strengths: string[];
  weaknesses: string[];
  tokenUsage: number;
}

interface RangeAnalysisCardProps {
  result: AnalysisResult | null;
  dateFrom?: Date;
  dateTo?: Date;
}

export function RangeAnalysisCard({ result, dateFrom, dateTo }: RangeAnalysisCardProps) {
  if (!result) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card data-testid="card-analysis-result">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Analysis
          </CardTitle>
          {dateFrom && dateTo && (
            <Badge variant="outline" data-testid="badge-date-range">
              {format(dateFrom, "MMM d")} - {format(dateTo, "MMM d, yyyy")}
            </Badge>
          )}
        </div>
        <CardDescription data-testid="text-summary">
          {result.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strengths */}
        {result.strengths.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Strengths
            </h3>
            <ScrollArea className="h-auto max-h-32">
              <ul className="space-y-1">
                {result.strengths.map((strength, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-muted-foreground"
                    data-testid={`text-strength-${idx}`}
                  >
                    • {strength}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Mistakes */}
        {result.mistakes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Patterns to Improve
            </h3>
            <ScrollArea className="h-auto max-h-48">
              <div className="space-y-2">
                {result.mistakes.map((mistake, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-md bg-muted/50"
                    data-testid={`card-mistake-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{mistake.type}</p>
                      <Badge variant="secondary" className="text-xs">
                        {mistake.count}x
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mistake.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              AI Recommendations
            </h3>
            <ScrollArea className="h-auto max-h-48">
              <div className="space-y-2">
                {result.suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-md bg-muted/50"
                    data-testid={`card-suggestion-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-3 w-3" />
                        <p className="text-sm font-medium">{suggestion.category}</p>
                      </div>
                      <Badge variant={getPriorityColor(suggestion.priority) as any} className="text-xs">
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer meta */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          Analysis Run ID: {result.runId.slice(0, 8)}... • {result.tokenUsage} tokens used
        </div>
      </CardContent>
    </Card>
  );
}
