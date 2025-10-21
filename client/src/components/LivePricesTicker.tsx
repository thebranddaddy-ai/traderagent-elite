import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, Search, TrendingUp } from "lucide-react";
import { usePriceSocket } from "@/hooks/usePriceSocket";
import { 
  SiBitcoin, 
  SiEthereum, 
  SiSolana, 
  SiCardano, 
  SiPolkadot, 
  SiChainlink, 
  SiRipple,
  SiLitecoin,
  SiDogecoin,
} from "react-icons/si";

// Comprehensive coin metadata
const COIN_DATA = {
  BTC: { name: "Bitcoin", icon: SiBitcoin, color: "#F7931A" },
  ETH: { name: "Ethereum", icon: SiEthereum, color: "#627EEA" },
  SOL: { name: "Solana", icon: SiSolana, color: "#9945FF" },
  ADA: { name: "Cardano", icon: SiCardano, color: "#0033AD" },
  AVAX: { name: "Avalanche", icon: Activity, color: "#E84142" },
  MATIC: { name: "Polygon", icon: Activity, color: "#8247E5" },
  DOT: { name: "Polkadot", icon: SiPolkadot, color: "#E6007A" },
  LINK: { name: "Chainlink", icon: SiChainlink, color: "#2A5ADA" },
  XRP: { name: "Ripple", icon: SiRipple, color: "#00AAE4" },
  BNB: { name: "BNB", icon: Activity, color: "#F3BA2F" },
  DOGE: { name: "Dogecoin", icon: SiDogecoin, color: "#C2A633" },
  TRX: { name: "Tron", icon: Activity, color: "#FF060A" },
  LTC: { name: "Litecoin", icon: SiLitecoin, color: "#345D9D" },
  UNI: { name: "Uniswap", icon: Activity, color: "#FF007A" },
  ATOM: { name: "Cosmos", icon: Activity, color: "#2E3148" },
  ALGO: { name: "Algorand", icon: Activity, color: "#000000" },
  XLM: { name: "Stellar", icon: Activity, color: "#14B6E7" },
  FIL: { name: "Filecoin", icon: Activity, color: "#0090FF" },
  APT: { name: "Aptos", icon: Activity, color: "#00D4AA" },
  NEAR: { name: "NEAR", icon: Activity, color: "#00C1DE" },
};

interface LivePricesTickerProps {
  onTradeClick?: (symbol: string) => void;
}

export default function LivePricesTicker({ onTradeClick }: LivePricesTickerProps) {
  const { prices, connected } = usePriceSocket();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allSymbols = Object.keys(COIN_DATA) as (keyof typeof COIN_DATA)[];
  
  // Show only first 5 coins by default (sorted by market cap/popularity)
  const defaultSymbols = ["BTC", "ETH", "SOL", "BNB", "XRP"] as (keyof typeof COIN_DATA)[];

  // Filter coins based on search query
  const filteredSymbols = allSymbols.filter((symbol) => {
    const coinInfo = COIN_DATA[symbol];
    const query = searchQuery.toLowerCase();
    return (
      symbol.toLowerCase().includes(query) ||
      coinInfo.name.toLowerCase().includes(query)
    );
  });

  const handleRowClick = (symbol: string) => {
    console.log('LivePricesTicker - handleRowClick called with symbol:', symbol);
    if (onTradeClick) {
      console.log('LivePricesTicker - Calling onTradeClick with symbol:', symbol);
      onTradeClick(symbol);
      setSearchOpen(false);
    }
  };

  const renderCoinRow = (symbol: keyof typeof COIN_DATA) => {
    const priceData = prices[symbol];
    const coinInfo = COIN_DATA[symbol];
    const CoinIcon = coinInfo.icon;

    if (!priceData) return null;

    const isPositive = priceData.changePercent >= 0;

    return (
      <TableRow 
        key={symbol} 
        data-testid={`row-${symbol}`} 
        className="hover-elevate cursor-pointer"
        onClick={() => handleRowClick(symbol)}
      >
        <TableCell className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full"
              style={{ backgroundColor: `${coinInfo.color}20` }}
            >
              <CoinIcon className="h-3.5 w-3.5" style={{ color: coinInfo.color }} />
            </div>
            <div>
              <div className="font-semibold text-xs" data-testid={`symbol-${symbol}`}>
                {symbol}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {coinInfo.name}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right py-3 px-2">
          <div className="font-semibold text-xs" data-testid={`price-value-${symbol}`}>
            ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </TableCell>
        <TableCell className="text-center py-3 px-2">
          <span
            className={`font-semibold text-xs ${isPositive ? 'text-chart-2' : 'text-chart-3'}`}
            data-testid={`change-${symbol}`}
          >
            {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
          </span>
        </TableCell>
        <TableCell className="text-center py-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleRowClick(symbol);
            }}
            data-testid={`button-trade-${symbol}`}
          >
            <TrendingUp className="h-3 w-3 text-primary" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card data-testid="card-live-prices" className="h-[300px] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3 px-4 pt-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Live Market
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "default" : "secondary"} className="text-xs" data-testid="badge-connection-status">
            {connected ? "🟢 Live" : "⚪ Connecting..."}
          </Badge>
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                data-testid="button-search-coins"
              >
                <Search className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Search Cryptocurrencies</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-2">
                <Input
                  placeholder="Search by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="input-search-coins"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <Table>
                  <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="w-[200px] py-2 px-4">Coin</TableHead>
                      <TableHead className="text-right py-2 px-2">Price</TableHead>
                      <TableHead className="text-center py-2 px-2">24h Change</TableHead>
                      <TableHead className="text-center w-[60px] py-2 px-4">Trade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSymbols.length > 0 ? (
                      filteredSymbols.map((symbol) => renderCoinRow(symbol))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No coins found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          className="relative overflow-y-auto card-scroll" 
          data-testid="scrollable-table-container"
          style={{ height: "232px" }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-[5] border-b">
              <TableRow>
                <TableHead className="w-[140px] py-2 px-4 text-xs font-medium">
                  Coin
                </TableHead>
                <TableHead className="text-right py-2 px-2 text-xs font-medium">
                  Price
                </TableHead>
                <TableHead className="text-center py-2 px-2 text-xs font-medium">
                  24h
                </TableHead>
                <TableHead className="text-center w-[60px] py-2 px-4 text-xs font-medium">Trade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaultSymbols.map((symbol) => renderCoinRow(symbol))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
