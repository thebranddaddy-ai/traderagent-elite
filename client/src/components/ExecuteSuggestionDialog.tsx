import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePriceSocket } from "@/hooks/usePriceSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrendingUp, DollarSign, Target, ShieldAlert, Activity } from "lucide-react";

const executeSchema = z.object({
  quantity: z.string().min(1, "Quantity is required"),
});

type ExecuteFormData = z.infer<typeof executeSchema>;

interface Suggestion {
  id: string;
  symbol: string;
  action: string;
  suggestedEntry?: number;
  targetPrice?: number;
  stopLoss?: number;
  riskRewardRatio?: number;
  reasoning: string;
  confidence?: number;
}

interface ExecuteSuggestionDialogProps {
  suggestion: Suggestion;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExecuteSuggestionDialog({
  suggestion,
  userId,
  open,
  onOpenChange,
}: ExecuteSuggestionDialogProps) {
  const { toast } = useToast();
  const { prices, connected } = usePriceSocket();

  const form = useForm<ExecuteFormData>({
    resolver: zodResolver(executeSchema),
    defaultValues: {
      quantity: "0.01",
    },
  });

  const livePrice = prices[suggestion.symbol as keyof typeof prices]?.price || 0;
  const priceChange = prices[suggestion.symbol as keyof typeof prices]?.change || 0;

  const executeTrade = useMutation({
    mutationFn: async (data: ExecuteFormData) => {
      // First, mark suggestion as executed
      await apiRequest(`/api/ai/suggestions/${suggestion.id}/execute`, "PUT");
      
      // Then place the paper trade
      return await apiRequest("/api/paper/order", "POST", {
        userId,
        side: suggestion.action.toLowerCase(),
        symbol: suggestion.symbol,
        quantity: data.quantity,
        orderType: "market",
        stopLoss: suggestion.stopLoss?.toString(),
        takeProfit: suggestion.targetPrice?.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggestions/active", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/orders", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/wallet", userId] });
      toast({
        title: "Trade Executed",
        description: `${suggestion.action.toUpperCase()} order placed for ${suggestion.symbol}`,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute trade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExecuteFormData) => {
    executeTrade.mutate(data);
  };

  const estimatedCost = parseFloat(form.watch("quantity") || "0") * (suggestion.suggestedEntry || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-execute-suggestion">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Execute AI Suggestion
          </DialogTitle>
          <DialogDescription>
            Review and confirm the trade details before execution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Suggestion Summary */}
          <div className="p-4 border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{suggestion.symbol}</span>
                <Badge variant={suggestion.action === 'buy' ? 'default' : 'secondary'}>
                  {suggestion.action.toUpperCase()}
                </Badge>
              </div>
              <Badge variant="outline">
                {suggestion.confidence ? suggestion.confidence.toFixed(0) : 0}% Confidence
              </Badge>
            </div>
            
            {/* Live Price Display */}
            {connected && livePrice > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-green-500/30">
                <Activity className="h-4 w-4 text-green-500" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Live Market Price</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-bold">${livePrice.toLocaleString()}</p>
                    <span className={`text-sm font-mono ${priceChange >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <Badge variant={connected ? "default" : "secondary"} className="gap-1">
                  <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  Live
                </Badge>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Entry Price</p>
                  <p className="font-medium">${suggestion.suggestedEntry ? suggestion.suggestedEntry.toFixed(2) : '0.00'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="font-medium text-green-500">${suggestion.targetPrice ? suggestion.targetPrice.toFixed(2) : '0.00'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Stop Loss</p>
                  <p className="font-medium text-red-500">${suggestion.stopLoss ? suggestion.stopLoss.toFixed(2) : '0.00'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Risk/Reward</p>
                  <p className="font-medium">{suggestion.riskRewardRatio ? suggestion.riskRewardRatio.toFixed(2) : '0.00'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity ({suggestion.symbol})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.00000001"
                        placeholder="0.01"
                        {...field}
                        data-testid="input-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-medium">${estimatedCost.toFixed(2)} USDT</span>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={executeTrade.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={executeTrade.isPending}
                  data-testid="button-confirm-execute"
                >
                  {executeTrade.isPending ? "Executing..." : "Confirm & Execute"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
