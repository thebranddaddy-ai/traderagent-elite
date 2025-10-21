import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Wallet, TrendingUp, TrendingDown, Plus, ArrowUpDown, Shield, Target, LogOut, Percent, Brain, Activity, Link as LinkIcon, Circle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import PartialExitDialog from "./PartialExitDialog";
import AIExitAdvisorDialog from "./AIExitAdvisorDialog";
import { SiBinance } from "react-icons/si";

interface Asset {
  id?: string;
  symbol: string;
  name?: string;
  quantity: string | number;
  avgPrice: string | number;
  currentPrice: string | number;
  pnl: string | number;
  pnlPercent: string | number;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
}

interface PaperWalletCardProps {
  balance?: number;
  assets?: Asset[];
  onDeposit?: () => void;
  onTrade?: () => void;
  onExitPosition?: (positionId: string, quantity: string) => void;
  exchangeConnected?: boolean;
  exchangeBalance?: number;
  exchangeTestnet?: boolean;
}

export default function PaperWalletCard({ 
  balance = 10000, 
  assets = [],
  onDeposit,
  onTrade,
  onExitPosition,
  exchangeConnected = false,
  exchangeBalance = 0,
  exchangeTestnet = false
}: PaperWalletCardProps) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [partialExitAsset, setPartialExitAsset] = useState<Asset | null>(null);
  const [aiExitAsset, setAiExitAsset] = useState<Asset | null>(null);
  const [connectExchangeOpen, setConnectExchangeOpen] = useState(false);

  // Use props for exchange connection status
  const isExchangeConnected = exchangeConnected;
  const lastConnectedMinutes = 0; // Will show "just now" when connected

  // Format last connected time
  const formatLastConnected = (minutes: number) => {
    if (minutes === 0) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const totalValue = assets.reduce((sum, asset) => {
    const qty = typeof asset.quantity === 'string' ? parseFloat(asset.quantity) : asset.quantity;
    const price = typeof asset.currentPrice === 'string' ? parseFloat(asset.currentPrice) : asset.currentPrice;
    return sum + (qty * price);
  }, 0);
  
  const totalPnL = assets.reduce((sum, asset) => {
    const pnl = typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl;
    return sum + pnl;
  }, 0);

  const totalPnLPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
  const activePositions = assets.length;
  
  // Calculate 24h volume (sum of all position values)
  const volume24h = totalValue;
  const volume24hChange = totalPnLPercent; // Using P&L% as proxy for 24h change

  return (
    <Card data-testid="card-paper-wallet">
      <CardHeader className="pb-3 px-4 pt-4">
        {/* Top Row: Paper Wallet + Exchange Wallet */}
        <div className="grid grid-cols-2 gap-3">
          {/* Paper Wallet Info */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            <Wallet className="h-4 w-4" />
            <div>
              <CardTitle className="text-sm font-semibold">Paper Wallet</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Available ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Exchange Wallet Info */}
          <div 
            className="p-3 rounded-lg border border-border bg-muted/20 hover-elevate active-elevate-2 cursor-pointer" 
            data-testid="exchange-wallet-binance"
            onClick={() => setConnectExchangeOpen(true)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10">
                  <SiBinance className="h-3.5 w-3.5 text-yellow-500" />
                </div>
                <p className="text-sm font-semibold">Binance</p>
              </div>
              {/* Status Indicator */}
              <div className="flex items-center gap-1.5">
                <Circle 
                  className={`h-2 w-2 ${isExchangeConnected ? 'fill-green-500 text-green-500' : 'fill-orange-500 text-orange-500'}`}
                />
                <span className={`text-[9px] font-medium ${isExchangeConnected ? 'text-green-500' : 'text-orange-500'}`}>
                  {isExchangeConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground ml-8">
              {isExchangeConnected 
                ? `${exchangeTestnet ? 'Testnet' : 'Live'} • $${exchangeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                : 'Click to connect'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-3">
          {/* Metric Boxes Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Total Profit */}
            <div className="p-2.5 rounded-lg border border-border bg-card hover-elevate" data-testid="metric-total-profit">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground">Total Profit</p>
              </div>
              <p className={`text-base font-mono font-bold ${totalPnL >= 0 ? 'text-chart-2' : 'text-chart-3'}`} data-testid="text-total-profit">
                ${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-[9px] font-medium ${totalPnL >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                {totalPnL >= 0 ? '+' : '-'}{Math.abs(totalPnLPercent).toFixed(1)}%
              </p>
            </div>

            {/* Active Positions */}
            <div className="p-2.5 rounded-lg border border-border bg-card hover-elevate" data-testid="metric-active-positions">
              <div className="flex items-center gap-1 mb-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground">Active Trades</p>
              </div>
              <p className="text-base font-mono font-bold" data-testid="text-active-positions">
                {activePositions}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {activePositions === 1 ? 'position' : 'positions'}
              </p>
            </div>

            {/* 24h Volume with Link */}
            <Link href="/timeframe-analysis">
              <div className="p-2.5 rounded-lg border border-border bg-card hover-elevate active-elevate-2 cursor-pointer" data-testid="metric-24h-volume">
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[9px] text-muted-foreground">24h Price</p>
                </div>
                <p className="text-base font-mono font-bold" data-testid="text-24h-volume">
                  ${volume24h.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className={`text-[9px] font-medium ${volume24hChange >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                  {volume24hChange >= 0 ? '↑' : '↓'} {Math.abs(volume24hChange).toFixed(1)}%
                </p>
              </div>
            </Link>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium mb-2">Current Holdings</p>
            <ScrollArea className="h-[180px]" data-testid="scroll-holdings">
              {assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <ArrowUpDown className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start trading to build your portfolio</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((asset) => {
                    const hasStopLoss = asset.stopLoss != null;
                    const hasTakeProfit = asset.takeProfit != null;
                    const isExpanded = selectedAsset === asset.symbol;
                    
                    return (
                      <div key={asset.symbol} className="space-y-2">
                        <div
                          onClick={() => setSelectedAsset(selectedAsset === asset.symbol ? null : asset.symbol)}
                          className={`flex items-center justify-between py-2 px-2.5 border-b border-border last:border-0 hover-elevate active-elevate-2 rounded-md cursor-pointer transition-colors ${isExpanded ? 'bg-accent' : ''}`}
                          data-testid={`asset-${asset.symbol.toLowerCase()}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{asset.symbol}</p>
                              <Badge variant="outline" className="text-[10px] h-4">
                                {typeof asset.quantity === 'string' ? parseFloat(asset.quantity) : asset.quantity}
                              </Badge>
                              {(hasStopLoss || hasTakeProfit) && (
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  {hasStopLoss && hasTakeProfit ? 'SL/TP' : hasStopLoss ? 'SL' : 'TP'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{asset.name || asset.symbol}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs">
                              ${typeof asset.currentPrice === 'string' ? parseFloat(asset.currentPrice).toFixed(2) : asset.currentPrice.toFixed(2)}
                            </p>
                            <div className={`text-[10px] flex items-center justify-end gap-1 ${
                              (typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl) >= 0 ? 'text-chart-2' : 'text-chart-3'
                            }`}>
                              {(typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl) >= 0 ? 
                                <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                              {(typeof asset.pnl === 'string' ? parseFloat(asset.pnl) : asset.pnl) >= 0 ? '+' : ''}
                              {typeof asset.pnlPercent === 'string' ? parseFloat(asset.pnlPercent).toFixed(2) : asset.pnlPercent.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="px-2.5 pb-2 space-y-2">
                            {(hasStopLoss || hasTakeProfit) && (
                              <div className="space-y-1">
                                {hasStopLoss && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Shield className="h-2.5 w-2.5 text-destructive" />
                                      <span>Stop-Loss</span>
                                    </div>
                                    <span className="font-mono text-destructive" data-testid={`stop-loss-${asset.symbol.toLowerCase()}`}>
                                      ${typeof asset.stopLoss === 'string' ? parseFloat(asset.stopLoss).toFixed(2) : asset.stopLoss?.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {hasTakeProfit && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Target className="h-2.5 w-2.5 text-chart-2" />
                                      <span>Take-Profit</span>
                                    </div>
                                    <span className="font-mono text-chart-2" data-testid={`take-profit-${asset.symbol.toLowerCase()}`}>
                                      ${typeof asset.takeProfit === 'string' ? parseFloat(asset.takeProfit).toFixed(2) : asset.takeProfit?.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Exit Actions */}
                            <div className="space-y-1.5 pt-1.5 border-t border-border">
                              {/* AI Exit Advisor Button */}
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full h-7 text-[10px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAiExitAsset(asset);
                                }}
                                data-testid={`button-ai-exit-${asset.symbol.toLowerCase()}`}
                              >
                                <Brain className="h-2.5 w-2.5 mr-1" />
                                Ask AI: Should I Exit?
                              </Button>
                              
                              {/* Exit Buttons */}
                              <div className="flex gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="flex-1 h-7 text-[10px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (asset.id && onExitPosition) {
                                      onExitPosition(asset.id, String(asset.quantity));
                                    }
                                  }}
                                  data-testid={`button-exit-${asset.symbol.toLowerCase()}`}
                                >
                                  <LogOut className="h-2.5 w-2.5 mr-1" />
                                  Exit All
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-7 text-[10px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPartialExitAsset(asset);
                                  }}
                                  data-testid={`button-partial-exit-${asset.symbol.toLowerCase()}`}
                                >
                                  <Percent className="h-2.5 w-2.5 mr-1" />
                                  Partial Exit
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-3 px-4 pb-4">
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={() => {
            console.log('Deposit clicked');
            onDeposit?.();
          }}
          data-testid="button-deposit"
        >
          <Plus className="h-4 w-4 mr-2" />
          Deposit
        </Button>
        <Button 
          variant="default" 
          className="flex-1"
          onClick={() => {
            console.log('Trade clicked');
            onTrade?.();
          }}
          data-testid="button-trade"
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Trade
        </Button>
      </CardFooter>

      {/* Partial Exit Dialog */}
      {partialExitAsset && (
        <PartialExitDialog
          asset={partialExitAsset}
          open={!!partialExitAsset}
          onClose={() => setPartialExitAsset(null)}
          onExit={(positionId: string, quantity: string) => {
            if (onExitPosition) {
              onExitPosition(positionId, quantity);
            }
            setPartialExitAsset(null);
          }}
        />
      )}

      {/* AI Exit Advisor Dialog */}
      {aiExitAsset && (
        <AIExitAdvisorDialog
          asset={aiExitAsset}
          open={!!aiExitAsset}
          onClose={() => setAiExitAsset(null)}
          onExitAll={(positionId: string) => {
            if (onExitPosition) {
              onExitPosition(positionId, String(aiExitAsset.quantity));
            }
          }}
          onExitPartial={(asset: Asset) => {
            setPartialExitAsset(asset);
            setAiExitAsset(null);
          }}
        />
      )}

      {/* Connect Exchange Dialog */}
      <Dialog open={connectExchangeOpen} onOpenChange={setConnectExchangeOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-connect-exchange">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Connect Exchange
            </DialogTitle>
            <DialogDescription>
              Link your exchange account to enable live trading
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Binance Option */}
            <div className="p-4 rounded-lg border border-border hover-elevate cursor-pointer" data-testid="exchange-option-binance">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/10">
                    <SiBinance className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Binance</p>
                    <p className="text-xs text-muted-foreground">World's largest exchange</p>
                  </div>
                </div>
                <Circle className="h-2.5 w-2.5 fill-orange-500 text-orange-500" />
              </div>
              <Button className="w-full" variant="outline" size="sm" data-testid="button-connect-binance">
                <LinkIcon className="h-3.5 w-3.5 mr-2" />
                Connect Binance
              </Button>
            </div>

            {/* Info */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground">
                <Shield className="h-3 w-3 inline mr-1" />
                Your API keys are encrypted and stored securely. We never have withdrawal permissions.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
