import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePriceSocket } from "@/hooks/usePriceSocket";
import WhatIfModal from "@/components/WhatIfModal";
import { MistakePredictionAlert } from "@/components/MistakePredictionAlert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  AlertCircle,
  Shield,
  Activity,
  Zap,
  Wallet,
  TrendingUpDown,
  AlertTriangle,
  Lightbulb
} from "lucide-react";

interface ComprehensiveTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultSymbol?: string;
  defaultSide?: "buy" | "sell";
}

export default function ComprehensiveTradeModal({
  open,
  onOpenChange,
  userId,
  defaultSymbol = "BTC",
  defaultSide = "buy"
}: ComprehensiveTradeModalProps) {
  const { toast } = useToast();
  const { prices, connected } = usePriceSocket();
  
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [useStopLoss, setUseStopLoss] = useState(false);
  const [useTakeProfit, setUseTakeProfit] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [walletMode, setWalletMode] = useState<"paper" | "real">(() => {
    return localStorage.getItem("tradingMode") === "real" ? "real" : "paper";
  });
  const [mistakePrediction, setMistakePrediction] = useState<any>(null);
  const [showMistakeWarning, setShowMistakeWarning] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  // Reset What-If modal state when trade modal closes
  const handleTradeModalChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowWhatIf(false);
    }
    onOpenChange(isOpen);
  };

  // Get current price with proper fallback
  const priceData = prices[symbol];
  const currentPrice = priceData?.price || 0;
  const priceChange = priceData?.change || 0;
  const priceChangePercent = priceData?.changePercent || 0;

  // Fetch paper wallet balance
  const { data: walletData } = useQuery({
    queryKey: ["/api/paper/wallet", userId],
    enabled: !!userId && open && walletMode === "paper",
  });

  // Fetch exchange connection status
  const { data: exchangeStatus } = useQuery({
    queryKey: ["/api/exchange/status", userId],
    enabled: !!userId && open && walletMode === "real",
  });

  // Calculate available balance based on wallet mode
  const availableBalance = walletMode === "paper" 
    ? ((walletData as any)?.wallet?.balance || 0)
    : 0; // Real mode shows $0.00 until exchange is connected

  const hasExchangeConnected = exchangeStatus && Array.isArray(exchangeStatus) && exchangeStatus.length > 0;


  // Mistake Prediction Check Mutation
  const mistakeCheckMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      return await apiRequest("/api/mistake-prediction/analyze", "POST", tradeData);
    },
    onSuccess: (data: any) => {
      if (data.hasPrediction) {
        setMistakePrediction(data.prediction);
        setShowMistakeWarning(true);
      } else {
        // No warning, proceed with trade
        proceedWithTrade();
      }
    },
    onError: (error: any) => {
      // If mistake check fails, allow trade to proceed (fail open)
      console.error("Mistake prediction error:", error);
      proceedWithTrade();
    },
  });

  const placeTradeMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("/api/paper/order", "POST", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/wallet", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/orders", userId] });
      toast({
        title: "Order Placed",
        description: `${side.toUpperCase()} order for ${quantity} ${symbol} placed successfully!`,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setQuantity("");
    setPrice("");
    setStopLoss("");
    setTakeProfit("");
    setUseStopLoss(false);
    setUseTakeProfit(false);
    setMistakePrediction(null);
  };

  const proceedWithTrade = () => {
    const orderData = {
      userId,
      symbol,
      side,
      orderType,
      quantity: parseFloat(quantity),
      price: orderType === "market" ? currentPrice : parseFloat(price),
      ...(useStopLoss && stopLoss && { stopLoss: parseFloat(stopLoss) }),
      ...(useTakeProfit && takeProfit && { takeProfit: parseFloat(takeProfit) }),
    };

    placeTradeMutation.mutate(orderData);
  };

  const handleSubmit = () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "limit" && (!price || parseFloat(price) <= 0)) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid limit price",
        variant: "destructive",
      });
      return;
    }

    // First, check for potential mistakes
    const tradeData = {
      userId,
      symbol,
      side,
      quantity: parseFloat(quantity),
      price: orderType === "market" ? currentPrice : parseFloat(price),
      orderType,
      leverage: 1, // No leverage for paper trading
    };

    mistakeCheckMutation.mutate(tradeData);
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const priceValue = orderType === "market" ? currentPrice : (parseFloat(price) || 0);
    return qty * priceValue;
  };

  const calculateProfitLoss = () => {
    const qty = parseFloat(quantity) || 0;
    const entryPrice = orderType === "market" ? currentPrice : (parseFloat(price) || currentPrice);
    
    let potentialProfit = 0;
    let potentialLoss = 0;
    let riskRewardRatio = 0;
    
    if (useTakeProfit && takeProfit) {
      const tpPrice = parseFloat(takeProfit);
      if (side === "buy") {
        potentialProfit = (tpPrice - entryPrice) * qty;
      } else {
        potentialProfit = (entryPrice - tpPrice) * qty;
      }
    }
    
    if (useStopLoss && stopLoss) {
      const slPrice = parseFloat(stopLoss);
      if (side === "buy") {
        potentialLoss = (entryPrice - slPrice) * qty;
      } else {
        potentialLoss = (slPrice - entryPrice) * qty;
      }
    }
    
    if (potentialLoss > 0) {
      riskRewardRatio = potentialProfit / potentialLoss;
    }
    
    return { potentialProfit, potentialLoss, riskRewardRatio };
  };

  const calculateQuickPercent = (percent: number) => {
    const priceValue = orderType === "market" ? currentPrice : (parseFloat(price) || currentPrice);
    if (side === "buy") {
      setStopLoss((priceValue * (1 - percent / 100)).toFixed(2));
      setTakeProfit((priceValue * (1 + percent / 100)).toFixed(2));
    } else {
      setStopLoss((priceValue * (1 + percent / 100)).toFixed(2));
      setTakeProfit((priceValue * (1 - percent / 100)).toFixed(2));
    }
  };


  const total = calculateTotal();
  const { potentialProfit, potentialLoss, riskRewardRatio } = calculateProfitLoss();

  return (
    <>
    <Dialog open={open} onOpenChange={handleTradeModalChange}>
      <DialogContent className="max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Trade</DialogTitle>
              <DialogDescription>
                Execute trades with professional tools and risk management
              </DialogDescription>
            </div>
            <Badge variant={connected ? "default" : "secondary"} className="gap-1">
              <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              {connected ? 'Live' : 'Connecting...'}
            </Badge>
          </div>
          
          {/* Wallet Balance with Switch */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Available Balance</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={walletMode === "paper" ? "default" : "secondary"} className="text-xs">
                    {walletMode === "paper" ? "PAPER" : "REAL"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWalletMode(walletMode === "paper" ? "real" : "paper")}
                    className="h-8 px-2"
                    data-testid="button-switch-wallet"
                  >
                    <TrendingUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                {walletMode === "real" && !hasExchangeConnected ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold font-mono text-muted-foreground">
                      $0.00
                    </p>
                    <p className="text-xs text-yellow-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Connect exchange to trade
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold font-mono">
                    ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {walletMode === "paper" ? "Simulated Funds" : "Live Exchange"}
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="space-y-6 pb-6">
            {/* Symbol Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <Label>Asset</Label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["BTC", "ETH", "SOL"].map((sym) => {
                  const symPrice = prices[sym as keyof typeof prices]?.price || 0;
                  const symChange = prices[sym as keyof typeof prices]?.change || 0;
                  return (
                    <Card
                      key={sym}
                      className={`cursor-pointer transition-all ${
                        symbol === sym
                          ? "ring-2 ring-primary bg-primary/5"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSymbol(sym)}
                      data-testid={`button-symbol-${sym.toLowerCase()}`}
                    >
                      <CardContent className="p-4 text-center space-y-1">
                        <p className="font-mono font-bold text-lg">{sym}</p>
                        <p className="font-mono text-sm">${symPrice.toLocaleString()}</p>
                        <div className={`flex items-center justify-center gap-1 text-xs ${
                          symChange >= 0 ? 'text-chart-2' : 'text-chart-3'
                        }`}>
                          {symChange >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>{symChange >= 0 ? '+' : ''}{symChange.toFixed(2)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Buy/Sell Toggle */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <Label>Order Side</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={side === "buy" ? "default" : "outline"}
                  onClick={() => setSide("buy")}
                  className="h-12"
                  data-testid="button-side-buy"
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Buy
                </Button>
                <Button
                  variant={side === "sell" ? "default" : "outline"}
                  onClick={() => setSide("sell")}
                  className="h-12"
                  data-testid="button-side-sell"
                >
                  <ArrowDownRight className="h-4 w-4 mr-2" />
                  Sell
                </Button>
              </div>
            </div>

            <Separator />

            {/* Order Type */}
            <div className="space-y-4">
              <Label>Order Type</Label>
              <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market" data-testid="tab-market">Market</TabsTrigger>
                  <TabsTrigger value="limit" data-testid="tab-limit">Limit</TabsTrigger>
                </TabsList>

                <TabsContent value="market" className="space-y-4 mt-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Market Price</span>
                        <span className="font-mono font-bold text-lg">
                          ${currentPrice.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="limit" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="limit-price">Limit Price</Label>
                    <Input
                      id="limit-price"
                      type="number"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      data-testid="input-limit-price"
                    />
                    <p className="text-xs text-muted-foreground">
                      Current: ${currentPrice.toLocaleString()}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-quantity"
              />
            </div>

            <Separator />

            {/* Risk Management */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label>Risk Management</Label>
              </div>

              {/* Stop Loss */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="use-stop-loss" className="text-sm font-medium">
                    Stop Loss
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatic exit to limit losses
                  </p>
                </div>
                <Switch
                  id="use-stop-loss"
                  checked={useStopLoss}
                  onCheckedChange={setUseStopLoss}
                  data-testid="switch-stop-loss"
                />
              </div>
              {useStopLoss && (
                <Input
                  type="number"
                  placeholder="Stop Loss Price"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  data-testid="input-stop-loss"
                />
              )}

              {/* Take Profit */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="use-take-profit" className="text-sm font-medium">
                    Take Profit
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatic exit to secure gains
                  </p>
                </div>
                <Switch
                  id="use-take-profit"
                  checked={useTakeProfit}
                  onCheckedChange={setUseTakeProfit}
                  data-testid="switch-take-profit"
                />
              </div>
              {useTakeProfit && (
                <Input
                  type="number"
                  placeholder="Take Profit Price"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  data-testid="input-take-profit"
                />
              )}

              {/* Quick SL/TP Presets */}
              {(useStopLoss || useTakeProfit) && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 5, 10, 15].map((percent) => (
                      <Button
                        key={percent}
                        variant="outline"
                        size="sm"
                        onClick={() => calculateQuickPercent(percent)}
                        data-testid={`button-preset-${percent}`}
                      >
                        {percent}%
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* P/L Calculator */}
              {(useStopLoss || useTakeProfit) && (potentialProfit > 0 || potentialLoss > 0) && (
                <Card className="bg-muted/30 border-muted">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUpDown className="h-4 w-4" />
                      Profit/Loss Calculator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {potentialProfit > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-md bg-chart-2/10">
                        <span className="text-sm text-muted-foreground">Potential Profit</span>
                        <span className="font-mono font-bold text-chart-2">
                          +${potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {potentialLoss > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-md bg-chart-3/10">
                        <span className="text-sm text-muted-foreground">Potential Loss</span>
                        <span className="font-mono font-bold text-chart-3">
                          -${potentialLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {riskRewardRatio > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-md bg-primary/10">
                        <span className="text-sm text-muted-foreground">Risk/Reward Ratio</span>
                        <Badge variant="outline" className="font-mono font-bold">
                          1:{riskRewardRatio.toFixed(2)}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>


            {/* Order Summary */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Side</span>
                  <Badge variant={side === "buy" ? "default" : "secondary"}>
                    {side.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{orderType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-mono font-medium">{quantity || "0.00"} {symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-mono font-medium">
                    ${(orderType === "market" ? currentPrice : (parseFloat(price) || 0)).toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Estimated Total</span>
                  <span className="font-mono">
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-6 bg-muted/20 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWhatIf(true)}
              disabled={!quantity || (orderType === "limit" && !price)}
              className="gap-2"
              data-testid="button-whatif"
            >
              <Lightbulb className="h-4 w-4" />
              What-If
            </Button>
            <Button
              variant="outline"
              onClick={() => handleTradeModalChange(false)}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={placeTradeMutation.isPending || mistakeCheckMutation.isPending || !quantity || (orderType === "limit" && !price)}
              className="flex-1"
              data-testid="button-execute"
            >
              {mistakeCheckMutation.isPending ? "Checking Trade..." : placeTradeMutation.isPending ? "Placing Order..." : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={showMistakeWarning} onOpenChange={setShowMistakeWarning}>
      <DialogContent className="max-w-2xl" data-testid="dialog-mistake-warning">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            AI Protective Alert
          </DialogTitle>
          <DialogDescription>
            Your AI trading companion has detected a potential risk
          </DialogDescription>
        </DialogHeader>
        
        {mistakePrediction && (
          <MistakePredictionAlert
            prediction={{
              id: mistakePrediction.id || 'temp',
              predictionType: mistakePrediction.predictionType || 'unknown',
              severity: mistakePrediction.severity || 'medium',
              confidence: mistakePrediction.confidence || 50,
              reasoning: mistakePrediction.reasoning || '',
              evidence: mistakePrediction.evidence || [],
              alternativeSuggestion: mistakePrediction.alternativeSuggestion || '',
              triggerFactors: mistakePrediction.triggerFactors || [],
            }}
            onDismiss={() => {
              setShowMistakeWarning(false);
              setMistakePrediction(null);
            }}
            onModifyTrade={() => {
              setShowMistakeWarning(false);
              // Keep modal open so user can adjust trade
            }}
            onProceedAnyway={() => {
              setShowMistakeWarning(false);
              proceedWithTrade();
            }}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* What-If Modal */}
    <WhatIfModal
      open={showWhatIf}
      onOpenChange={setShowWhatIf}
      userId={userId}
      tradeParams={{
        symbol,
        side,
        size: total,
        entryPrice: orderType === "market" ? currentPrice : parseFloat(price) || currentPrice,
        slippagePct: 0.1,
      }}
    />
    </>
  );
}
