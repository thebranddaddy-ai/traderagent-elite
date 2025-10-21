import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";

interface LiveTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LiveTradeModal({ open, onOpenChange }: LiveTradeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  
  const [executionToken, setExecutionToken] = useState<string | null>(null);
  const [preCheckResult, setPreCheckResult] = useState<any>(null);
  const [step, setStep] = useState<"order" | "confirm">("order");

  // Pre-check mutation
  const preCheckMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("/api/exchange/execute", "POST", orderData);
    },
    onSuccess: (data: any) => {
      if (data.preCheck.allowed) {
        setExecutionToken(data.token);
        setPreCheckResult(data.preCheck);
        setStep("confirm");
      } else {
        toast({
          title: "Order Rejected",
          description: data.preCheck.reason,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Pre-Check Failed",
        description: error.message || "Failed to validate order",
        variant: "destructive",
      });
    },
  });

  // Confirm execution mutation
  const confirmMutation = useMutation({
    mutationFn: async (confirmData: { exchange: string; token: string }) => {
      return await apiRequest("/api/exchange/confirm", "POST", confirmData);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Trade Executed! 🎉",
          description: `Order ${data.orderId} executed at ${data.executedPrice}`,
        });
        
        // Reset and close
        handleClose();
        queryClient.invalidateQueries({ queryKey: ["/api/paper/orders"] });
      } else {
        toast({
          title: "Execution Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute order",
        variant: "destructive",
      });
    },
  });

  const handlePreCheck = () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (type === "LIMIT" && (!price || parseFloat(price) <= 0)) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid limit price",
        variant: "destructive",
      });
      return;
    }

    preCheckMutation.mutate({
      exchange: "binance",
      symbol,
      side,
      type,
      quantity,
      price: type === "LIMIT" ? price : undefined,
    });
  };

  const handleConfirm = () => {
    if (!executionToken) {
      toast({
        title: "Invalid Token",
        description: "Execution token is missing",
        variant: "destructive",
      });
      return;
    }

    confirmMutation.mutate({
      exchange: "binance",
      token: executionToken,
    });
  };

  const handleClose = () => {
    setSymbol("BTCUSDT");
    setSide("BUY");
    setType("MARKET");
    setQuantity("");
    setPrice("");
    setExecutionToken(null);
    setPreCheckResult(null);
    setStep("order");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === "order" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {side === "BUY" ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                Live Exchange Order
              </DialogTitle>
              <DialogDescription>
                Place a real order on Binance. All trades are verified against Risk Guard limits.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger id="symbol" data-testid="select-symbol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                    <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                    <SelectItem value="SOLUSDT">SOL/USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="side">Side</Label>
                  <Select value={side} onValueChange={(val: any) => setSide(val)}>
                    <SelectTrigger id="side" data-testid="select-side">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">Buy</SelectItem>
                      <SelectItem value="SELL">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Order Type</Label>
                  <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger id="type" data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKET">Market</SelectItem>
                      <SelectItem value="LIMIT">Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.00001"
                  placeholder="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>

              {type === "LIMIT" && (
                <div className="space-y-2">
                  <Label htmlFor="price">Limit Price (USDT)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="50000.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    data-testid="input-price"
                  />
                </div>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Real Money:</strong> This will execute a live trade on Binance using your API keys.
                  Ensure your order details are correct.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-trade">
                Cancel
              </Button>
              <Button
                onClick={handlePreCheck}
                disabled={preCheckMutation.isPending}
                data-testid="button-precheck-trade"
              >
                {preCheckMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Review
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Confirm Execution
              </DialogTitle>
              <DialogDescription>
                Review your order details and confirm to execute on Binance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert className="bg-green-500/10 border-green-500/50">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <strong>Risk Check Passed:</strong> {preCheckResult?.reason}
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Symbol:</span>
                  <span className="font-medium">{symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Side:</span>
                  <span className={`font-medium ${side === "BUY" ? "text-green-500" : "text-red-500"}`}>
                    {side}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{quantity}</span>
                </div>
                {type === "LIMIT" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Limit Price:</span>
                    <span className="font-medium">${price}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Est. Cost:</span>
                  <span className="font-medium">${preCheckResult?.estimatedCost?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Fees:</span>
                  <span className="font-medium">${preCheckResult?.estimatedFees?.toFixed(2)}</span>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. The order will be executed immediately on Binance.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("order")} data-testid="button-back-to-order">
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                variant="default"
                data-testid="button-confirm-execution"
              >
                {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Execute Order
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
