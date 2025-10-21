import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, UTCTimestamp, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  LineChart as LineChartIcon, 
  BarChart3, 
  Activity,
  Timer,
  Maximize2,
  Settings2,
  Save,
  ShoppingCart
} from "lucide-react";
import { ChartOrderTicket, OrderData } from "./ChartOrderTicket";
import { ChartDrawingTools, Drawing } from "./ChartDrawingTools";
import { ChartLegend } from "./ChartLegend";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateAllIndicators, IndicatorData, calculateBollingerBands, calculateRSI, calculateMACD, calculateEMA } from "@/lib/indicators";
import { MultiPanelChart } from "./chart-panels/MultiPanelChart";
import { useChartTelemetry } from "@/hooks/useChartTelemetry";
import { useOHLCVData } from "@/hooks/useOHLCVData";
import IndicatorsWorker from "@/workers/indicators.worker?worker";

interface TradingChartProps {
  symbol?: string;
  prices: Record<string, number>;
  onSymbolChange?: (symbol: string) => void;
  height?: number;
}

type ChartType = "candlestick" | "line" | "area";
type Timeframe = "1M" | "5M" | "15M" | "1H" | "4H" | "1D";
type IndicatorView = "overview" | "rsi" | "macd" | "bollinger";

interface PerformanceMetrics {
  renderTime: number;
  lastTickLatency: number;
  updateCount: number;
  dataLoadTime?: number;
  candleCount?: number;
}

interface IndicatorSettings {
  rsi: { period: number };
  macd: { fast: number; slow: number; signal: number };
  bollinger: { period: number; stdDev: number };
  ema: { period: number };
  stochastic: { kPeriod: number; dPeriod: number };
}

