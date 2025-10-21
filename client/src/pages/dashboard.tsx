import DashboardHeader from "@/components/DashboardHeader";
import StatsOverview from "@/components/StatsOverview";
import TradingDnaCard from "@/components/TradingDnaCard";
import PaperWalletCard from "@/components/PaperWalletCard";
import PaperOrderForm from "@/components/PaperOrderForm";
import AIBriefingCard from "@/components/AIBriefingCard";
import AIInsightsCard from "@/components/AIInsightsCard";
import LivePricesTicker from "@/components/LivePricesTicker";
import { WatchlistCard } from "@/components/WatchlistCard";
import { PriceAlertsCard } from "@/components/PriceAlertsCard";
import { LiveTradeModal } from "@/components/LiveTradeModal";
import ComprehensiveTradeModal from "@/components/ComprehensiveTradeModal";
import AIFeaturesHub from "@/components/AIFeaturesHub";
import { DailyInsightsSection } from "@/components/DailyInsightsSection";
import { useTraderData } from "@/hooks/useTraderData";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLivePrices } from "@/hooks/useLivePrices";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link as LinkIcon, Rocket, Brain, TrendingUp, Shield, Zap, Heart, ArrowUpDown, BarChart3, Settings2, DollarSign, Target, Activity, Bookmark, Bell } from "lucide-react";
import { TimeframeSelector } from "@/components/TimeframeSelector";
import { RangeAnalysisCard } from "@/components/RangeAnalysisCard";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FocusMode, useFocusModeShortcut } from "@/components/FocusMode";
import { PeaceIndexCard } from "@/components/PeaceIndexCard";
import { AdaptiveInsightsPanel } from "@/components/AdaptiveInsightsPanel";
import { CustomizationModePanel } from "@/components/CustomizationModePanel";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { getDefaultVisibleModules } from "@/lib/moduleRegistry";
import { PersonalAgentHealth } from "@/components/PersonalAgentHealth";
import DetailedDnaInsights from "@/components/DetailedDnaInsights";
import AdvancedAiTools from "@/components/AdvancedAiTools";

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const { 
    tradingDNA, 
    walletData, 
    briefing, 
    riskStatus,
    isLoading,
    placeOrder,
    generateBriefing,
    pauseTrading,
    resumeTrading
  } = useTraderData();
  const { toast } = useToast();
  const { prices } = useLivePrices();
  const [liveTradeModalOpen, setLiveTradeModalOpen] = useState(false);
  const [comprehensiveTradeModalOpen, setComprehensiveTradeModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");
  const [focusModeActive, setFocusModeActive] = useState(false);
  
  // Phase 2: Dashboard Customization State
  const [mode, setMode] = useState<"simple" | "power">("simple");
  const [visibleModules, setVisibleModules] = useState<string[]>(
    getDefaultVisibleModules().map((m) => m.id)
  );
  
  // Shared focus mode toggle handler (used by keyboard and Peace Index Card)
  const handleFocusModeToggle = () => {
    const newState = !focusModeActive;
    setFocusModeActive(newState);
    
    // Log telemetry event
    logTelemetryMutation.mutate({
      eventType: "focus_mode_toggle",
      eventData: { active: newState },
    });
  };
  
  // Focus Mode keyboard shortcut (F key)
  useFocusModeShortcut(handleFocusModeToggle);

  // Load default layout on mount
  const { data: defaultLayout } = useQuery<{
    id: string;
    layoutName: string;
    mode?: string;
    visibleModules?: string[];
    isDefault: boolean;
  }>({
    queryKey: ["/api/dashboard/layout/default", userId],
    enabled: !!userId,
  });

  // Apply loaded layout
  useEffect(() => {
    if (defaultLayout) {
      if (defaultLayout.mode) {
        setMode(defaultLayout.mode as "simple" | "power");
      }
      if (defaultLayout.visibleModules && Array.isArray(defaultLayout.visibleModules)) {
        setVisibleModules(defaultLayout.visibleModules);
      }
    }
  }, [defaultLayout]);

  // Save layout mutation  
  const saveLayoutMutation = useMutation({
    mutationFn: async ({ layoutData, showToast = false }: { layoutData: any; showToast?: boolean }) => {
      const response = await apiRequest("/api/dashboard/layout", "POST", layoutData);
      return { data: await response.json(), showToast };
    },
    onSuccess: ({ showToast }) => {
      // Only show toast for manual saves to avoid spam during auto-save
      if (showToast) {
        toast({
          title: "Layout Saved",
          description: "Your dashboard layout has been saved",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/layout/default", userId] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save layout",
        variant: "destructive",
      });
    },
  });

  // Log telemetry mutation
  const logTelemetryMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await apiRequest("/api/telemetry/event", "POST", eventData);
      return response.json();
    },
  });

  // Handle module toggle
  const handleModuleToggle = (moduleId: string, visible: boolean) => {
    const newVisibleModules = visible
      ? [...visibleModules, moduleId]
      : visibleModules.filter((id) => id !== moduleId);

    setVisibleModules(newVisibleModules);

    // Auto-save layout (silent - no toast)
    saveLayoutMutation.mutate({
      layoutData: {
        layoutName: "My Dashboard",
        mode,
        visibleModules: newVisibleModules,
        isDefault: true,
      },
      showToast: false,
    });

    // Log telemetry - module toggle
    logTelemetryMutation.mutate({
      eventType: visible ? "module_add" : "module_remove",
      eventData: { moduleId, mode },
    });

    // Log telemetry - layout save
    logTelemetryMutation.mutate({
      eventType: "layout_save",
      eventData: { mode, moduleCount: newVisibleModules.length },
    });
  };

  // Handle mode change
  const handleModeChange = (newMode: "simple" | "power") => {
    setMode(newMode);

    // Auto-save layout (silent - no toast, mode change has its own toast)
    saveLayoutMutation.mutate({
      layoutData: {
        layoutName: "My Dashboard",
        mode: newMode,
        visibleModules,
        isDefault: true,
      },
      showToast: false,
    });

    // Log telemetry - mode switch
    logTelemetryMutation.mutate({
      eventType: "mode_switch",
      eventData: { from: mode, to: newMode },
    });

    // Log telemetry - layout save
    logTelemetryMutation.mutate({
      eventType: "layout_save",
      eventData: { mode: newMode, moduleCount: visibleModules.length },
    });

    // Show mode-specific toast
    toast({
      title: `${newMode === "power" ? "Power" : "Simple"} Mode`,
      description: `Switched to ${newMode} mode`,
    });
  };

  // Handle manual layout save
  const handleSaveLayout = () => {
    saveLayoutMutation.mutate({
      layoutData: {
        layoutName: "My Dashboard",
        mode,
        visibleModules,
        isDefault: true,
      },
      showToast: true, // Show toast for manual saves
    });

    // Log telemetry
    logTelemetryMutation.mutate({
      eventType: "layout_save",
      eventData: { mode, moduleCount: visibleModules.length },
    });
  };

  // Handle layout import - apply imported settings
  const handleImportLayout = (importedMode: "simple" | "power", importedModules: string[]) => {
    setMode(importedMode);
    setVisibleModules(importedModules);
    
    // Auto-save the imported layout
    saveLayoutMutation.mutate({
      layoutData: {
        layoutName: "My Dashboard",
        mode: importedMode,
        visibleModules: importedModules,
        isDefault: true,
      },
      showToast: false, // Import success toast already shown
    });

    // Log telemetry
    logTelemetryMutation.mutate({
      eventType: "layout_save",
      eventData: { mode: importedMode, moduleCount: importedModules.length },
    });
  };

  // Check if module is visible
  const isModuleVisible = (moduleId: string) => visibleModules.includes(moduleId);
  interface AnalysisResult {
    runId: string;
    summary: string;
    mistakes: Array<{
      type: string;
      count: number;
      description: string;
      tradeIds: string[];
    }>;
    suggestions: Array<{
      category: string;
      recommendation: string;
      priority: "high" | "medium" | "low";
    }>;
    strengths: string[];
    weaknesses: string[];
    tokenUsage: number;
  }
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisDateRange, setAnalysisDateRange] = useState<{ from: Date; to: Date } | null>(null);

  // Timeframe analysis mutation
  const analyzeTimeframeMutation = useMutation({
    mutationFn: async ({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) => {
      const response = await apiRequest("/api/analysis/range", "POST", {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });
      return response.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResult(data);
      toast({
        title: "Analysis Complete",
        description: "Your trading performance has been analyzed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze timeframe",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = (dateFrom: Date, dateTo: Date) => {
    setAnalysisDateRange({ from: dateFrom, to: dateTo });
    analyzeTimeframeMutation.mutate({ dateFrom, dateTo });
  };

  // Fetch exchange status
  const { data: exchangeStatus } = useQuery<Array<{
    exchange: string;
    connected: boolean;
    permissions: string;
    testnet: boolean;
    lastValidated?: Date | null;
  }>>({
    queryKey: ["/api/exchange/status", userId],
    enabled: !!userId,
  });

  // Fetch exchange balance (only if connected)
  const binanceConnected = exchangeStatus?.find(e => e.exchange === 'binance')?.connected || false;
  const binanceTestnet = exchangeStatus?.find(e => e.exchange === 'binance')?.testnet || false;
  
  const { data: exchangeBalance } = useQuery<{
    balances: Array<{ asset: string; free: string; locked: string }>;
    canTrade: boolean;
    canDeposit: boolean;
    canWithdraw: boolean;
    updateTime: number;
  }>({
    queryKey: ["/api/exchange/balance", userId],
    enabled: !!userId && binanceConnected,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate total balance in USDT
  const totalExchangeBalance = exchangeBalance?.balances.reduce((total, asset) => {
    const freeBalance = parseFloat(asset.free);
    const lockedBalance = parseFloat(asset.locked);
    // For now, just sum all balances (in reality you'd convert to USDT)
    // This is a simplified calculation
    if (asset.asset === 'USDT') {
      return total + freeBalance + lockedBalance;
    }
    return total;
  }, 0) || 0;

  // Parse briefing data if available (with error handling)
  const parsedBriefing = briefing ? (() => {
    try {
      return {
        timestamp: new Date(briefing.timestamp),
        summary: briefing.summary,
        insights: typeof briefing.insights === 'string' ? JSON.parse(briefing.insights) : briefing.insights,
        recommendations: typeof briefing.recommendations === 'string' ? JSON.parse(briefing.recommendations) : briefing.recommendations
      };
    } catch (error) {
      console.error('Failed to parse briefing data:', error);
      return {
        timestamp: new Date(briefing.timestamp),
        summary: briefing.summary,
        insights: [],
        recommendations: []
      };
    }
  })() : null;

  // Fetch Binance open orders (replaces paper wallet positions)
  const { data: binanceOrders } = useQuery<{
    orders: any[];
  }>({
    queryKey: ["/api/exchange/orders", userId],
    enabled: !!userId && binanceConnected,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Calculate stats from exchange balance
  const totalPnL = 0; // Will be calculated from real trades later
  const activePositions = binanceOrders?.orders?.length || 0; // Count open orders

  const handleOrderSubmit = async (order: any) => {
    try {
      await placeOrder.mutateAsync(order);
      toast({
        title: "Order Executed",
        description: `${order.side.toUpperCase()} order for ${order.quantity} ${order.symbol} completed`,
      });
    } catch (error: any) {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to execute order",
        variant: "destructive",
      });
    }
  };

  const handleToggleTrading = async (active: boolean) => {
    try {
      if (active) {
        await resumeTrading.mutateAsync();
      } else {
        await pauseTrading.mutateAsync();
      }
      toast({
        title: active ? "Trading Resumed" : "Trading Paused",
        description: active ? "Your trading is now active" : "Trading has been paused for safety",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update trading status",
        variant: "destructive",
      });
    }
  };

  const handleExitPosition = async (positionId: string, quantity: string) => {
    try {
      // Find the position to get the symbol
      const position = walletData?.positions?.find((p: any) => p.id === positionId);
      if (!position) {
        throw new Error("Position not found");
      }

      // Place a market sell order for the specified quantity
      await placeOrder.mutateAsync({
        symbol: position.symbol,
        side: "sell",
        orderType: "market",
        quantity: quantity,
      });

      toast({
        title: "Position Exited",
        description: `Successfully sold ${quantity} ${position.symbol}`,
      });
    } catch (error: any) {
      toast({
        title: "Exit Failed",
        description: error.message || "Failed to exit position",
        variant: "destructive",
      });
    }
  };

  const handleGenerateBriefing = async () => {
    try {
      // Show a loading toast since this takes 20-30 seconds
      toast({
        title: "Generating AI Briefing...",
        description: "This may take 20-30 seconds. Please wait...",
      });
      
      await generateBriefing.mutateAsync();
      
      toast({
        title: "Briefing Generated",
        description: "Your AI briefing has been updated",
      });
    } catch (error: any) {
      // Check if it's a quota error or timeout
      const errorMessage = error.message || "";
      const isQuotaError = errorMessage.includes("quota") || errorMessage.includes("429");
      const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("500");
      
      if (isTimeout) {
        // The briefing might have been created, just refresh to see it
        toast({
          title: "Briefing May Be Ready",
          description: "Please refresh the page to see your AI briefing",
        });
        // Auto-refresh the briefing query
        queryClient.invalidateQueries({ queryKey: ["/api/ai/briefing", "demo-user-123"] });
      } else {
        toast({
          title: isQuotaError ? "OpenAI Quota Exceeded" : "Error",
          description: isQuotaError 
            ? "Please add credits to your OpenAI account at platform.openai.com/billing"
            : errorMessage || "Failed to generate briefing",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your trading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Dashboard Header with Status & Emergency Power */}
      <DashboardHeader 
        username={user?.email?.split('@')[0] || 'Trader'}
        notifications={0}
        riskLevel={tradingDNA?.riskScore > 70 ? "high" : tradingDNA?.riskScore > 40 ? "medium" : "low"}
        statusMessage={riskStatus?.tradingPaused ? "Trading is paused" : "All systems operational"}
        tradingActive={!riskStatus?.tradingPaused}
        onTradingToggle={handleToggleTrading}
        onLogoutClick={() => window.location.href = '/api/logout'}
      />
      
      {/* CONTAINER: Locked to 1200px max-width */}
      <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-8">
        {/* Global Trade Button - Prominent at Top */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your portfolio with AI-powered insights</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <ModeSwitcher 
              mode={mode} 
              onModeChange={handleModeChange} 
              data-testid="mode-switcher-dashboard"
            />
            <CustomizationModePanel
              visibleModules={visibleModules}
              onModuleToggle={handleModuleToggle}
              onSaveLayout={handleSaveLayout}
              onImportLayout={handleImportLayout}
              mode={mode}
              layoutId={defaultLayout?.id || "default"}
            />
            <Button 
              size="lg" 
              className="w-full sm:w-auto h-12 text-base font-semibold"
              onClick={() => setComprehensiveTradeModalOpen(true)}
              data-testid="button-global-trade"
            >
              <ArrowUpDown className="h-5 w-5 mr-2" />
              Trade Now
            </Button>
          </div>
        </div>

        {/* FRAME 1: Peace Index + Wallet | Live Market + Trading DNA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: Peace Index + Wallet Column (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Peace Index - Compact 160px */}
              {isModuleVisible("peace-index") && (
                <PeaceIndexCard userId={user?.id || ""} />
              )}
              
              {/* Live Portfolio (Binance) - Replaces paper trading */}
              {isModuleVisible("paper-wallet") && binanceConnected && (
                <Card data-testid="card-live-portfolio">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Live Portfolio
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Real-time balances from your Binance account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded-lg border">
                        <span className="text-sm font-medium">Total Balance</span>
                        <span className="text-lg font-bold">${totalExchangeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg border">
                        <span className="text-xs text-muted-foreground">Mode</span>
                        <Badge variant={binanceTestnet ? "secondary" : "default"}>
                          {binanceTestnet ? "Testnet" : "Live Trading"}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">Full portfolio view coming soon</p>
                      <p className="text-xs mt-1">Your Binance balance is displayed above</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Show message if no exchange connected */}
              {isModuleVisible("paper-wallet") && !binanceConnected && (
                <Card data-testid="card-connect-exchange">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Connect Exchange
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your Binance account to see your live portfolio
                    </p>
                    <Button variant="default" asChild>
                      <a href="/settings">Go to Settings</a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT: Live Market + Trading DNA Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Live Market - Fixed 340px height, 3 rows visible */}
              {isModuleVisible("live-prices") && (
                <div data-testid="module-live-prices">
                  <LivePricesTicker 
                    onTradeClick={(symbol) => {
                      setSelectedSymbol(symbol);
                      setComprehensiveTradeModalOpen(true);
                    }}
                  />
                </div>
              )}
              
              {/* Trading DNA - Fixed 220px height with scroll */}
              {isModuleVisible("trading-dna") && (
                <div data-testid="module-trading-dna">
                  <TradingDnaCard />
                </div>
              )}
            </div>
        </div>

        {/* FRAME 2: Detailed DNA Insights + Advanced AI Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-6 max-h-[380px] overflow-hidden" data-testid="module-detailed-dna">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                DNA Deep Dive
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 h-[calc(100%-52px)] overflow-y-auto card-scroll">
              <DetailedDnaInsights />
            </CardContent>
          </Card>
          
          <div className="lg:col-span-6" data-testid="module-advanced-ai-tools">
            <AdvancedAiTools 
              onTradeAction={(symbol, side, quantity) => {
                setComprehensiveTradeModalOpen(true);
              }}
            />
          </div>
        </div>

        {/* FRAME 3: Watchlist + Personal AI Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {isModuleVisible("watchlist") && (
            <Card className="lg:col-span-6 max-h-[300px] overflow-hidden" data-testid="module-watchlist">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-primary" />
                  Watchlist
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 h-[calc(100%-52px)] overflow-y-auto card-scroll">
                <WatchlistCard userId={userId} currentPrices={prices} />
              </CardContent>
            </Card>
          )}
          
          <div className="lg:col-span-6" data-testid="module-agent-health">
            <PersonalAgentHealth />
          </div>
        </div>

        {/* FRAME 4: Price Alerts (if enabled) */}
        {isModuleVisible("price-alerts") && (
          <Card className="max-h-[300px] overflow-hidden" data-testid="module-price-alerts">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-primary" />
                Price Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 h-[calc(100%-52px)] overflow-y-auto card-scroll">
              <PriceAlertsCard userId={userId} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live Trade Modal */}
      <LiveTradeModal 
        open={liveTradeModalOpen} 
        onOpenChange={setLiveTradeModalOpen} 
      />

      {/* Comprehensive Trade Modal */}
      <ComprehensiveTradeModal
        open={comprehensiveTradeModalOpen}
        onOpenChange={setComprehensiveTradeModalOpen}
        userId={userId}
        defaultSymbol={selectedSymbol}
      />

      {/* Focus Mode Overlay - Press F to activate */}
      <FocusMode 
        isActive={focusModeActive} 
        onToggle={() => setFocusModeActive(!focusModeActive)} 
      />
    </div>
  );
}
