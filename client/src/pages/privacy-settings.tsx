import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, Share2, Bot, BarChart3, Sparkles, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type PrivacyPrefs = {
  shareTradeHistory?: boolean;
  sharePerformanceMetrics?: boolean;
  shareAIInteractions?: boolean;
  enableAISuggestions?: boolean;
  enableAIExitAdvisor?: boolean;
  enableAITradeAssistant?: boolean;
  enableDailyInsights?: boolean;
  enableAnalytics?: boolean;
  enablePersonalization?: boolean;
  viewAuditLogs?: boolean;
};

export default function PrivacySettings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const { data: preferences, isLoading } = useQuery<PrivacyPrefs>({
    queryKey: ['/api/privacy/preferences'],
  });

  const [localPrefs, setLocalPrefs] = useState<PrivacyPrefs>(preferences || {});

  useEffect(() => {
    if (preferences && !hasChanges) {
      setLocalPrefs(preferences);
    }
  }, [preferences, hasChanges]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return await apiRequest('/api/privacy/preferences', 'PUT', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/preferences'] });
      toast({
        title: "Settings Saved",
        description: "Your privacy preferences have been updated.",
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    setLocalPrefs({ ...localPrefs, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(localPrefs);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-privacy-title">
          <Shield className="w-8 h-8" />
          Privacy & Control
        </h1>
        <p className="text-muted-foreground mt-2">
          Your data, your choice. Control what you share and which AI features you use.
        </p>
      </div>

      <Card data-testid="card-data-sharing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Data Sharing Controls
          </CardTitle>
          <CardDescription>
            Choose what data you want to share with the Global Ensemble learning system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-trades">Share Trade History</Label>
              <p className="text-sm text-muted-foreground">
                Help improve AI recommendations for all traders
              </p>
            </div>
            <Switch
              id="share-trades"
              checked={localPrefs.shareTradeHistory || false}
              onCheckedChange={(checked) => handleToggle('shareTradeHistory', checked)}
              data-testid="switch-share-trades"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-metrics">Share Performance Metrics</Label>
              <p className="text-sm text-muted-foreground">
                Anonymous trading DNA and performance data
              </p>
            </div>
            <Switch
              id="share-metrics"
              checked={localPrefs.sharePerformanceMetrics || false}
              onCheckedChange={(checked) => handleToggle('sharePerformanceMetrics', checked)}
              data-testid="switch-share-metrics"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-ai">Share AI Interactions</Label>
              <p className="text-sm text-muted-foreground">
                Help train AI models with your queries and feedback
              </p>
            </div>
            <Switch
              id="share-ai"
              checked={localPrefs.shareAIInteractions || false}
              onCheckedChange={(checked) => handleToggle('shareAIInteractions', checked)}
              data-testid="switch-share-ai"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-ai-features">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Feature Controls
          </CardTitle>
          <CardDescription>
            Enable or disable specific AI features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-suggestions">AI Trade Suggestions</Label>
              <p className="text-sm text-muted-foreground">
                Get AI-powered trade recommendations
              </p>
            </div>
            <Switch
              id="ai-suggestions"
              checked={localPrefs.enableAISuggestions !== false}
              onCheckedChange={(checked) => handleToggle('enableAISuggestions', checked)}
              data-testid="switch-ai-suggestions"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-exit">AI Exit Advisor</Label>
              <p className="text-sm text-muted-foreground">
                Get logical exit recommendations for open positions
              </p>
            </div>
            <Switch
              id="ai-exit"
              checked={localPrefs.enableAIExitAdvisor !== false}
              onCheckedChange={(checked) => handleToggle('enableAIExitAdvisor', checked)}
              data-testid="switch-ai-exit"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-assistant">AI Trade Assistant</Label>
              <p className="text-sm text-muted-foreground">
                Real-time advice within the trade modal
              </p>
            </div>
            <Switch
              id="ai-assistant"
              checked={localPrefs.enableAITradeAssistant !== false}
              onCheckedChange={(checked) => handleToggle('enableAITradeAssistant', checked)}
              data-testid="switch-ai-assistant"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-insights">Daily AI Insights</Label>
              <p className="text-sm text-muted-foreground">
                Morning Brief, Midday Pulse, Evening Reflection
              </p>
            </div>
            <Switch
              id="ai-insights"
              checked={localPrefs.enableDailyInsights !== false}
              onCheckedChange={(checked) => handleToggle('enableDailyInsights', checked)}
              data-testid="switch-ai-insights"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-transparency">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Transparency & Analytics
          </CardTitle>
          <CardDescription>
            Control your experience and visibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics">Usage Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help us improve the platform
              </p>
            </div>
            <Switch
              id="analytics"
              checked={localPrefs.enableAnalytics !== false}
              onCheckedChange={(checked) => handleToggle('enableAnalytics', checked)}
              data-testid="switch-analytics"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="personalization">Personalization</Label>
              <p className="text-sm text-muted-foreground">
                Customize experience based on your behavior
              </p>
            </div>
            <Switch
              id="personalization"
              checked={localPrefs.enablePersonalization !== false}
              onCheckedChange={(checked) => handleToggle('enablePersonalization', checked)}
              data-testid="switch-personalization"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="audit-logs">View AI Audit Logs</Label>
              <p className="text-sm text-muted-foreground">
                See full transparency of all AI decisions
              </p>
            </div>
            <Switch
              id="audit-logs"
              checked={localPrefs.viewAuditLogs !== false}
              onCheckedChange={(checked) => handleToggle('viewAuditLogs', checked)}
              data-testid="switch-audit-logs"
            />
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="shadow-lg"
            data-testid="button-save-privacy"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
