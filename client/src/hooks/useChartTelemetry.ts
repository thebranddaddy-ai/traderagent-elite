import { useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface ChartTelemetryEvent {
  eventType: 'indicator_toggle' | 'timeframe_change' | 'chart_type_change' | 'indicator_params_change' | 'ohlcv_request' | 'ohlcv_subscribe' | 'indicator_calc_time' | 'drawing_tool_selected' | 'drawing_created' | 'drawing_deleted' | 'layout_saved';
  eventData: Record<string, any>;
}

const BATCH_INTERVAL_MS = 5000; // 5 seconds

export function useChartTelemetry() {
  const batchQueueRef = useRef<ChartTelemetryEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const flushBatch = useCallback(async () => {
    if (batchQueueRef.current.length === 0) return;

    const events = [...batchQueueRef.current];
    batchQueueRef.current = [];

    try {
      await apiRequest('/api/telemetry/chart-events', 'POST', { events });
    } catch (error) {
      console.error('[Telemetry] Failed to send batch:', error);
    }
  }, []);

  const scheduleBatch = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setTimeout(() => {
      flushBatch();
      timerRef.current = null;
    }, BATCH_INTERVAL_MS);
  }, [flushBatch]);

  const logEvent = useCallback((eventType: ChartTelemetryEvent['eventType'], eventData: Record<string, any>) => {
    batchQueueRef.current.push({ eventType, eventData });
    scheduleBatch();
  }, [scheduleBatch]);

  const logIndicatorToggle = useCallback((indicator: string, enabled: boolean) => {
    logEvent('indicator_toggle', { indicator, enabled, timestamp: Date.now() });
  }, [logEvent]);

  const logTimeframeChange = useCallback((from: string, to: string) => {
    logEvent('timeframe_change', { from, to, timestamp: Date.now() });
  }, [logEvent]);

  const logChartTypeChange = useCallback((from: string, to: string) => {
    logEvent('chart_type_change', { from, to, timestamp: Date.now() });
  }, [logEvent]);

  const logIndicatorParamsChange = useCallback((indicator: string, params: Record<string, any>) => {
    logEvent('indicator_params_change', { indicator, params, timestamp: Date.now() });
  }, [logEvent]);

  const logOHLCVRequest = useCallback((symbol: string, interval: string, count: number, fetchTime: number, totalTime: number) => {
    logEvent('ohlcv_request', { symbol, interval, count, fetchTime, totalTime, timestamp: Date.now() });
  }, [logEvent]);

  const logOHLCVSubscribe = useCallback((symbol: string, interval: string) => {
    logEvent('ohlcv_subscribe', { symbol, interval, timestamp: Date.now() });
  }, [logEvent]);

  const logIndicatorCalcTime = useCallback((indicator: string, calcTime: number, dataPoints: number) => {
    logEvent('indicator_calc_time', { indicator, calcTime, dataPoints, timestamp: Date.now() });
  }, [logEvent]);

  const logDrawingToolSelected = useCallback((tool: string) => {
    logEvent('drawing_tool_selected', { tool, timestamp: Date.now() });
  }, [logEvent]);

  const logDrawingCreated = useCallback((drawingType: string, drawingId: string) => {
    logEvent('drawing_created', { drawingType, drawingId, timestamp: Date.now() });
  }, [logEvent]);

  const logDrawingDeleted = useCallback((drawingType: string, drawingId: string) => {
    logEvent('drawing_deleted', { drawingType, drawingId, timestamp: Date.now() });
  }, [logEvent]);

  const logLayoutSaved = useCallback((layoutName: string, drawingCount: number) => {
    logEvent('layout_saved', { layoutName, drawingCount, timestamp: Date.now() });
  }, [logEvent]);

  return {
    logIndicatorToggle,
    logTimeframeChange,
    logChartTypeChange,
    logIndicatorParamsChange,
    logOHLCVRequest,
    logOHLCVSubscribe,
    logIndicatorCalcTime,
    logDrawingToolSelected,
    logDrawingCreated,
    logDrawingDeleted,
    logLayoutSaved,
  };
}
