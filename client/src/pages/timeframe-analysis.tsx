import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download, TrendingUp, TrendingDown, Shield, Clock, Zap, Loader2, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TimeframeAnalysis() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Date range required",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await apiRequest('/api/analysis/range', 'POST', {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString()
      });
      setAnalysisResult(result);
      toast({
        title: "Analysis complete",
        description: "Your trading performance has been analyzed"
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze timeframe",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!analysisResult) return;
    
    const dataStr = JSON.stringify(analysisResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeframe-analysis-${format(dateFrom!, 'yyyy-MM-dd')}-to-${format(dateTo!, 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Analysis data has been downloaded"
    });
  };

  const getMistakeIcon = (type: string) => {
    switch (type) {
      case "early_exit_winners": return TrendingUp;
      case "no_stop_loss": return Shield;
      case "averaged_down": return TrendingDown;
      case "held_losers_long": return Clock;
      case "overtrading": return Zap;
      default: return BarChart3;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-timeframe-analysis">Timeframe Analysis</h1>
          <p className="text-muted-foreground">Analyze your trading performance over a specific period</p>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
          <CardDescription>Choose the period you want to analyze</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                  data-testid="button-select-date-from"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                  data-testid="button-select-date-to"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || !dateFrom || !dateTo}
            data-testid="button-analyze"
            className="gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Analyze
              </>
            )}
          </Button>

          {analysisResult && (
            <Button 
              variant="outline"
              onClick={handleExport}
              data-testid="button-export"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {analysisResult && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-trades">
                  {analysisResult?.stats?.totalTrades || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-win-rate">
                  {analysisResult?.stats?.winRate?.toFixed(1) || '0.0'}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analysisResult?.stats?.wins || 0}W / {analysisResult?.stats?.losses || 0}L
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className={cn(
                    "text-2xl font-bold",
                    (analysisResult?.stats?.totalPnL || 0) >= 0 ? "text-green-600" : "text-red-600"
                  )}
                  data-testid="stat-total-pnl"
                >
                  {(analysisResult?.stats?.totalPnL || 0) >= 0 ? '+' : ''}${(analysisResult?.stats?.totalPnL || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Hold Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-avg-hold-time">
                  {(analysisResult?.stats?.avgHoldTime || 0).toFixed(0)}m
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results Tabs */}
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
              <TabsTrigger value="winners" data-testid="tab-winners">Winners</TabsTrigger>
              <TabsTrigger value="losers" data-testid="tab-losers">Losers</TabsTrigger>
              <TabsTrigger value="mistakes" data-testid="tab-mistakes">Mistakes</TabsTrigger>
              <TabsTrigger value="learning" data-testid="tab-learning">Learning</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm" data-testid="text-summary">{analysisResult?.summary || 'No summary available'}</p>
                  
                  {(analysisResult?.strengths?.length || 0) > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Strengths:</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {(analysisResult?.strengths || []).map((strength: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Winning Trades Tab */}
            <TabsContent value="winners">
              <Card>
                <CardHeader>
                  <CardTitle>Winning Trades ({analysisResult?.winningTrades?.length || 0})</CardTitle>
                  <CardDescription>Trades that generated profits</CardDescription>
                </CardHeader>
                <CardContent>
                  {(analysisResult?.winningTrades?.length || 0) > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>P&L</TableHead>
                          <TableHead>Hold Time</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(analysisResult?.winningTrades || []).map((trade: any) => (
                          <TableRow key={trade.id}>
                            <TableCell className="font-medium">{trade.symbol}</TableCell>
                            <TableCell>${parseFloat(trade.price || 0).toFixed(2)}</TableCell>
                            <TableCell>{parseFloat(trade.quantity || 0).toFixed(4)}</TableCell>
                            <TableCell className="text-green-600">
                              +${(trade.pnl || 0).toFixed(2)} ({(trade.pnlPercent || 0).toFixed(1)}%)
                            </TableCell>
                            <TableCell>
                              {trade.holdTime ? `${(trade.holdTime / 60).toFixed(0)}m` : 'N/A'}
                            </TableCell>
                            <TableCell>{format(new Date(trade.timestamp), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No winning trades in this period</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Losing Trades Tab */}
            <TabsContent value="losers">
              <Card>
                <CardHeader>
                  <CardTitle>Losing Trades ({analysisResult?.losingTrades?.length || 0})</CardTitle>
                  <CardDescription>Trades that resulted in losses</CardDescription>
                </CardHeader>
                <CardContent>
                  {(analysisResult?.losingTrades?.length || 0) > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>P&L</TableHead>
                          <TableHead>Hold Time</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(analysisResult?.losingTrades || []).map((trade: any) => (
                          <TableRow key={trade.id}>
                            <TableCell className="font-medium">{trade.symbol}</TableCell>
                            <TableCell>${parseFloat(trade.price || 0).toFixed(2)}</TableCell>
                            <TableCell>{parseFloat(trade.quantity || 0).toFixed(4)}</TableCell>
                            <TableCell className="text-red-600">
                              ${(trade.pnl || 0).toFixed(2)} ({(trade.pnlPercent || 0).toFixed(1)}%)
                            </TableCell>
                            <TableCell>
                              {trade.holdTime ? `${(trade.holdTime / 60).toFixed(0)}m` : 'N/A'}
                            </TableCell>
                            <TableCell>{format(new Date(trade.timestamp), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No losing trades in this period</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Mistakes Tab */}
            <TabsContent value="mistakes" className="space-y-4">
              {(analysisResult?.mistakeTags?.length || 0) > 0 ? (
                (analysisResult?.mistakeTags || []).map((mistake: any, idx: number) => {
                  const IconComponent = getMistakeIcon(mistake.type);
                  return (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                              <IconComponent className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{mistake.description}</CardTitle>
                              <CardDescription>
                                Found in {mistake.count} trade{mistake.count !== 1 ? 's' : ''}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="destructive">{mistake.count}</Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      No common mistakes detected. Great job!
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Learning Tab */}
            <TabsContent value="learning" className="space-y-4">
              {(analysisResult?.suggestions?.length || 0) > 0 ? (
                (analysisResult?.suggestions || []).map((suggestion: any, idx: number) => (
                  <Card key={idx}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              suggestion.priority === 'high' ? 'destructive' :
                              suggestion.priority === 'medium' ? 'default' : 'secondary'
                            }>
                              {suggestion.priority} priority
                            </Badge>
                            <Badge variant="outline">{suggestion.category}</Badge>
                          </div>
                          <CardTitle className="text-base">{suggestion.recommendation}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      No specific learning recommendations at this time
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty State */}
      {!analysisResult && !isAnalyzing && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="font-semibold">No analysis yet</h3>
              <p className="text-sm text-muted-foreground">
                Select a date range and click Analyze to view your trading performance
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
