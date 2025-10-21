import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useChartTelemetry } from "./useChartTelemetry";

export interface OHLCVCandle {
  time: number; // UTC seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVResponse {
  success: boolean;
  data: OHLCVCandle[];
  meta: {
    symbol: string;
    interval: string;
    count: number;
    fetchTime: number;
  };
  error?: string;
}

export function useOHLCVData(symbol: string, interval: string, limit: number = 500) {
  const { logOHLCVRequest, logOHLCVSubscribe } = useChartTelemetry();

  // Log subscription when symbol/interval changes
  useEffect(() => {
    if (symbol && interval) {
      logOHLCVSubscribe(symbol, interval);
    }
  }, [symbol, interval, logOHLCVSubscribe]);

  const query = useQuery<OHLCVResponse>({
    queryKey: ["/api/ohlcv", symbol, interval, limit],
    queryFn: async () => {
      const fetchStart = performance.now();
      
      const res = await fetch(`/api/ohlcv/${symbol}/${interval}?limit=${limit}`, {
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      
      const data = await res.json();
      const fetchTime = performance.now() - fetchStart;
      
      // Log telemetry immediately with accurate timing
      console.log(`[OHLCV] Loaded ${data.meta.count} candles in ${fetchTime.toFixed(2)}ms`);
      logOHLCVRequest(
        symbol,
        interval,
        data.meta.count,
        data.meta.fetchTime,
        Math.round(fetchTime)
      );
      
      return data;
    },
    enabled: !!symbol && !!interval,
    staleTime: 5 * 60 * 1000, // 5 minutes - matches server cache TTL
    refetchInterval: 60 * 1000, // Refetch every minute for live updates
  });

  return {
    candles: query.data?.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    meta: query.data?.meta,
  };
}

export function useOHLCVRange(
  symbol: string,
  interval: string,
  from: number,
  to: number,
  enabled: boolean = true
) {
  return useQuery<OHLCVResponse>({
    queryKey: ["/api/ohlcv", symbol, interval, "range", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/ohlcv/${symbol}/${interval}/range?from=${from}&to=${to}`, {
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      
      return res.json();
    },
    enabled: enabled && !!symbol && !!interval && !!from && !!to,
    staleTime: 10 * 60 * 1000, // 10 minutes for historical data
  });
}
