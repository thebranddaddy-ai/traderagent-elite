import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Link as LinkIcon, Settings, Coins, Building2, Anchor, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ExchangeSelectionDialog } from "./ExchangeSelectionDialog";
import { BinanceConnectDialog } from "./BinanceConnectDialog";

export function ExchangeConnectPanel() {
  const { user } = useAuth();
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [binanceDialogOpen, setBinanceDialogOpen] = useState(false);

  // Fetch exchange status
  const { data: exchangeStatus, isLoading } = useQuery<Array<{
    exchange: string;
    connected: boolean;
    permissions: string;
    lastValidated?: Date | null;
  }>>({
    queryKey: ["/api/exchange/status", user?.id],
    enabled: !!user?.id,
  });

  const binanceConnected = exchangeStatus?.some(
    (e) => e.exchange === "binance" && e.connected
  );

  const handleSelectExchange = (exchange: string) => {
    setSelectionDialogOpen(false);
    
    // Open the appropriate connection dialog based on selected exchange
    if (exchange === "binance") {
      setBinanceDialogOpen(true);
    }
    // Add more exchanges here when supported
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Exchange Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Live Exchange Integration
          </CardTitle>
          <CardDescription>
            Connect your exchange account to execute real trades with advanced security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected Exchanges */}
          {binanceConnected && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border hover-elevate">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div>
                  <p className="font-semibold">Binance</p>
                  <p className="text-xs text-muted-foreground">
                    Testnet • Spot Trading
                  </p>
                </div>
              </div>
              <Badge variant="default" className="gap-1.5" data-testid="badge-exchange-connected">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </Badge>
            </div>
          )}

          {/* Connection Actions */}
          {!binanceConnected ? (
            <div className="space-y-3">
              <Button 
                onClick={() => setSelectionDialogOpen(true)} 
                className="w-full"
                data-testid="button-connect-exchange"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect Exchange
              </Button>

              {/* Quick Info */}
              <div className="text-xs text-muted-foreground space-y-2 pt-1">
                <p className="font-medium text-foreground">Supported Exchanges:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1.5">
                    <Coins className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                    Binance
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 opacity-60">
                    <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-500" />
                    Coinbase (Soon)
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 opacity-60">
                    <Anchor className="h-3 w-3 text-purple-600 dark:text-purple-500" />
                    Kraken (Soon)
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 opacity-60">
                    <Zap className="h-3 w-3 text-orange-600 dark:text-orange-500" />
                    Bybit (Soon)
                  </Badge>
                </div>
                <div className="pt-2 space-y-1">
                  <p className="font-medium text-foreground">Why connect?</p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>Execute real trades directly from TraderAgent</li>
                    <li>All orders protected by Risk Guard limits</li>
                    <li>2-step confirmation for every trade</li>
                    <li>API keys encrypted with AES-256-GCM</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✓ Your Binance account is connected and ready for live trading
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All trades will respect your Risk Guard limits and require confirmation
                </p>
              </div>
              <Button variant="outline" size="sm" data-testid="button-manage-connection">
                <Settings className="h-4 w-4 mr-2" />
                Manage Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exchange Selection Dialog (Step 1) */}
      <ExchangeSelectionDialog 
        open={selectionDialogOpen} 
        onOpenChange={setSelectionDialogOpen}
        onSelectExchange={handleSelectExchange}
      />

      {/* Binance Connect Dialog (Step 2) */}
      <BinanceConnectDialog 
        open={binanceDialogOpen} 
        onOpenChange={setBinanceDialogOpen}
      />
    </>
  );
}
