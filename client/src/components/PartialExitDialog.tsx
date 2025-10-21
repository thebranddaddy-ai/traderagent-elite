import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Percent, DollarSign } from "lucide-react";

const partialExitSchema = z.object({
  quantity: z.string().min(1, "Quantity is required"),
});

type PartialExitFormData = z.infer<typeof partialExitSchema>;

interface Asset {
  id?: string;
  symbol: string;
  quantity: string | number;
  currentPrice: string | number;
  avgPrice: string | number;
}

interface PartialExitDialogProps {
  asset: Asset;
  open: boolean;
  onClose: () => void;
  onExit: (positionId: string, quantity: string) => void;
}

export default function PartialExitDialog({
  asset,
  open,
  onClose,
  onExit,
}: PartialExitDialogProps) {
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null);

  const maxQuantity = typeof asset.quantity === 'string' 
    ? parseFloat(asset.quantity) 
    : asset.quantity;
  
  const currentPrice = typeof asset.currentPrice === 'string'
    ? parseFloat(asset.currentPrice)
    : asset.currentPrice;

  const form = useForm<PartialExitFormData>({
    resolver: zodResolver(partialExitSchema),
    defaultValues: {
      quantity: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({ quantity: "" });
      setSelectedPercent(null);
    }
  }, [open, form]);

  const handlePercentClick = (percent: number) => {
    setSelectedPercent(percent);
    const quantity = (maxQuantity * percent / 100).toFixed(8);
    form.setValue("quantity", quantity);
  };

  const handleSubmit = (data: PartialExitFormData) => {
    const quantityNum = parseFloat(data.quantity);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      form.setError("quantity", {
        message: "Quantity must be a positive number",
      });
      return;
    }

    if (quantityNum > maxQuantity) {
      form.setError("quantity", {
        message: `Cannot sell more than ${maxQuantity}`,
      });
      return;
    }

    if (asset.id) {
      onExit(asset.id, data.quantity);
    }
  };

  const currentQuantity = form.watch("quantity");
  const estimatedValue = currentQuantity 
    ? (parseFloat(currentQuantity) * currentPrice).toFixed(2)
    : "0.00";
  
  // Calculate profit/loss on exit
  const avgPrice = typeof asset.avgPrice === 'string'
    ? parseFloat(asset.avgPrice)
    : asset.avgPrice;
  
  const exitQuantity = currentQuantity ? parseFloat(currentQuantity) : 0;
  const exitPnL = exitQuantity * (currentPrice - avgPrice);
  const exitPnLPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-partial-exit">
        <DialogHeader>
          <DialogTitle>Partial Exit - {asset.symbol}</DialogTitle>
          <DialogDescription>
            Sell a portion of your {asset.symbol} holdings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Position Info */}
          <div className="p-3 rounded-md bg-accent space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Holding</span>
              <span className="font-mono font-medium">{maxQuantity.toFixed(8)} {asset.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Price</span>
              <span className="font-mono font-medium">${currentPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Quick Percent Buttons */}
          <div>
            <p className="text-sm font-medium mb-2">Quick Select</p>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((percent) => (
                <Button
                  key={percent}
                  type="button"
                  variant={selectedPercent === percent ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePercentClick(percent)}
                  data-testid={`button-percent-${percent}`}
                >
                  {percent}%
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Entry Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Sell</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type="text"
                          placeholder={`Max: ${maxQuantity}`}
                          data-testid="input-partial-quantity"
                          onChange={(e) => {
                            field.onChange(e);
                            setSelectedPercent(null);
                          }}
                        />
                        <Badge 
                          variant="outline" 
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                        >
                          {asset.symbol}
                        </Badge>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Risk Management - Profit/Loss on Exit */}
              {currentQuantity && parseFloat(currentQuantity) > 0 && (
                <div className="space-y-3">
                  {/* Estimated Value */}
                  <div className="p-3 rounded-md bg-accent border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>Exit Value</span>
                      </div>
                      <span className="text-lg font-mono font-semibold">
                        ${estimatedValue}
                      </span>
                    </div>
                  </div>
                  
                  {/* Profit/Loss Calculation */}
                  <div className={`p-3 rounded-md border ${exitPnL >= 0 ? 'bg-chart-2/10 border-chart-2/20' : 'bg-chart-3/10 border-chart-3/20'}`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Exit Profit/Loss</span>
                        <span className={`text-xl font-mono font-semibold ${exitPnL >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                          {exitPnL >= 0 ? '+' : ''}${exitPnL.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Entry: ${avgPrice.toFixed(2)} → Exit: ${currentPrice.toFixed(2)}</span>
                        <span className={`font-medium ${exitPnL >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                          {exitPnL >= 0 ? '+' : ''}{exitPnLPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel-partial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  data-testid="button-confirm-partial"
                >
                  Sell Position
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
