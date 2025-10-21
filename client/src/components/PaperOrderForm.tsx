import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, DollarSign } from "lucide-react";
import { useState } from "react";

interface PaperOrderFormProps {
  onSubmit?: (order: { side: 'buy' | 'sell'; symbol: string; quantity: string; price?: string; orderType: 'market' | 'limit'; stopLoss?: string; takeProfit?: string }) => void;
}

export default function PaperOrderForm({ onSubmit }: PaperOrderFormProps) {
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!symbol || symbol.trim() === '') {
      alert('Please enter a symbol (e.g., BTC, ETH, SOL)');
      return;
    }
    
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter an amount greater than 0');
      return;
    }
    
    if (orderType === 'limit') {
      const priceNum = parseFloat(price);
      if (!price || isNaN(priceNum) || priceNum <= 0) {
        alert('Please enter a price greater than 0 for limit orders');
        return;
      }
    }
    
    onSubmit?.({
      side: orderSide,
      symbol: symbol.toUpperCase(),
      quantity: amount,
      price: orderType === 'limit' ? price : undefined,
      orderType,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
    });
    
    // Reset form
    setSymbol('');
    setAmount('');
    setPrice('');
    setStopLoss('');
    setTakeProfit('');
  };

  return (
    <Card data-testid="card-paper-order-form">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Side Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={orderSide === 'buy' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setOrderSide('buy')}
              data-testid="button-buy"
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Buy
            </Button>
            <Button
              type="button"
              variant={orderSide === 'sell' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setOrderSide('sell')}
              data-testid="button-sell"
            >
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Sell
            </Button>
          </div>

          {/* Order Type Segmented Control */}
          <div className="flex gap-2 p-1 bg-muted rounded-md">
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${orderType === 'market' ? 'bg-background shadow-sm' : 'hover-elevate'}`}
              data-testid="button-market"
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${orderType === 'limit' ? 'bg-background shadow-sm' : 'hover-elevate'}`}
              data-testid="button-limit"
            >
              Limit
            </button>
          </div>

          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., BTC, ETH, SOL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              data-testid="input-symbol"
              required
            />
          </div>

          {/* Amount and Price Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-amount"
                required
              />
            </div>
            {orderType === 'limit' && (
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-9"
                    data-testid="input-price"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stop-Loss and Take-Profit (only for buy orders) */}
          {orderSide === 'buy' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stopLoss">Stop-Loss (Optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="stopLoss"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="pl-9"
                    data-testid="input-stop-loss"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="takeProfit">Take-Profit (Optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="takeProfit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="pl-9"
                    data-testid="input-take-profit"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Order Summary */}
          {symbol && amount && (
            <div className="bg-muted p-3 rounded-md space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-medium" data-testid="text-total">
                  ${orderType === 'limit' && price ? (parseFloat(amount) * parseFloat(price)).toFixed(2) : 'Market Price'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Type</span>
                <Badge variant="outline" data-testid="badge-order-type">{orderType.toUpperCase()}</Badge>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            variant={orderSide === 'buy' ? 'default' : 'destructive'}
            data-testid="button-submit-order"
          >
            Place {orderSide.toUpperCase()} Order
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
