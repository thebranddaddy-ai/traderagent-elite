import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Check, X, Pin, Shield, Zap, Scale, Sparkles } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface TradingDNAProfile {
  classification: "Aggressive" | "Balanced" | "Defensive";
  confidence: number;
  characteristics: string[];
  tradingMetrics: {
    winRate: number;
    totalTrades: number;
    riskScore: number;
  };
}

interface AdaptiveSuggestion {
  id: string;
  title: string;
  message: string;
  reasoning: string;
  confidence: string;
  priority: "high" | "medium" | "low";
  suggestionType: string;
  actionType: string;
  actionData: Record<string, any>;
  status: string;
  isPinned: boolean;
}

export function AdaptiveInsightsPanel() {
  const { toast } = useToast();

  // Fetch Trading DNA profile
  const { data: profile, isLoading: profileLoading } = useQuery<TradingDNAProfile>({
    queryKey: ["/api/trading-dna/profile"],
    refetchOnWindowFocus: false,
  });

  // Fetch active suggestions
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<AdaptiveSuggestion[]>({
    queryKey: ["/api/suggestions"],
    refetchOnWindowFocus: false,
  });

  // Generate suggestions mutation
  const generateMutation = useMutation({
    mutationFn: () => apiRequest("/api/suggestions/generate", "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({
        title: "Insights generated",
        description: "Your personalized suggestions are ready.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error generating insights",
        description: error.message,
      });
    },
  });

  // Respond to suggestion mutation
  const respondMutation = useMutation({
    mutationFn: ({ id, responseType, feedback }: { id: string; responseType: string; feedback?: string }) =>
      apiRequest(`/api/suggestions/${id}/respond`, "POST", { responseType, feedback }),
    onSuccess: (_, variables) => {
      // Invalidate suggestions
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      
      // If accepted, invalidate layout to reflect changes
      if (variables.responseType === "accept") {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/layout"] });
      }
      
      const actionMessages = {
        accept: "Suggestion applied successfully",
        dismiss: "Suggestion dismissed",
        pin: "Suggestion pinned for later",
      };
      
      toast({
        title: actionMessages[variables.responseType as keyof typeof actionMessages],
        description: variables.responseType === "accept" ? "Your dashboard has been updated." : undefined,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error responding to suggestion",
        description: error.message,
      });
    },
  });

  const handleRespond = (suggestionId: string, responseType: "accept" | "dismiss" | "pin") => {
    respondMutation.mutate({ id: suggestionId, responseType });
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case "Aggressive":
        return <Zap className="w-4 h-4" />;
      case "Defensive":
        return <Shield className="w-4 h-4" />;
      case "Balanced":
        return <Scale className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Aggressive":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "Defensive":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Balanced":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-primary";
      case "medium":
        return "border-border";
      case "low":
        return "border-border/50";
      default:
        return "border-border";
    }
  };

  if (profileLoading || suggestionsLoading) {
    return (
      <Card data-testid="card-adaptive-insights" className="animate-pulse">
        <CardHeader>
          <CardTitle>Adaptive Insights</CardTitle>
          <CardDescription>Loading your personalized insights...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="card-adaptive-insights" className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Adaptive Insights
            </CardTitle>
            <CardDescription>
              Personalized suggestions based on your trading DNA
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-insights"
            className="hover-elevate active-elevate-2"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trading DNA Section */}
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
            data-testid="section-trading-dna"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Your Trading DNA</h3>
              <Badge 
                variant="outline" 
                className={`${getClassificationColor(profile.classification)} flex items-center gap-1`}
                data-testid={`badge-dna-${profile.classification.toLowerCase()}`}
              >
                {getClassificationIcon(profile.classification)}
                {profile.classification}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium" data-testid="text-dna-confidence">
                  {Math.round(profile.confidence)}%
                </span>
              </div>
              <Progress value={profile.confidence} className="h-2" />
            </div>

            {profile.characteristics.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Key Characteristics:</p>
                <ul className="space-y-1">
                  {profile.characteristics.slice(0, 3).map((char, index) => (
                    <li 
                      key={index} 
                      className="text-sm flex items-start gap-2"
                      data-testid={`text-characteristic-${index}`}
                    >
                      <span className="text-primary mt-0.5">•</span>
                      <span>{char}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {profile && suggestions && suggestions.length > 0 && <Separator />}

        {/* Suggestions Section */}
        {suggestions && suggestions.length > 0 ? (
          <div className="space-y-3" data-testid="section-suggestions">
            <h3 className="text-sm font-medium">Personalized Suggestions</h3>
            
            <AnimatePresence mode="popLayout">
              {suggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  data-testid={`card-suggestion-${index}`}
                >
                  <Card className={`border-l-4 ${getPriorityColor(suggestion.priority)} hover-elevate transition-all duration-300`}>
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <CardTitle className="text-base" data-testid={`text-suggestion-title-${index}`}>
                            {suggestion.title}
                          </CardTitle>
                          <CardDescription className="text-sm" data-testid={`text-suggestion-message-${index}`}>
                            {suggestion.message}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {suggestion.isPinned && (
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
                              data-testid={`badge-pinned-${index}`}
                            >
                              <Pin className="w-3 h-3 mr-1" />
                              Pinned
                            </Badge>
                          )}
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            data-testid={`badge-confidence-${index}`}
                          >
                            {Math.round(parseFloat(suggestion.confidence))}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4 pt-0 space-y-3">
                      {/* Reasoning (Explainability) */}
                      <details className="group">
                        <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-2">
                          <span className="group-open:rotate-90 transition-transform">▶</span>
                          Why this suggestion?
                        </summary>
                        <p className="text-sm mt-2 pl-5 text-muted-foreground" data-testid={`text-reasoning-${index}`}>
                          {suggestion.reasoning}
                        </p>
                      </details>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleRespond(suggestion.id, "accept")}
                          disabled={respondMutation.isPending}
                          className="flex-1"
                          data-testid={`button-accept-${index}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespond(suggestion.id, "pin")}
                          disabled={respondMutation.isPending || suggestion.isPinned}
                          data-testid={`button-pin-${index}`}
                          className="hover-elevate"
                        >
                          <Pin className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespond(suggestion.id, "dismiss")}
                          disabled={respondMutation.isPending}
                          data-testid={`button-dismiss-${index}`}
                          className="hover-elevate"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          suggestions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
              data-testid="text-no-suggestions"
            >
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No suggestions yet</p>
              <p className="text-xs mt-1">
                Keep trading to build your DNA profile
              </p>
            </motion.div>
          )
        )}
      </CardContent>
    </Card>
  );
}
