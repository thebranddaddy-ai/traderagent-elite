import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export function useTraderData() {
  const { user } = useAuth();
  const userId = user?.id;
  // Trading DNA
  const { data: tradingDNA, isLoading: dnaLoading } = useQuery({
    queryKey: ["/api/users", userId, "dna"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/dna`);
      if (!res.ok) throw new Error("Failed to fetch trading DNA");
      return res.json();
    },
    enabled: !!userId,
  });

  // REMOVED: Paper trading wallet - now using real Binance balance
  // See dashboard.tsx for live balance fetching from /api/exchange/balance
  const walletData = null;
  const walletLoading = false;

  // AI Briefing
  const { data: briefing, isLoading: briefingLoading } = useQuery({
    queryKey: ["/api/ai/briefing", userId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/briefing/${userId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch briefing");
      }
      return res.json();
    },
    enabled: !!userId,
  });

  // Risk Status
  const { data: riskStatus, isLoading: riskLoading } = useQuery({
    queryKey: ["/api/risk/status", userId],
    queryFn: async () => {
      const res = await fetch(`/api/risk/status/${userId}`);
      if (!res.ok) {
        if (res.status === 404) return { tradingPaused: false, status: 'active' };
        throw new Error("Failed to fetch risk status");
      }
      return res.json();
    },
    enabled: !!userId,
  });

  // Place Order Mutation - Now uses LIVE Binance trading
  const placeOrder = useMutation({
    mutationFn: async (orderData: {
      symbol: string;
      side: "buy" | "sell";
      orderType: "market" | "limit";
      quantity: string;
      price?: string;
      stopLoss?: string;
      takeProfit?: string;
    }) => {
      // TODO: Implement real Binance order placement via /api/exchange/execute
      throw new Error("Live trading not yet implemented - connect via Settings first");
    },
    onSuccess: () => {
      // Invalidate exchange orders when live trading is implemented
      queryClient.invalidateQueries({ queryKey: ["/api/exchange/orders", userId] });
    },
  });

  // Generate Briefing Mutation
  const generateBriefing = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ai/briefing", "POST", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/briefing", userId] });
    },
  });

  // Pause Trading Mutation
  const pauseTrading = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/risk/pause", "POST", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/status", userId] });
    },
  });

  // Resume Trading Mutation
  const resumeTrading = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/risk/resume", "POST", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/status", userId] });
    },
  });

  // Add sample trade (for testing)
  const addTrade = useMutation({
    mutationFn: async (tradeData: {
      symbol: string;
      side: "buy" | "sell";
      quantity: string;
      price: string;
      total: string;
      profit?: string;
    }) => {
      return apiRequest("/api/trades", "POST", { userId, ...tradeData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "dna"] });
    },
  });

  return {
    userId,
    tradingDNA,
    walletData,
    briefing,
    riskStatus,
    isLoading: dnaLoading || walletLoading || briefingLoading || riskLoading,
    placeOrder,
    generateBriefing,
    pauseTrading,
    resumeTrading,
    addTrade,
  };
}
