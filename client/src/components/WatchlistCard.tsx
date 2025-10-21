import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface WatchlistItem {
  id: string;
  symbol: string;
  addedAt: string;
}

interface Props {
  userId: string;
  currentPrices: Record<string, number>;
}

export function WatchlistCard({ userId, currentPrices }: Props) {
  const [newSymbol, setNewSymbol] = useState("");
  const { toast } = useToast();

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist", userId],
  });

  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("/api/watchlist", "POST", { symbol: symbol.toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist", userId] });
      setNewSymbol("");
      toast({ title: "Added to watchlist" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add to watchlist",
        variant: "destructive" 
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist", userId] });
      toast({ title: "Removed from watchlist" });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      addMutation.mutate(newSymbol.trim());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
        <CardDescription>Track your favorite assets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Symbol (e.g., BTC)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            data-testid="input-watchlist-symbol"
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={addMutation.isPending}
            data-testid="button-add-watchlist"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          
          {watchlist.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              No assets in watchlist
            </p>
          )}

          {watchlist.map((item) => {
            const price = currentPrices[item.symbol];
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-md border bg-card"
                data-testid={`watchlist-item-${item.symbol}`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{item.symbol}</Badge>
                  {price && (
                    <span className="text-sm font-mono" data-testid={`price-${item.symbol}`}>
                      ${price.toLocaleString()}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(item.id)}
                  disabled={removeMutation.isPending}
                  data-testid={`button-remove-${item.symbol}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
