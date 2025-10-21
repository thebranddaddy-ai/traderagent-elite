import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, X, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PriceAlert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  targetPrice: string;
  isActive: boolean;
  triggered: boolean;
  createdAt: string;
}

interface Props {
  userId: string;
}

const SYMBOLS = ["BTC", "ETH", "SOL"];

export function PriceAlertsCard({ userId }: Props) {
  const [symbol, setSymbol] = useState("BTC");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = useState("");
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ["/api/alerts", userId],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/alerts", "POST", {
        symbol,
        condition,
        targetPrice: parseFloat(targetPrice),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts", userId] });
      setTargetPrice("");
      toast({ title: "Alert created" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create alert",
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts", userId] });
      toast({ title: "Alert deleted" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPrice && parseFloat(targetPrice) > 0) {
      createMutation.mutate();
    }
  };

  const activeAlerts = alerts.filter(a => a.isActive && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Price Alerts
        </CardTitle>
        <CardDescription>Get notified when prices hit targets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-2">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-24" data-testid="select-alert-symbol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={condition} onValueChange={(v) => setCondition(v as "above" | "below")}>
              <SelectTrigger className="w-28" data-testid="select-alert-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Above</SelectItem>
                <SelectItem value="below">Below</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              step="0.01"
              placeholder="Price"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              data-testid="input-alert-price"
              className="flex-1"
            />

            <Button 
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-create-alert"
            >
              Create
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {activeAlerts.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">No active alerts</p>
          )}

          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-md border bg-card"
              data-testid={`alert-${alert.id}`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">{alert.symbol}</Badge>
                {alert.condition === "above" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  {alert.condition} ${parseFloat(alert.targetPrice).toLocaleString()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(alert.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-alert-${alert.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {triggeredAlerts.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-semibold mb-2">Triggered</p>
              {triggeredAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 mb-1"
                  data-testid={`triggered-alert-${alert.id}`}
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{alert.symbol}</Badge>
                    <span>{alert.condition} ${parseFloat(alert.targetPrice).toLocaleString()}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(alert.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
