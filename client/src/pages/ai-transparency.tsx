import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, Clock, RefreshCw, TrendingUp, TrendingDown, FileText, Zap, AlertCircle, ChevronDown, Copy, Check, ThumbsUp, Bell, Flag } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AITransparency() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const { data: allLogs, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/ai-audit/logs'],
  });

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Refreshed",
      description: "AI transparency data updated successfully.",
    });
  };

  const copyVerificationId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied",
      description: "Verification ID copied to clipboard.",
    });
  };

  const getConfidenceColor = (confidence: string | null): "default" | "secondary" | "destructive" => {
    if (!confidence) return "secondary";
    const conf = parseFloat(confidence);
    if (conf >= 75) return "default";
    if (conf >= 50) return "secondary";
    return "destructive";
  };

  const formatPrice = (value: any): string => {
    if (typeof value === 'number') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(value);
  };

  const extractPositionData = (data: any) => {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return null;
      }
    }

    if (!data || typeof data !== 'object') return null;

    const position = data.position || data;
    
    return {
      symbol: position.symbol,
      side: position.side || position.direction,
      avgPrice: position.avgPrice || position.entryPrice || position.price,
      currentPrice: position.currentPrice || position.price,
      stopLoss: position.stopLoss || position.stop_loss,
      takeProfit: position.takeProfit || position.take_profit,
      pnl: position.pnl || position.profit || position.unrealizedPnl,
      pnlPercent: position.pnlPercent || position.profitPercent,
      quantity: position.quantity || position.amount,
    };
  };

  const featureTypes = allLogs
    ? Array.from(new Set(allLogs.map((log: any) => log.featureType)))
    : [];

  const displayLogs = selectedFeature
    ? allLogs?.filter((log: any) => log.featureType === selectedFeature)
    : allLogs;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-transparency-title">
            <Brain className="w-8 h-8" />
            AI Transparency Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Every AI decision, fully explained and easy to understand.
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          data-testid="button-refresh-transparency"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setSelectedFeature(null)} data-testid="tab-all-logs">
            All AI Interactions
          </TabsTrigger>
          {featureTypes.map((type: string) => (
            <TabsTrigger
              key={type}
              value={type}
              onClick={() => setSelectedFeature(type)}
              data-testid={`tab-${type}`}
            >
              {type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-4">
            {displayLogs && displayLogs.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI interactions yet. Start using AI features to see transparency logs here.</p>
                  <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            )}

            {displayLogs?.map((log: any) => {
              const positionData = extractPositionData(log.inputData);
              const confidence = log.confidence ? parseFloat(log.confidence) : null;
              
              return (
                <Card key={log.id} data-testid={`log-card-${log.id}`}>
                  <CardHeader className="space-y-4">
                    {/* Top Header - Feature, Confidence, Time */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold">
                          {log.featureType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </h3>
                        {confidence !== null && (
                          <Badge variant={getConfidenceColor(log.confidence)}>
                            {confidence}% Confidence
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                      </div>
                    </div>

                    {/* Summary Line */}
                    {log.explanation && (
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                        <p className="text-sm leading-relaxed">
                          {log.explanation}
                        </p>
                      </div>
                    )}

                    {/* Model Version & Verification ID */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {log.modelVersion && (
                        <Badge variant="outline" className="text-xs">{log.modelVersion}</Badge>
                      )}
                      {log.promptHash && (
                        <button
                          onClick={() => copyVerificationId(log.promptHash)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          data-testid={`button-copy-verification-${log.id}`}
                        >
                          {copiedId === log.promptHash ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>ID: {log.promptHash.slice(0, 12)}...</span>
                        </button>
                      )}
                      {log.outcome && (
                        <Badge variant={log.outcome === 'success' ? 'default' : 'destructive'} className="text-xs">
                          {log.outcome}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Evidence Pane - Collapsible */}
                    {positionData && (
                      <Collapsible
                        open={expandedEvidence[log.id] || false}
                        onOpenChange={(open) => setExpandedEvidence(prev => ({ ...prev, [log.id]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between p-3 h-auto"
                            data-testid={`button-toggle-evidence-${log.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span className="font-semibold">What the AI Analyzed</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedEvidence[log.id] ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <div className="space-y-4">
                            {/* Position Header */}
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-primary" />
                              <span className="font-semibold">Position</span>
                              {positionData.symbol && (
                                <Badge variant="outline">{positionData.symbol}</Badge>
                              )}
                              {positionData.side && (
                                <Badge variant={positionData.side.toLowerCase() === 'long' || positionData.side.toLowerCase() === 'buy' ? 'default' : 'destructive'}>
                                  {positionData.side}
                                </Badge>
                              )}
                            </div>

                            {/* Price Grid - 4 columns */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {positionData.avgPrice !== undefined && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground uppercase">Avg Price</div>
                                  <div className="text-2xl font-bold text-green-500">
                                    {formatPrice(positionData.avgPrice)}
                                  </div>
                                </div>
                              )}
                              {positionData.currentPrice !== undefined && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground uppercase">Current Price</div>
                                  <div className="text-2xl font-bold text-green-500">
                                    {formatPrice(positionData.currentPrice)}
                                  </div>
                                </div>
                              )}
                              {positionData.stopLoss !== undefined && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground uppercase">Stop Loss</div>
                                  <div className="text-2xl font-bold text-green-500">
                                    {formatPrice(positionData.stopLoss)}
                                  </div>
                                </div>
                              )}
                              {positionData.takeProfit !== undefined && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground uppercase">Take Profit</div>
                                  <div className="text-2xl font-bold text-green-500">
                                    {formatPrice(positionData.takeProfit)}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* PnL Cards - 2 columns */}
                            {(positionData.pnl !== undefined || positionData.pnlPercent !== undefined) && (
                              <div className="grid grid-cols-2 gap-3">
                                {positionData.pnl !== undefined && (
                                  <div className={`rounded-lg p-4 ${
                                    positionData.pnl >= 0 
                                      ? 'bg-green-500/10 border border-green-500/20' 
                                      : 'bg-red-500/10 border border-red-500/20'
                                  }`}>
                                    <div className="text-sm text-muted-foreground mb-1">pnl</div>
                                    <div className={`text-3xl font-bold ${positionData.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {formatPrice(positionData.pnl)}
                                    </div>
                                  </div>
                                )}
                                {positionData.pnlPercent !== undefined && (
                                  <div className={`rounded-lg p-4 ${
                                    positionData.pnlPercent >= 0 
                                      ? 'bg-green-500/10 border border-green-500/20' 
                                      : 'bg-red-500/10 border border-red-500/20'
                                  }`}>
                                    <div className="text-sm text-muted-foreground mb-1">pnl Percent</div>
                                    <div className={`text-3xl font-bold ${positionData.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {formatPrice(positionData.pnlPercent)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* AI Recommendation - Collapsible */}
                    {log.outputData && (
                      <Collapsible
                        open={expandedReasoning[log.id] || false}
                        onOpenChange={(open) => setExpandedReasoning(prev => ({ ...prev, [log.id]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between p-3 h-auto"
                            data-testid={`button-toggle-reasoning-${log.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4" />
                              <span className="font-semibold">AI Recommendation</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedReasoning[log.id] ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg">
                            {(() => {
                              let outputData = log.outputData;
                              if (typeof outputData === 'string') {
                                try {
                                  outputData = JSON.parse(outputData);
                                } catch {
                                  return <p className="text-sm">{outputData}</p>;
                                }
                              }

                              if (typeof outputData === 'object') {
                                const recommendation = outputData.recommendation || outputData.action || outputData.decision;
                                const reasoning = outputData.reasoning || outputData.reasons || [];
                                const risks = outputData.risks || outputData.warnings || [];

                                return (
                                  <div className="space-y-4">
                                    {recommendation && (
                                      <div className="flex items-center gap-2">
                                        <Badge variant={
                                          recommendation.toLowerCase().includes('hold') ? 'secondary' :
                                          recommendation.toLowerCase().includes('buy') || recommendation.toLowerCase().includes('long') ? 'default' :
                                          'destructive'
                                        } className="text-base px-3 py-1">
                                          {recommendation}
                                        </Badge>
                                      </div>
                                    )}

                                    {Array.isArray(reasoning) && reasoning.length > 0 && (
                                      <div>
                                        <h5 className="text-sm font-semibold mb-2">Why I suggested this</h5>
                                        <ul className="space-y-1 text-sm text-muted-foreground">
                                          {reasoning.map((reason: string, idx: number) => (
                                            <li key={idx} className="flex gap-2">
                                              <span className="text-primary font-semibold">{idx + 1}.</span>
                                              <span>{reason}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {Array.isArray(risks) && risks.length > 0 && (
                                      <div>
                                        <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" />
                                          Possible Risks
                                        </h5>
                                        <ul className="space-y-1 text-sm text-muted-foreground">
                                          {risks.map((risk: string, idx: number) => (
                                            <li key={idx} className="flex gap-2">
                                              <span className="text-red-500">•</span>
                                              <span>{risk}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {!recommendation && !Array.isArray(reasoning) && (
                                      <p className="text-sm text-muted-foreground">
                                        {JSON.stringify(outputData, null, 2)}
                                      </p>
                                    )}
                                  </div>
                                );
                              }

                              return <p className="text-sm">{String(outputData)}</p>;
                            })()}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                      <Button variant="default" size="sm" data-testid={`button-accept-${log.id}`}>
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Accept
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-snooze-${log.id}`}>
                        <Bell className="w-3 h-3 mr-1" />
                        Snooze 1h
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-learned-${log.id}`}>
                        <Brain className="w-3 h-3 mr-1" />
                        Mark as Learned
                      </Button>
                      <Button variant="ghost" size="sm" data-testid={`button-report-${log.id}`}>
                        <Flag className="w-3 h-3 mr-1" />
                        Report Issue
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