export function TradingChart({ 
  symbol = "BTC", 
  prices, 
  onSymbolChange,
  height = 500 
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const bollingerSeriesRef = useRef<{ upper: any; middle: any; lower: any }>({ upper: null, middle: null, lower: null });
  const maSeriesRef = useRef<Map<string, any>>(new Map()); // Store MA overlay series by key (e.g., "sma7", "ema25")
  const indicatorsWorkerRef = useRef<Worker | null>(null);
  const maOverlaysRef = useRef<string[]>([]); // Track current MA overlays for worker handler
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [indicatorView, setIndicatorView] = useState<IndicatorView>("overview");
  const [indicators, setIndicators] = useState<string[]>([]);
  const [maOverlays, setMaOverlays] = useState<string[]>([]); // MA overlays toggle state
  const [indicatorSettings, setIndicatorSettings] = useState<IndicatorSettings>({
    rsi: { period: 14 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bollinger: { period: 20, stdDev: 2 },
    ema: { period: 20 },
    stochastic: { kPeriod: 14, dPeriod: 3 },
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    lastTickLatency: 0,
    updateCount: 0,
  });
  const [showOrderTicket, setShowOrderTicket] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorData>({});
  const [priceScale, setPriceScale] = useState({ min: 0, max: 0 });
  const [timeScale, setTimeScale] = useState({ min: 0, max: 0 });
  const [overlayDimensions, setOverlayDimensions] = useState({ width: 0, height: 0 });
  const [legendValues, setLegendValues] = useState<{
    price: number | null;
    maValues: Array<{ label: string; value: number | null; color: string }>;
    bollinger: { upper: number | null; middle: number | null; lower: number | null } | null;
    obvValue: number | null;
  }>({
    price: null,
    maValues: [],
    bollinger: null,
    obvValue: null,
  });
  const { toast } = useToast();
  const lastPriceRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const dataPointsRef = useRef<Map<number, CandlestickData>>(new Map());
  const { logIndicatorToggle, logTimeframeChange, logChartTypeChange, logIndicatorParamsChange, logLayoutSaved } = useChartTelemetry();
  const prevChartTypeRef = useRef<ChartType>(chartType);
  const prevTimeframeRef = useRef<Timeframe>(timeframe);

  // Map timeframe to Binance interval format
  const getBinanceInterval = (tf: Timeframe): string => {
    const map: Record<Timeframe, string> = {
      "1M": "1m",
      "5M": "5m",
      "15M": "15m",
      "1H": "1h",
      "4H": "4h",
      "1D": "1d",
    };
    return map[tf] || "1h";
  };

  // Fetch real OHLCV data from Binance
  const { candles, isLoading: isLoadingOHLCV, meta: ohlcvMeta } = useOHLCVData(
    symbol,
    getBinanceInterval(timeframe),
    500
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const startTime = performance.now();
    
    // Set initial overlay dimensions
    setOverlayDimensions({
      width: chartContainerRef.current.clientWidth,
      height,
    });

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "#1F2937" },
        horzLines: { color: "#1F2937" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Initialize series based on chart type
    updateChartSeries(chartType);

    // Measure render time
    const renderTime = Math.round(performance.now() - startTime);
    setPerformanceMetrics(prev => ({ ...prev, renderTime }));

    // Log to console for QA validation
    console.log(`[Chart Performance] Initial render: ${renderTime}ms`);

    // Handle resize - update both chart and overlay dimensions
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth;
        chart.applyOptions({
          width: newWidth,
        });
        setOverlayDimensions({
          width: newWidth,
          height,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height]);

  // Sync maOverlaysRef with state
  useEffect(() => {
    maOverlaysRef.current = maOverlays;
  }, [maOverlays]);

  // Clean up legend and series when MA overlays are toggled off
  useEffect(() => {
    // Remove series and legend entries for disabled overlays
    const maConfig: Record<string, string> = {
      'sma7': 'SMA(7)', 'sma25': 'SMA(25)', 'sma99': 'SMA(99)',
      'ema7': 'EMA(7)', 'ema25': 'EMA(25)', 'ema99': 'EMA(99)',
    };
    
    maSeriesRef.current.forEach((series, key) => {
      if (!maOverlays.includes(key)) {
        if (chartRef.current) {
          chartRef.current.removeSeries(series);
        }
        maSeriesRef.current.delete(key);
        
        // Remove from legend (maValues is an array)
        const label = maConfig[key];
        if (label) {
          setLegendValues(prev => ({
            ...prev,
            maValues: prev.maValues.filter(v => v.label !== label)
          }));
        }
      }
    });
  }, [maOverlays]);

  // Initialize indicators worker
  useEffect(() => {
    const worker = new IndicatorsWorker();
    indicatorsWorkerRef.current = worker;

    // Handle worker messages
    worker.onmessage = (e) => {
      const { type, data: result, requestId, calcTime } = e.data;
      
      if (type === 'sma' || type === 'ema') {
        // Extract period from requestId (format: "type-period")
        const period = requestId ? parseInt(requestId.split('-')[1]) : 0;
        const key = `${type}${period}`;
        
        if (!chartRef.current || !maOverlaysRef.current.includes(key) || !result) return;

        // Update or create MA series
        let series = maSeriesRef.current.get(key);
        if (!series) {
          const colors: Record<string, string> = {
            'sma7': '#F59E0B', 'sma25': '#8B5CF6', 'sma99': '#EC4899',
            'ema7': '#10B981', 'ema25': '#3B82F6', 'ema99': '#EF4444',
          };
          series = chartRef.current.addSeries(LineSeries, {
            color: colors[key] || '#3B82F6',
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          maSeriesRef.current.set(key, series);
        }
        series.setData(result);

        // Update legend with latest MA value
        if (result.length > 0) {
          const latestMA = result[result.length - 1].value;
          setLegendValues(prev => {
            const maConfig: Record<string, { label: string; color: string }> = {
              'sma7': { label: 'SMA(7)', color: '#F59E0B' },
              'sma25': { label: 'SMA(25)', color: '#8B5CF6' },
              'sma99': { label: 'SMA(99)', color: '#EC4899' },
              'ema7': { label: 'EMA(7)', color: '#10B981' },
              'ema25': { label: 'EMA(25)', color: '#3B82F6' },
              'ema99': { label: 'EMA(99)', color: '#EF4444' },
            };
            const config = maConfig[key];
            
            // Update or add MA value
            const existingIndex = prev.maValues.findIndex(v => v.label === config?.label);
            const newMaValues = [...prev.maValues];
            const maEntry = { label: config?.label || key, value: latestMA, color: config?.color || '#666' };
            
            if (existingIndex >= 0) {
              newMaValues[existingIndex] = maEntry;
            } else {
              newMaValues.push(maEntry);
            }
            
            return { ...prev, maValues: newMaValues };
          });
        }
      } else if (type === 'obv') {
        // Update legend with latest OBV value
        if (result && result.length > 0) {
          const latestOBV = result[result.length - 1].value;
          setLegendValues(prev => ({
            ...prev,
            obvValue: latestOBV
          }));
        }
      }
    };

    return () => {
      worker.terminate();
      indicatorsWorkerRef.current = null;
    };
  }, [maOverlays]);

  // Calculate MA overlays using worker when data or overlays change
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    
    // Remove MA series that are no longer enabled
    maSeriesRef.current.forEach((series, key) => {
      if (!maOverlays.includes(key)) {
        try {
          chartRef.current?.removeSeries(series);
          maSeriesRef.current.delete(key);
          console.log(`[MA] Removed ${key} overlay`);
        } catch (e) {
          console.log(`[MA] Error removing ${key}:`, e);
        }
      }
    });

    if (!indicatorsWorkerRef.current || dataArray.length === 0 || maOverlays.length === 0) return;

    const startTime = performance.now();
    
    // Send calculation requests for each enabled MA overlay
    maOverlays.forEach(overlay => {
      const match = overlay.match(/(sma|ema)(\d+)/);
      if (!match) return;
      
      const [, type, periodStr] = match;
      const period = parseInt(periodStr);
      
      indicatorsWorkerRef.current!.postMessage({
        type,
        data: dataArray,
        params: { period },
        requestId: `${type}-${period}`,
      });
    });

    // Log calculation dispatch time
    console.log(`[MA Worker] Dispatched ${maOverlays.length} MA calculations in ${Math.round(performance.now() - startTime)}ms`);
  }, [dataPointsRef.current.size, maOverlays]);

  // Calculate OBV using worker when data changes or OBV is toggled
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    
    if (!indicators.includes('obv')) {
      // Clear OBV value from legend when disabled
      setLegendValues(prev => ({ ...prev, obvValue: null }));
      return;
    }

    if (!indicatorsWorkerRef.current || dataArray.length === 0) return;

    // Dispatch OBV calculation to worker
    indicatorsWorkerRef.current.postMessage({
      type: 'obv',
      data: dataArray,
      params: {},
      requestId: 'obv',
    });
  }, [dataPointsRef.current.size, indicators]);

  // Update chart series when type changes
  const updateChartSeries = useCallback((type: ChartType) => {
    if (!chartRef.current) return;

    // Remove old series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    // Create new series based on type
    if (type === "candlestick") {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#10B981",
        downColor: "#EF4444",
        borderUpColor: "#10B981",
        borderDownColor: "#EF4444",
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });
    } else if (type === "line") {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: "#3B82F6",
        lineWidth: 2,
      });
    } else if (type === "area") {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        topColor: "rgba(59, 130, 246, 0.5)",
        bottomColor: "rgba(59, 130, 246, 0.05)",
        lineColor: "#3B82F6",
        lineWidth: 2,
      });
    }

    // Reload data for new series
    const dataArray = Array.from(dataPointsRef.current.values());
    if (dataArray.length > 0 && seriesRef.current) {
      if (type === "candlestick") {
        seriesRef.current.setData(dataArray);
      } else {
        // Convert candlestick data to line/area data (use close price)
        const lineData: LineData[] = dataArray.map(d => ({
          time: d.time,
          value: d.close,
        }));
        seriesRef.current.setData(lineData);
      }
    }
  }, []);

  // Handle chart type change
  useEffect(() => {
    updateChartSeries(chartType);
  }, [chartType, updateChartSeries]);

  // Load historical OHLCV data from Binance
  useEffect(() => {
    if (!candles || candles.length === 0 || !seriesRef.current) return;

    const loadStart = performance.now();

    // Convert OHLCV candles to chart format and store in dataPointsRef
    dataPointsRef.current.clear();
    candles.forEach(candle => {
      const candleTime = candle.time * 1000; // Convert seconds to ms for Map key
      const chartCandle: any = {
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: (candle as any).volume || 0, // Preserve volume if available
      };
      dataPointsRef.current.set(candleTime, chartCandle);
    });

    // Load data into chart series
    const dataArray = Array.from(dataPointsRef.current.values());
    if (chartType === "candlestick") {
      seriesRef.current.setData(dataArray);
    } else {
      // Convert to line/area data
      const lineData: LineData[] = dataArray.map(d => ({
        time: d.time,
        value: d.close,
      }));
      seriesRef.current.setData(lineData);
    }

    const loadTime = Math.round(performance.now() - loadStart);
    console.log(`[Chart] Loaded ${candles.length} historical candles in ${loadTime}ms`);

    // Update performance metrics
    setPerformanceMetrics(prev => ({ 
      ...prev, 
      dataLoadTime: loadTime,
      candleCount: candles.length 
    }));

  }, [candles, chartType]);


  // Update chart with live prices
  useEffect(() => {
    const price = prices[symbol];
    if (!price || !seriesRef.current) return;

    const now = Date.now();
    const tickStart = performance.now();

    // Calculate candle time based on timeframe
    const getCandleTime = (time: number, tf: Timeframe): number => {
      const intervals: Record<Timeframe, number> = {
        "1M": 60 * 1000,
        "5M": 5 * 60 * 1000,
        "15M": 15 * 60 * 1000,
        "1H": 60 * 60 * 1000,
        "4H": 4 * 60 * 60 * 1000,
        "1D": 24 * 60 * 60 * 1000,
      };
      return Math.floor(time / intervals[tf]) * intervals[tf];
    };

    const candleTime = getCandleTime(now, timeframe);
    const candleTimestamp = Math.floor(candleTime / 1000) as UTCTimestamp;

    // Get or create candle
    let candle = dataPointsRef.current.get(candleTime);
    
    if (!candle) {
      // New candle
      candle = {
        time: candleTimestamp,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0, // Initialize volume for live candles (will be 0 for simulated)
      } as any;
      dataPointsRef.current.set(candleTime, candle);
    } else {
      // Update existing candle
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
    }

    // Update chart (candle is guaranteed to exist at this point)
    if (candle && chartType === "candlestick") {
      seriesRef.current.update(candle);
    } else if (candle) {
      seriesRef.current.update({
        time: candleTimestamp,
        value: price,
      });
    }

    // Measure tick latency
    const tickLatency = Math.round(performance.now() - tickStart);
    const timeSinceLastUpdate = lastUpdateRef.current ? now - lastUpdateRef.current : 0;

    setPerformanceMetrics(prev => ({
      renderTime: prev.renderTime,
      lastTickLatency: tickLatency,
      updateCount: prev.updateCount + 1,
    }));

    // Log performance (throttled to avoid console spam)
    if (performanceMetrics.updateCount % 10 === 0) {
      console.log(`[Chart Performance] Tick latency: ${tickLatency}ms | Updates: ${performanceMetrics.updateCount + 1}`);
    }

    lastPriceRef.current = price;
    lastUpdateRef.current = now;

    // Keep only last 500 candles for performance
    if (dataPointsRef.current.size > 500) {
      const oldestTime = Math.min(...Array.from(dataPointsRef.current.keys()));
      dataPointsRef.current.delete(oldestTime);
    }
  }, [prices[symbol], symbol, timeframe, chartType]);

  const toggleIndicator = (indicator: string) => {
    setIndicators(prev => {
      const isEnabled = prev.includes(indicator);
      const newIndicators = isEnabled
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator];
      
      // Log telemetry
      logIndicatorToggle(indicator, !isEnabled);
      
      return newIndicators;
    });
  };

  // Log chart type changes
  useEffect(() => {
    if (prevChartTypeRef.current !== chartType) {
      logChartTypeChange(prevChartTypeRef.current, chartType);
      prevChartTypeRef.current = chartType;
    }
  }, [chartType, logChartTypeChange]);

  // Log timeframe changes
  useEffect(() => {
    if (prevTimeframeRef.current !== timeframe) {
      logTimeframeChange(prevTimeframeRef.current, timeframe);
      prevTimeframeRef.current = timeframe;
    }
  }, [timeframe, logTimeframeChange]);

  // Render Bollinger Bands on chart
  const renderBollingerBands = useCallback((data: CandlestickData[]) => {
    if (!chartRef.current || indicatorView !== "bollinger") {
      // Clean up if not in Bollinger view
      if (bollingerSeriesRef.current.upper) {
        try {
          chartRef.current?.removeSeries(bollingerSeriesRef.current.upper);
          chartRef.current?.removeSeries(bollingerSeriesRef.current.middle);
          chartRef.current?.removeSeries(bollingerSeriesRef.current.lower);
        } catch (e) {
          console.log("[Bollinger] Error cleaning up series:", e);
        }
        bollingerSeriesRef.current = { upper: null, middle: null, lower: null };
      }
      return;
    }

    // Remove existing Bollinger series
    if (bollingerSeriesRef.current.upper) {
      try {
        chartRef.current.removeSeries(bollingerSeriesRef.current.upper);
        chartRef.current.removeSeries(bollingerSeriesRef.current.middle);
        chartRef.current.removeSeries(bollingerSeriesRef.current.lower);
      } catch (e) {
        console.log("[Bollinger] Error removing series:", e);
      }
      bollingerSeriesRef.current = { upper: null, middle: null, lower: null };
    }

    // Need enough data for calculation
    if (data.length < indicatorSettings.bollinger.period) {
      console.log(`[Bollinger] Insufficient data: ${data.length} < ${indicatorSettings.bollinger.period}`);
      return;
    }

    // Calculate Bollinger Bands for all data points
    const bollingerData: { time: number; upper: number; middle: number; lower: number }[] = [];
    
    try {
      for (let i = indicatorSettings.bollinger.period - 1; i < data.length; i++) {
        const subset = data.slice(i - indicatorSettings.bollinger.period + 1, i + 1);
        const bb = calculateBollingerBands(subset, indicatorSettings.bollinger.period, indicatorSettings.bollinger.stdDev);
        
        if (bb) {
          bollingerData.push({
            time: subset[subset.length - 1].time as number,
            upper: bb.upper,
            middle: bb.middle,
            lower: bb.lower,
          });
        }
      }

      if (bollingerData.length === 0) {
        console.log("[Bollinger] No valid data points calculated");
        return;
      }

      // Add upper band (subtle green, thin)
      bollingerSeriesRef.current.upper = chartRef.current.addSeries(LineSeries, {
        color: 'rgba(16, 185, 129, 0.6)',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      bollingerSeriesRef.current.upper.setData(
        bollingerData.map(d => ({ time: d.time as UTCTimestamp, value: d.upper }))
      );

      // Add middle band (prominent blue SMA reference line)
      bollingerSeriesRef.current.middle = chartRef.current.addSeries(LineSeries, {
        color: '#3B82F6',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        lineStyle: 0, // Solid line
      });
      bollingerSeriesRef.current.middle.setData(
        bollingerData.map(d => ({ time: d.time as UTCTimestamp, value: d.middle }))
      );

      // Add lower band (subtle red, thin)
      bollingerSeriesRef.current.lower = chartRef.current.addSeries(LineSeries, {
        color: 'rgba(239, 68, 68, 0.6)',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      bollingerSeriesRef.current.lower.setData(
        bollingerData.map(d => ({ time: d.time as UTCTimestamp, value: d.lower }))
      );
      
      console.log(`[Bollinger] Rendered ${bollingerData.length} data points`);
    } catch (error) {
      console.error("[Bollinger] Error rendering bands:", error);
    }
  }, [indicatorView, indicatorSettings.bollinger]);

  // Update legend price and Bollinger values when data changes
  // Note: MA legend values are updated by worker onmessage handler
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    if (dataArray.length === 0) return;

    const latest = dataArray[dataArray.length - 1];

    // Calculate latest Bollinger values for legend
    let bollingerLegend: { upper: number | null; middle: number | null; lower: number | null } | null = null;
    if (indicatorView === 'bollinger' && dataArray.length >= indicatorSettings.bollinger.period) {
      const subset = dataArray.slice(-indicatorSettings.bollinger.period);
      const bb = calculateBollingerBands(subset, indicatorSettings.bollinger.period, indicatorSettings.bollinger.stdDev);
      if (bb) {
        bollingerLegend = {
          upper: bb.upper,
          middle: bb.middle,
          lower: bb.lower,
        };
      }
    }

    setLegendValues(prev => ({
      ...prev,
      price: latest.close,
      bollinger: bollingerLegend,
    }));
  }, [dataPointsRef.current.size, indicatorView, indicatorSettings.bollinger]);

  // Render Volume histogram
  useEffect(() => {
    if (!chartRef.current) return;

    const dataArray = Array.from(dataPointsRef.current.values());
    
    // Remove existing volume series
    if (volumeSeriesRef.current) {
      try {
        chartRef.current.removeSeries(volumeSeriesRef.current);
      } catch (e) {
        console.log("[Volume] Error removing series:", e);
      }
      volumeSeriesRef.current = null;
    }

    // Only add volume if enabled
    if (!indicators.includes('volume') || dataArray.length === 0) {
      return;
    }

    // Add volume histogram with separate price scale
    volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Configure volume price scale to be 25% of chart height
    chartRef.current.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0,
      },
    });

    // Calculate volume data with color coding and volume spike detection
    const volumeData = dataArray.map((candle, index) => {
      // Use real volume if available (explicit check to avoid treating 0 as falsy), otherwise simulate
      const volume = (candle as any).volume !== undefined 
        ? (candle as any).volume 
        : (candle.high - candle.low) * 1000000;
      
      // Calculate volume MA for spike detection (20-period)
      let volumeMA = 0;
      if (index >= 19) {
        const volumeSum = dataArray.slice(index - 19, index + 1).reduce((sum, c) => {
          const candleVolume = (c as any).volume !== undefined 
            ? (c as any).volume 
            : (c.high - c.low) * 1000000;
          return sum + candleVolume;
        }, 0);
        volumeMA = volumeSum / 20;
      }
      
      // Detect volume spike (volume > 1.5x MA)
      const isVolumeSpike = volumeMA > 0 && volume > volumeMA * 1.5;
      
      // Base color on candle direction
      const baseColor = candle.close >= candle.open 
        ? isVolumeSpike ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.5)' // Green (brighter for spikes)
        : isVolumeSpike ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)';  // Red (brighter for spikes)
      
      return {
        time: candle.time as UTCTimestamp,
        value: volume,
        color: baseColor,
      };
    });

    volumeSeriesRef.current.setData(volumeData);
    console.log(`[Volume] Rendered ${volumeData.length} bars with spike detection`);
  }, [indicators, prices[symbol], symbol]);

  // Update price and time scales whenever data changes (for drawing tools)
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    if (dataArray.length > 0) {
      const prices = dataArray.map(d => d.close);
      const times = dataArray.map(d => d.time as number);
      
      setPriceScale({
        min: Math.min(...prices),
        max: Math.max(...prices),
      });
      
      setTimeScale({
        min: Math.min(...times),
        max: Math.max(...times),
      });
    }
  }, [dataPointsRef.current.size]);

  // Calculate indicators when data or settings change
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    if (dataArray.length > 0) {
      const values: IndicatorData = {};
      
      // Calculate EMA with custom period
      const ema = calculateEMA(dataArray, indicatorSettings.ema.period);
      if (ema) values.ema = ema;
      
      // Calculate RSI with custom period
      const rsi = calculateRSI(dataArray, indicatorSettings.rsi.period);
      if (rsi) values.rsi = rsi;
      
      // Calculate MACD with custom parameters
      const macd = calculateMACD(
        dataArray, 
        indicatorSettings.macd.fast, 
        indicatorSettings.macd.slow, 
        indicatorSettings.macd.signal
      );
      if (macd) values.macd = macd;
      
      // Calculate Bollinger Bands with custom settings
      const bb = calculateBollingerBands(dataArray, indicatorSettings.bollinger.period, indicatorSettings.bollinger.stdDev);
      if (bb) values.bollinger = bb;
      
      setIndicatorValues(values);
    }
  }, [dataPointsRef.current.size, indicatorSettings]);

  // Render Bollinger Bands when view changes
  useEffect(() => {
    const dataArray = Array.from(dataPointsRef.current.values());
    if (dataArray.length > 0) {
      renderBollingerBands(dataArray);
    }
  }, [indicatorView, renderBollingerBands, dataPointsRef.current.size]);

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const startTime = performance.now();
      const layout = {
        layoutName: "default",
        symbol,
        timeframe,
        chartType,
        indicators,
        drawings, // Save drawings
        isDefault: true,
      };
      
      const result = await apiRequest("/api/chart/layout", "POST", layout);

      // Log performance metrics
      const saveLatency = Math.round(performance.now() - startTime);
      await apiRequest("/api/chart/metrics", "POST", {
        renderTime: performanceMetrics.renderTime,
        tickUpdateLatency: performanceMetrics.lastTickLatency,
        orderPreviewDelay: saveLatency,
      });

      return result;
    },
    onSuccess: () => {
      logLayoutSaved("default", drawings.length);
      toast({
        title: "Layout saved",
        description: "Your chart layout has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save layout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load layout on mount
  useQuery<any>({
    queryKey: ["/api/chart/layout"],
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
    select: (layout) => {
      if (layout) {
        setChartType(layout.chartType || "candlestick");
        setTimeframe(layout.timeframe || "1H");
        setIndicators(layout.indicators || []);
        setDrawings(layout.drawings || []);
        if (layout.symbol && onSymbolChange) {
          onSymbolChange(layout.symbol);
        }
      }
      return layout;
    },
  });

  // Log indicator parameter changes via telemetry
  useEffect(() => {
    logIndicatorParamsChange('rsi', { period: indicatorSettings.rsi.period });
  }, [indicatorSettings.rsi.period, logIndicatorParamsChange]);

  useEffect(() => {
    logIndicatorParamsChange('macd', { 
      fast: indicatorSettings.macd.fast,
      slow: indicatorSettings.macd.slow,
      signal: indicatorSettings.macd.signal
    });
  }, [indicatorSettings.macd.fast, indicatorSettings.macd.slow, indicatorSettings.macd.signal, logIndicatorParamsChange]);

  useEffect(() => {
    logIndicatorParamsChange('bollinger', { 
      period: indicatorSettings.bollinger.period,
      stdDev: indicatorSettings.bollinger.stdDev
    });
  }, [indicatorSettings.bollinger.period, indicatorSettings.bollinger.stdDev, logIndicatorParamsChange]);

  useEffect(() => {
    logIndicatorParamsChange('ema', { period: indicatorSettings.ema.period });
  }, [indicatorSettings.ema.period, logIndicatorParamsChange]);

  useEffect(() => {
    logIndicatorParamsChange('stochastic', { 
      kPeriod: indicatorSettings.stochastic.kPeriod,
      dPeriod: indicatorSettings.stochastic.dPeriod
    });
  }, [indicatorSettings.stochastic.kPeriod, indicatorSettings.stochastic.dPeriod, logIndicatorParamsChange]);

  // Handle order submission
  const handleOrderSubmit = async (order: OrderData) => {
    const startPreview = performance.now();
    
    try {
      // Here you would normally submit the order via API
      // For now, we'll just show a preview toast
      const previewDelay = Math.round(performance.now() - startPreview);
      
      toast({
        title: `${order.side.toUpperCase()} Order Preview`,
        description: `${order.size} ${order.symbol} @ ${order.orderType === "market" ? "Market" : `$${order.limitPrice}`}`,
      });

      // Log preview latency
      await apiRequest("/api/chart/metrics", "POST", {
        renderTime: performanceMetrics.renderTime,
        tickUpdateLatency: performanceMetrics.lastTickLatency,
        orderPreviewDelay: previewDelay,
      });

      setShowOrderTicket(false);
    } catch (error: any) {
      toast({
        title: "Order failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const currentPrice = prices[symbol] || 0;
  const priceChange = lastPriceRef.current 
    ? ((currentPrice - lastPriceRef.current) / lastPriceRef.current) * 100 
    : 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Trading Chart</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Select value={symbol} onValueChange={onSymbolChange}>
                  <SelectTrigger className="w-24 h-7 text-sm" data-testid="select-chart-symbol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="SOL">SOL</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant={priceChange >= 0 ? "default" : "destructive"} className="text-xs">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {priceChange >= 0 ? " +" : " "}
                  {priceChange.toFixed(2)}%
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chart Type */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={chartType === "candlestick" ? "default" : "outline"}
                    onClick={() => setChartType("candlestick")}
                    data-testid="button-chart-candlestick"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Candlestick</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={chartType === "line" ? "default" : "outline"}
                    onClick={() => setChartType("line")}
                    data-testid="button-chart-line"
                  >
                    <LineChartIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Line</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={chartType === "area" ? "default" : "outline"}
                    onClick={() => setChartType("area")}
                    data-testid="button-chart-area"
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Area</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Timeframe */}
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-20 h-9" data-testid="select-chart-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1M">1M</SelectItem>
                <SelectItem value="5M">5M</SelectItem>
                <SelectItem value="15M">15M</SelectItem>
                <SelectItem value="1H">1H</SelectItem>
                <SelectItem value="4H">4H</SelectItem>
                <SelectItem value="1D">1D</SelectItem>
              </SelectContent>
            </Select>

            {/* Performance Badge */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1" data-testid="badge-chart-performance">
                    <Timer className="h-3 w-3" />
                    {performanceMetrics.lastTickLatency}ms
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div>Render: {performanceMetrics.renderTime}ms</div>
                    <div>Tick latency: {performanceMetrics.lastTickLatency}ms</div>
                    <div>Updates: {performanceMetrics.updateCount}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Order Ticket Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={showOrderTicket ? "default" : "outline"}
                    onClick={() => setShowOrderTicket(!showOrderTicket)}
                    data-testid="button-toggle-order-ticket"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quick Order</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Save Layout Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveLayoutMutation.mutate()}
                    disabled={saveLayoutMutation.isPending}
                    data-testid="button-save-layout"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save Layout</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Chart Legend */}
        <ChartLegend
          currentPrice={legendValues.price}
          priceChange={priceChange}
          maValues={legendValues.maValues}
          bollingerValues={legendValues.bollinger || undefined}
          obvValue={legendValues.obvValue}
        />
        
        <div className="relative">
          <div ref={chartContainerRef} className="relative" data-testid="chart-container" />
          
          {/* Multi-Panel Indicators (MACD, RSI, Bollinger, Stochastic) */}
          {chartContainerRef.current && (
            <MultiPanelChart
              mainChart={chartRef.current}
              mainSeries={seriesRef.current}
              data={Array.from(dataPointsRef.current.values())}
              enabledIndicators={indicators}
              indicatorSettings={{
                macd: indicatorSettings.macd,
                rsi: indicatorSettings.rsi,
                bollinger: indicatorSettings.bollinger,
                stochastic: indicatorSettings.stochastic,
              }}
              width={chartContainerRef.current.clientWidth}
            />
          )}
          
          {/* Drawing Tools Overlay */}
          {overlayDimensions.width > 0 && timeScale.max > 0 && (
            <ChartDrawingTools
              width={overlayDimensions.width}
              height={overlayDimensions.height}
              drawings={drawings}
              onDrawingsChange={setDrawings}
              priceScale={priceScale}
              timeScale={timeScale}
            />
          )}

          {/* Order Ticket Overlay */}
          {showOrderTicket && (
            <ChartOrderTicket
              symbol={symbol}
              currentPrice={currentPrice}
              onClose={() => setShowOrderTicket(false)}
              onSubmit={handleOrderSubmit}
            />
          )}
        </div>
        
        {/* Indicator Toggle Buttons */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-sm text-muted-foreground">Indicators:</span>
          <Button
            size="sm"
            variant={indicators.includes('macd') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('macd')}
            data-testid="button-toggle-macd"
          >
            MACD
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('rsi') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('rsi')}
            data-testid="button-toggle-rsi"
          >
            RSI
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('ema') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('ema')}
            data-testid="button-toggle-ema"
          >
            EMA
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('volume') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('volume')}
            data-testid="button-toggle-volume"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Volume
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('bollinger') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('bollinger')}
            data-testid="button-toggle-bollinger"
          >
            BB
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('stochastic') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('stochastic')}
            data-testid="button-toggle-stochastic"
          >
            Stoch
          </Button>
          <Button
            size="sm"
            variant={indicators.includes('obv') ? 'default' : 'outline'}
            onClick={() => toggleIndicator('obv')}
            data-testid="button-toggle-obv"
          >
            OBV
          </Button>
        </div>

        {/* MA Overlay Toggle Buttons */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-sm text-muted-foreground">MA Overlays:</span>
          <Button
            size="sm"
            variant={maOverlays.includes('sma7') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('sma7');
              setMaOverlays(prev => 
                enabled ? [...prev, 'sma7'] : prev.filter(m => m !== 'sma7')
              );
              logIndicatorToggle('sma7', enabled);
            }}
            data-testid="button-toggle-sma7"
            className={maOverlays.includes('sma7') ? 'bg-[#F59E0B] hover:bg-[#F59E0B]/90' : ''}
          >
            SMA(7)
          </Button>
          <Button
            size="sm"
            variant={maOverlays.includes('sma25') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('sma25');
              setMaOverlays(prev => 
                enabled ? [...prev, 'sma25'] : prev.filter(m => m !== 'sma25')
              );
              logIndicatorToggle('sma25', enabled);
            }}
            data-testid="button-toggle-sma25"
            className={maOverlays.includes('sma25') ? 'bg-[#8B5CF6] hover:bg-[#8B5CF6]/90' : ''}
          >
            SMA(25)
          </Button>
          <Button
            size="sm"
            variant={maOverlays.includes('sma99') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('sma99');
              setMaOverlays(prev => 
                enabled ? [...prev, 'sma99'] : prev.filter(m => m !== 'sma99')
              );
              logIndicatorToggle('sma99', enabled);
            }}
            data-testid="button-toggle-sma99"
            className={maOverlays.includes('sma99') ? 'bg-[#EC4899] hover:bg-[#EC4899]/90' : ''}
          >
            SMA(99)
          </Button>
          <Button
            size="sm"
            variant={maOverlays.includes('ema7') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('ema7');
              setMaOverlays(prev => 
                enabled ? [...prev, 'ema7'] : prev.filter(m => m !== 'ema7')
              );
              logIndicatorToggle('ema7', enabled);
            }}
            data-testid="button-toggle-ema7"
            className={maOverlays.includes('ema7') ? 'bg-[#10B981] hover:bg-[#10B981]/90' : ''}
          >
            EMA(7)
          </Button>
          <Button
            size="sm"
            variant={maOverlays.includes('ema25') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('ema25');
              setMaOverlays(prev => 
                enabled ? [...prev, 'ema25'] : prev.filter(m => m !== 'ema25')
              );
              logIndicatorToggle('ema25', enabled);
            }}
            data-testid="button-toggle-ema25"
            className={maOverlays.includes('ema25') ? 'bg-[#3B82F6] hover:bg-[#3B82F6]/90' : ''}
          >
            EMA(25)
          </Button>
          <Button
            size="sm"
            variant={maOverlays.includes('ema99') ? 'default' : 'outline'}
            onClick={() => {
              const enabled = !maOverlays.includes('ema99');
              setMaOverlays(prev => 
                enabled ? [...prev, 'ema99'] : prev.filter(m => m !== 'ema99')
              );
              logIndicatorToggle('ema99', enabled);
            }}
            data-testid="button-toggle-ema99"
            className={maOverlays.includes('ema99') ? 'bg-[#EF4444] hover:bg-[#EF4444]/90' : ''}
          >
            EMA(99)
          </Button>
        </div>
        
        {/* Indicator Tabs and Values */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <Tabs value={indicatorView} onValueChange={(v) => setIndicatorView(v as IndicatorView)} className="w-full">
              <div className="flex items-center justify-between">
                <TabsList data-testid="tabs-indicator-view">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="rsi" data-testid="tab-rsi">RSI</TabsTrigger>
                  <TabsTrigger value="macd" data-testid="tab-macd">MACD</TabsTrigger>
                  <TabsTrigger value="bollinger" data-testid="tab-bollinger">Bollinger Bands</TabsTrigger>
                </TabsList>
                
                <Dialog open={showSettings} onOpenChange={setShowSettings}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid="button-indicator-settings">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md" data-testid="dialog-indicator-settings">
                    <DialogHeader>
                      <DialogTitle>Indicator Settings</DialogTitle>
                      <DialogDescription>
                        Customize parameters for all technical indicators
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>RSI Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.rsi.period}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            rsi: { period: parseInt(e.target.value) || 14 }
                          }))}
                          data-testid="input-rsi-period"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>MACD Fast Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.macd.fast}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            macd: { ...prev.macd, fast: parseInt(e.target.value) || 12 }
                          }))}
                          data-testid="input-macd-fast"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>MACD Slow Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.macd.slow}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            macd: { ...prev.macd, slow: parseInt(e.target.value) || 26 }
                          }))}
                          data-testid="input-macd-slow"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>MACD Signal Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.macd.signal}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            macd: { ...prev.macd, signal: parseInt(e.target.value) || 9 }
                          }))}
                          data-testid="input-macd-signal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bollinger Bands Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.bollinger.period}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            bollinger: { ...prev.bollinger, period: parseInt(e.target.value) || 20 }
                          }))}
                          data-testid="input-bollinger-period"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bollinger Bands Std Dev</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={indicatorSettings.bollinger.stdDev}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            bollinger: { ...prev.bollinger, stdDev: parseFloat(e.target.value) || 2 }
                          }))}
                          data-testid="input-bollinger-stddev"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>EMA Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.ema.period}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            ema: { period: parseInt(e.target.value) || 20 }
                          }))}
                          data-testid="input-ema-period"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Stochastic K Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.stochastic.kPeriod}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            stochastic: { ...prev.stochastic, kPeriod: parseInt(e.target.value) || 14 }
                          }))}
                          data-testid="input-stochastic-k-period"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Stochastic D Period</Label>
                        <Input
                          type="number"
                          value={indicatorSettings.stochastic.dPeriod}
                          onChange={(e) => setIndicatorSettings(prev => ({
                            ...prev,
                            stochastic: { ...prev.stochastic, dPeriod: parseInt(e.target.value) || 3 }
                          }))}
                          data-testid="input-stochastic-d-period"
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <TabsContent value="overview" className="mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-xs">Current Price</div>
                    <div className="font-mono font-semibold" data-testid="text-current-price">
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-xs">60-Day Change</div>
                    <div className={cn("font-mono font-semibold", priceChange >= 0 ? "text-green-500" : "text-red-500")} data-testid="text-price-change">
                      {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                    </div>
                  </div>
                  {indicatorValues.rsi && (
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs">RSI ({indicatorSettings.rsi.period})</div>
                      <div className={cn("font-mono font-semibold", indicatorValues.rsi > 70 ? "text-red-500" : indicatorValues.rsi < 30 ? "text-green-500" : "")} data-testid="text-overview-rsi">
                        {indicatorValues.rsi.toFixed(1)}
                      </div>
                    </div>
                  )}
                  {indicatorValues.macd && (
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs">MACD</div>
                      <div className={cn("font-mono font-semibold", indicatorValues.macd.value >= 0 ? "text-green-500" : "text-red-500")} data-testid="text-overview-macd">
                        {indicatorValues.macd.value.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="rsi" className="mt-3">
                {indicatorValues.rsi ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">RSI ({indicatorSettings.rsi.period})</span>
                      <span className={cn("font-mono font-bold text-xl", indicatorValues.rsi > 70 ? "text-red-500" : indicatorValues.rsi < 30 ? "text-green-500" : "text-yellow-500")} data-testid="text-rsi-main">
                        {indicatorValues.rsi.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {indicatorValues.rsi > 70 ? "Overbought - Consider selling" : indicatorValues.rsi < 30 ? "Oversold - Consider buying" : "Neutral"}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Insufficient data for RSI calculation</div>
                )}
              </TabsContent>
              
              <TabsContent value="macd" className="mt-3">
                {indicatorValues.macd ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">MACD</span>
                      <span className={cn("font-mono font-bold text-xl", indicatorValues.macd.value >= 0 ? "text-green-500" : "text-red-500")} data-testid="text-macd-main">
                        {indicatorValues.macd.value.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Signal: </span>
                        <span className="font-mono" data-testid="text-macd-signal">{indicatorValues.macd.signal.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Histogram: </span>
                        <span className="font-mono" data-testid="text-macd-histogram">{indicatorValues.macd.histogram.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Insufficient data for MACD calculation</div>
                )}
              </TabsContent>
              
              <TabsContent value="bollinger" className="mt-3">
                {indicatorValues.bollinger ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-xs text-green-500 mb-1">Upper Band</div>
                        <div className="font-mono font-semibold" data-testid="text-bb-upper">
                          ${indicatorValues.bollinger.upper.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-blue-500 mb-1">Middle Band</div>
                        <div className="font-mono font-semibold" data-testid="text-bb-middle">
                          ${indicatorValues.bollinger.middle.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-red-500 mb-1">Lower Band</div>
                        <div className="font-mono font-semibold" data-testid="text-bb-lower">
                          ${indicatorValues.bollinger.lower.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      Period: {indicatorSettings.bollinger.period} | Std Dev: {indicatorSettings.bollinger.stdDev}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Insufficient data for Bollinger Bands calculation</div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
