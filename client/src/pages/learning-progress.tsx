import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, Award, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function LearningProgress() {
  const { toast } = useToast();

  // Fetch learning progress summary
  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useQuery<any>({
    queryKey: ["/api/ai-learning/progress"],
  });

  // Fetch checkpoints
  const { data: checkpoints, isLoading: checkpointsLoading, refetch: refetchCheckpoints } = useQuery<any[]>({
    queryKey: ["/api/ai-learning/checkpoints"],
  });

  // Fetch DNA evolution
  const { data: dnaEvolution, isLoading: dnaLoading, refetch: refetchDNA } = useQuery<any>({
    queryKey: ["/api/ai-learning/dna/evolution"],
  });

  // Fetch milestones
  const { data: milestones, isLoading: milestonesLoading, refetch: refetchMilestones } = useQuery<any[]>({
    queryKey: ["/api/ai-learning/dna/milestones"],
  });

  const handleRefreshAll = () => {
    refetchProgress();
    refetchCheckpoints();
    refetchDNA();
    refetchMilestones();
  };

  const handleCreateCheckpoint = async () => {
    try {
      await apiRequest("/api/ai-learning/checkpoint", "POST", {
        modelVersion: "gpt-4o-mini"
      });
      
      // Invalidate all Phase B queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/ai-learning/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-learning/checkpoints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-learning/dna/evolution"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-learning/dna/milestones"] });
      
      toast({
        title: "Checkpoint Created",
        description: "Learning progress snapshot saved successfully",
      });
    } catch (error: any) {
      console.error("[Frontend] Checkpoint creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create checkpoint",
        variant: "destructive",
      });
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-5 h-5 text-success" />;
    if (trend === 'declining') return <TrendingDown className="w-5 h-5 text-danger" />;
    return <Minus className="w-5 h-5 text-secondary" />;
  };

  const getPersonalizationColor = (level: string) => {
    if (level === 'optimized') return 'bg-success text-white';
    if (level === 'personalizing') return 'bg-primary text-white';
    return 'bg-secondary text-white';
  };

  if (progressLoading || checkpointsLoading || dnaLoading || milestonesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-secondary">Loading AI learning progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <Brain className="w-8 h-8 text-primary" />
              AI Learning Progress
            </h1>
            <p className="text-secondary mt-2">Track how the AI is learning your trading style</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleRefreshAll}
              variant="outline"
              className="gap-2"
              data-testid="button-refresh-progress"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </Button>
            <Button 
              onClick={handleCreateCheckpoint}
              variant="outline"
              className="gap-2"
              data-testid="button-create-checkpoint"
            >
              <Award className="w-4 h-4" />
              Save Checkpoint
            </Button>
          </div>
        </div>

        {/* AI Accuracy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Accuracy</CardTitle>
              {getTrendIcon(progress?.accuracyTrend || 'stable')}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-semibold" data-testid="text-current-accuracy">
                {progress?.currentAccuracy || 0}%
              </div>
              <Progress value={progress?.currentAccuracy || 0} className="mt-3" />
              <p className="text-xs text-secondary mt-2">
                {progress?.accuracyTrend === 'improving' && 'Improving over time'}
                {progress?.accuracyTrend === 'declining' && 'Needs more data'}
                {progress?.accuracyTrend === 'stable' && 'Maintaining consistency'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Personalization Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge className={getPersonalizationColor(progress?.personalizationLevel || 'learning')} data-testid="badge-personalization-level">
                  {progress?.personalizationLevel || 'Learning'}
                </Badge>
              </div>
              <Progress value={progress?.dataCollectionProgress || 0} className="mt-3" />
              <p className="text-xs text-secondary mt-2">
                {Math.round(progress?.dataCollectionProgress || 0)}% data collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checkpoints</CardTitle>
              <Award className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-semibold" data-testid="text-checkpoint-count">
                {progress?.checkpointsCount || 0}
              </div>
              <p className="text-xs text-secondary mt-2">
                Learning snapshots saved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Learning Checkpoints Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Learning Checkpoints</CardTitle>
          </CardHeader>
          <CardContent>
            {checkpoints && checkpoints.length > 0 ? (
              <div className="space-y-4">
                {checkpoints.map((checkpoint: any, index: number) => (
                  <div 
                    key={checkpoint.id} 
                    className="border-l-2 border-primary pl-4 py-2"
                    data-testid={`checkpoint-${index}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Badge variant="outline" className="mb-2">
                          {checkpoint.checkpointType}
                        </Badge>
                        <p className="text-sm text-secondary">
                          {new Date(checkpoint.timestamp).toLocaleDateString()} at {new Date(checkpoint.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-mono font-semibold">
                          {checkpoint.overallAccuracy}%
                        </div>
                        {parseFloat(checkpoint.confidenceImprovement) > 0 ? (
                          <p className="text-xs text-success flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            +{checkpoint.confidenceImprovement}%
                          </p>
                        ) : parseFloat(checkpoint.confidenceImprovement) < 0 ? (
                          <p className="text-xs text-danger flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            {checkpoint.confidenceImprovement}%
                          </p>
                        ) : null}
                      </div>
                    </div>
                    
                    {checkpoint.keyLearnings && (
                      <div className="mt-2">
                        {(() => {
                          try {
                            const learnings = typeof checkpoint.keyLearnings === 'string' 
                              ? JSON.parse(checkpoint.keyLearnings) 
                              : checkpoint.keyLearnings;
                            return learnings.map((learning: string, i: number) => (
                              <p key={i} className="text-sm text-secondary">• {learning}</p>
                            ));
                          } catch {
                            return <p className="text-sm text-secondary">• {checkpoint.keyLearnings}</p>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No checkpoints yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  As you use AI features, the system will learn your trading style and save progress snapshots
                </p>
                <Button 
                  onClick={handleRefreshAll}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-refresh-checkpoints"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DNA Evolution Chart */}
        {dnaEvolution && dnaEvolution.dates && dnaEvolution.dates.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Trading DNA Evolution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Win Rate Trend</span>
                    <span className="text-sm text-secondary">
                      {dnaEvolution.winRates[dnaEvolution.winRates.length - 1]}%
                    </span>
                  </div>
                  <div className="flex gap-1 h-16 items-end">
                    {dnaEvolution.winRates.map((rate: number, i: number) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t transition-all ${
                          rate >= 60 ? 'bg-success' : rate >= 40 ? 'bg-primary' : 'bg-danger'
                        }`}
                        style={{ height: `${rate}%` }}
                        title={`${dnaEvolution.dates[i]}: ${rate}%`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Risk Score Trend</span>
                    <span className="text-sm text-secondary">
                      {dnaEvolution.riskScores[dnaEvolution.riskScores.length - 1]}
                    </span>
                  </div>
                  <div className="flex gap-1 h-16 items-end">
                    {dnaEvolution.riskScores.map((score: number, i: number) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t transition-all ${
                          score <= 30 ? 'bg-success' : score <= 60 ? 'bg-primary' : 'bg-danger'
                        }`}
                        style={{ height: `${score}%` }}
                        title={`${dnaEvolution.dates[i]}: ${score}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {milestones && milestones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Achievements & Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {milestones.slice(0, 6).map((milestone: any, index: number) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated"
                    data-testid={`milestone-${index}`}
                  >
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{milestone.milestone}</p>
                      <p className="text-xs text-secondary">
                        {new Date(milestone.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
