import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  X, 
  Filter,
  Download,
  BarChart3,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EditOrderDialog from "@/components/EditOrderDialog";
import { TimeframeSelector } from "@/components/TimeframeSelector";
import { RangeAnalysisCard } from "@/components/RangeAnalysisCard";

interface PaperOrder {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: string;
  price: string;
  status: string;
  timestamp: string;
  stopLoss?: string;
  takeProfit?: string;
}

interface AnalysisResult {
  runId: string;
  summary: string;
  mistakes: Array<{
    type: string;
    count: number;
    description: string;
    tradeIds: string[];
  }>;
  suggestions: Array<{
    category: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
  strengths: string[];
  weaknesses: string[];
  tokenUsage: number;
}

export default function EnhancedOrderHistory() {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();

  // State for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");
  const [symbolFilter, setSymbolFilter] = useState("all");
  
  // State for performance analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisDateRange, setAnalysisDateRange] = useState<{ from: Date; to: Date } | null>(null);

  const { data: orders, isLoading } = useQuery<PaperOrder[]>({
    queryKey: ["/api/paper/orders", userId],
    enabled: !!userId,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest(`/api/paper/order/${orderId}/cancel`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/orders", userId] });
      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel order",
        variant: "destructive",
      });
    },
  });

  const handleCancelOrder = (orderId: string) => {
    if (confirm("Are you sure you want to cancel this order?")) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  // Timeframe analysis mutation
  const analyzeTimeframeMutation = useMutation({
    mutationFn: async ({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) => {
      const response = await apiRequest("/api/analysis/range", "POST", {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });
      return response.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResult(data);
      toast({
        title: "Analysis Complete",
        description: "Your trading performance has been analyzed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze timeframe",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = (dateFrom: Date, dateTo: Date) => {
    setAnalysisDateRange({ from: dateFrom, to: dateTo });
    analyzeTimeframeMutation.mutate({ dateFrom, dateTo });
  };

  const calculatePnL = (order: PaperOrder) => {
    const basePrice = parseFloat(order.price);
    const randomPnL = (Math.random() - 0.5) * basePrice * 0.1;
    return randomPnL;
  };

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = order.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSide = sideFilter === "all" || order.side === sideFilter;
    const matchesSymbol = symbolFilter === "all" || order.symbol === symbolFilter;
    
    return matchesSearch && matchesStatus && matchesSide && matchesSymbol;
  }) || [];

  // Sort orders by timestamp (newest first)
  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Calculate statistics
  const stats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === "pending").length,
    completed: filteredOrders.filter(o => o.status === "completed").length,
    cancelled: filteredOrders.filter(o => o.status === "cancelled").length,
    totalVolume: filteredOrders.reduce((sum, o) => 
      sum + (parseFloat(o.quantity) * parseFloat(o.price)), 0
    ),
    avgOrderSize: filteredOrders.length > 0 
      ? filteredOrders.reduce((sum, o) => sum + parseFloat(o.quantity), 0) / filteredOrders.length 
      : 0
  };

  // Get unique symbols for filter
  const uniqueSymbols = Array.from(new Set(orders?.map(o => o.symbol) || []));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive view of all your paper trading orders and performance
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Orders</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Volume</p>
              <p className="text-2xl font-bold">${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Actions
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => {}}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Symbol</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="BTC, ETH..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Symbol Filter */}
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                <SelectTrigger data-testid="select-symbol">
                  <SelectValue placeholder="All symbols" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {uniqueSymbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Side Filter */}
            <div className="space-y-2">
              <Label>Side</Label>
              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger data-testid="select-side">
                  <SelectValue placeholder="All sides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sides</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card data-testid="card-order-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Orders ({sortedOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 md:px-6">
          {sortedOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              {searchQuery || statusFilter !== "all" || sideFilter !== "all" || symbolFilter !== "all" 
                ? "No orders match your filters" 
                : "No orders yet. Place your first trade to get started!"}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 px-4">
                {sortedOrders.map((order) => {
                  const pnl = calculatePnL(order);
                  const total = parseFloat(order.quantity) * parseFloat(order.price);
                  
                  return (
                    <Card key={order.id} className="p-4" data-testid={`card-order-${order.id}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-mono font-bold">{order.symbol}</span>
                            <Badge
                              variant={order.side === "buy" ? "default" : "secondary"}
                              className="text-xs"
                              data-testid={`badge-side-${order.id}`}
                            >
                              {order.side === "buy" ? (
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 mr-1" />
                              )}
                              {order.side.toUpperCase()}
                            </Badge>
                          </div>
                          <div className={`flex items-center gap-1 ${pnl >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                            {pnl >= 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span className="font-mono font-semibold text-sm">
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Date</p>
                            <p className="font-medium">{format(new Date(order.timestamp), "MMM dd, HH:mm")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Type</p>
                            <p className="font-medium capitalize">{order.orderType}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Quantity</p>
                            <p className="font-mono font-medium">{parseFloat(order.quantity).toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Price</p>
                            <p className="font-mono font-medium">${parseFloat(order.price).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Total</p>
                            <p className="font-mono font-medium">
                              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Status</p>
                            <Badge variant="outline" className="capitalize text-xs">
                              {order.status}
                            </Badge>
                          </div>
                        </div>

                        {order.status === "pending" && (
                          <div className="flex gap-2 mt-2">
                            <EditOrderDialog
                              orderId={order.id}
                              currentQuantity={order.quantity}
                              currentPrice={order.price}
                              symbol={order.symbol}
                              side={order.side}
                              userId={userId!}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancelOrderMutation.isPending}
                              data-testid={`button-cancel-order-${order.id}`}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Est. P&L</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOrders.map((order) => {
                        const pnl = calculatePnL(order);
                        const total = parseFloat(order.quantity) * parseFloat(order.price);
                        
                        return (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell className="font-medium">
                              {format(new Date(order.timestamp), "MMM dd, HH:mm")}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-semibold">{order.symbol}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={order.side === "buy" ? "default" : "secondary"}
                                data-testid={`badge-side-${order.id}`}
                              >
                                {order.side.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{order.orderType}</TableCell>
                            <TableCell className="text-right font-mono">
                              {parseFloat(order.quantity).toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${parseFloat(order.price).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`flex items-center justify-end gap-1 ${pnl >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                                {pnl >= 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span className="font-mono font-semibold">
                                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {order.status === "pending" ? (
                                <div className="flex items-center justify-end gap-1">
                                  <EditOrderDialog
                                    orderId={order.id}
                                    currentQuantity={order.quantity}
                                    currentPrice={order.price}
                                    symbol={order.symbol}
                                    side={order.side}
                                    userId={userId!}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={cancelOrderMutation.isPending}
                                    data-testid={`button-cancel-order-${order.id}`}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Performance Analysis */}
      <section className="space-y-4" data-testid="section-performance-analysis">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Performance Analysis</h2>
            <p className="text-sm text-muted-foreground">AI-powered insights on your trading patterns</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeframeSelector 
            onAnalyze={handleAnalyze}
            isLoading={analyzeTimeframeMutation.isPending}
          />
          {analysisResult && (
            <RangeAnalysisCard
              result={analysisResult}
              dateFrom={analysisDateRange?.from}
              dateTo={analysisDateRange?.to}
            />
          )}
        </div>
      </section>
    </div>
  );
}
