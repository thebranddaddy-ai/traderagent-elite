import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, TrendingDown, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartOrderTicketProps {
  symbol: string;
  currentPrice: number;
  onClose: () => void;
  onSubmit: (order: OrderData) => void;
  className?: string;
}

export interface OrderData {
  symbol: string;
  orderType: "market" | "limit";
  side: "buy" | "sell";
  size: number;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function ChartOrderTicket({ 
  symbol, 
  currentPrice, 
  onClose, 
  onSubmit,
  className 
}: ChartOrderTicketProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("100");
  const [limitPrice, setLimitPrice] = useState(currentPrice.toString());
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState([1]);

  // Update limit price when current price changes
  useEffect(() => {
    if (orderType === "limit" && !limitPrice) {
      setLimitPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType, limitPrice]);

  // Calculate preview values
  const orderSize = parseFloat(size) || 0;
  const effectiveSize = orderSize * leverage[0];
  const entryPrice = orderType === "market" ? currentPrice : (parseFloat(limitPrice) || currentPrice);
  const estimatedFee = effectiveSize * 0.001; // 0.1% fee
  const totalCost = effectiveSize + estimatedFee;

  // Calculate P&L preview
  const slPrice = parseFloat(stopLoss) || 0;
  const tpPrice = parseFloat(takeProfit) || 0;
  
  const maxLoss = slPrice > 0 
    ? (side === "buy" ? (entryPrice - slPrice) : (slPrice - entryPrice)) * (effectiveSize / entryPrice)
    : 0;
    
  const maxProfit = tpPrice > 0
    ? (side === "buy" ? (tpPrice - entryPrice) : (entryPrice - tpPrice)) * (effectiveSize / entryPrice)
    : 0;

  const riskReward = maxLoss > 0 ? (maxProfit / maxLoss).toFixed(2) : "N/A";

  const handleSubmit = () => {
    const order: OrderData = {
      symbol,
      orderType,
      side,
      size: effectiveSize,
      limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
      stopLoss: slPrice > 0 ? slPrice : undefined,
      takeProfit: tpPrice > 0 ? tpPrice : undefined,
    };
    onSubmit(order);
  };

  const isValid = orderSize > 0 && (orderType === "market" || parseFloat(limitPrice) > 0);

  return (
    <Card 
      className={cn(
        "absolute top-4 right-4 w-80 p-4 space-y-4 z-50 shadow-xl border-2",
        className
      )}
      data-testid="card-chart-order-ticket"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold" data-testid="text-order-ticket-title">
            Quick Order
          </h3>
          <span className="text-sm font-mono text-muted-foreground">
            {symbol}
          </span>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-order-ticket"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Current Price */}
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
        <span className="text-sm text-muted-foreground">Market Price</span>
        <span className="text-lg font-bold font-mono" data-testid="text-market-price">
          ${currentPrice.toLocaleString()}
        </span>
      </div>

      {/* Side Selection */}
      <RadioGroup value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
        <div className="grid grid-cols-2 gap-2">
          <Label
            htmlFor="buy"
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-md border-2 cursor-pointer transition-all",
              side === "buy" 
                ? "border-green-500 bg-green-500/10" 
                : "border-border hover-elevate"
            )}
          >
            <RadioGroupItem value="buy" id="buy" className="sr-only" />
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="font-semibold">Buy</span>
          </Label>
          <Label
            htmlFor="sell"
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-md border-2 cursor-pointer transition-all",
              side === "sell" 
                ? "border-red-500 bg-red-500/10" 
                : "border-border hover-elevate"
            )}
          >
            <RadioGroupItem value="sell" id="sell" className="sr-only" />
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="font-semibold">Sell</span>
          </Label>
        </div>
      </RadioGroup>

      {/* Order Type */}
      <div className="space-y-2">
        <Label>Order Type</Label>
        <RadioGroup value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit")}>
          <div className="grid grid-cols-2 gap-2">
            <Label
              htmlFor="market"
              className={cn(
                "flex items-center justify-center p-2 rounded-md border cursor-pointer",
                orderType === "market" ? "border-primary bg-primary/10" : "border-border hover-elevate"
              )}
            >
              <RadioGroupItem value="market" id="market" className="sr-only" />
              <span className="text-sm">Market</span>
            </Label>
            <Label
              htmlFor="limit"
              className={cn(
                "flex items-center justify-center p-2 rounded-md border cursor-pointer",
                orderType === "limit" ? "border-primary bg-primary/10" : "border-border hover-elevate"
              )}
            >
              <RadioGroupItem value="limit" id="limit" className="sr-only" />
              <span className="text-sm">Limit</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Size Input */}
      <div className="space-y-2">
        <Label htmlFor="size">Size (USD)</Label>
        <Input
          id="size"
          type="number"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="100"
          data-testid="input-order-size"
        />
      </div>

      {/* Limit Price (if limit order) */}
      {orderType === "limit" && (
        <div className="space-y-2">
          <Label htmlFor="limit-price">Limit Price</Label>
          <Input
            id="limit-price"
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder={currentPrice.toString()}
            data-testid="input-limit-price"
          />
        </div>
      )}

      {/* Leverage Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Leverage</Label>
          <span className="text-sm font-bold font-mono" data-testid="text-leverage">
            {leverage[0]}x
          </span>
        </div>
        <Slider
          value={leverage}
          onValueChange={setLeverage}
          min={1}
          max={10}
          step={1}
          data-testid="slider-leverage"
        />
      </div>

      {/* Stop Loss & Take Profit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="stop-loss" className="text-xs">Stop Loss</Label>
          <Input
            id="stop-loss"
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Optional"
            className="h-8"
            data-testid="input-stop-loss"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="take-profit" className="text-xs">Take Profit</Label>
          <Input
            id="take-profit"
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="Optional"
            className="h-8"
            data-testid="input-take-profit"
          />
        </div>
      </div>

      {/* Trade Preview */}
      <div className="space-y-2 p-3 rounded-md bg-muted/50 border">
        <h4 className="text-sm font-semibold">Trade Preview</h4>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Position Size</span>
          <span className="text-right font-mono" data-testid="text-preview-size">
            ${effectiveSize.toFixed(2)}
          </span>

          <span className="text-muted-foreground">Est. Fee (0.1%)</span>
          <span className="text-right font-mono" data-testid="text-preview-fee">
            ${estimatedFee.toFixed(2)}
          </span>

          <span className="text-muted-foreground">Total Cost</span>
          <span className="text-right font-bold font-mono" data-testid="text-preview-total">
            ${totalCost.toFixed(2)}
          </span>
        </div>

        {/* Risk/Reward */}
        {(maxLoss > 0 || maxProfit > 0) && (
          <>
            <div className="h-px bg-border my-2" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              {maxLoss > 0 && (
                <>
                  <span className="text-muted-foreground">Max Loss</span>
                  <span className="text-right font-mono text-red-500" data-testid="text-preview-max-loss">
                    -${maxLoss.toFixed(2)}
                  </span>
                </>
              )}
              
              {maxProfit > 0 && (
                <>
                  <span className="text-muted-foreground">Max Profit</span>
                  <span className="text-right font-mono text-green-500" data-testid="text-preview-max-profit">
                    +${maxProfit.toFixed(2)}
                  </span>
                </>
              )}

              {maxLoss > 0 && maxProfit > 0 && (
                <>
                  <span className="text-muted-foreground">Risk/Reward</span>
                  <span className="text-right font-bold font-mono" data-testid="text-preview-risk-reward">
                    1:{riskReward}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Risk Warning */}
      {leverage[0] > 5 && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            High leverage increases both potential profit and risk
          </p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid}
        className={cn(
          "w-full font-semibold",
          side === "buy" 
            ? "bg-green-500 hover:bg-green-600 text-white" 
            : "bg-red-500 hover:bg-red-600 text-white"
        )}
        data-testid="button-submit-order"
      >
        {side === "buy" ? "Buy" : "Sell"} {symbol}
      </Button>
    </Card>
  );
}
