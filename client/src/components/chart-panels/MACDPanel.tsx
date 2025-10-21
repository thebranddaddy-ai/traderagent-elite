import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, HistogramData, LineData, UTCTimestamp, LineSeries, HistogramSeries } from 'lightweight-charts';
import { CandlestickData } from 'lightweight-charts';
import { calculateMACD } from '@/lib/indicators';

interface MACDPanelProps {
  data: CandlestickData[];
  height: number;
  width: number;
  settings: { fast: number; slow: number; signal: number };
  onChartReady?: (chart: IChartApi, series?: ISeriesApi<any>) => void;
  onChartDestroy?: () => void;
}

export function MACDPanel({ data, height, width, settings, onChartReady, onChartDestroy }: MACDPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.3)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create MACD line (blue)
    const macdLine = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      title: 'MACD',
    });

    // Create Signal line (orange)
    const signalLine = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 2,
      title: 'Signal',
    });

    // Create Histogram
    const histogram = chart.addSeries(HistogramSeries, {
      color: '#10B981',
      priceFormat: {
        type: 'volume',
      },
    });

    chartRef.current = chart;
    macdLineRef.current = macdLine;
    signalLineRef.current = signalLine;
    histogramRef.current = histogram;

    if (onChartReady) {
      onChartReady(chart, macdLine);
    }

    return () => {
      if (onChartDestroy) {
        onChartDestroy();
      }
      chart.remove();
    };
  }, []);

  // Update dimensions
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width, height });
    }
  }, [width, height]);

  // Calculate and render MACD
  useEffect(() => {
    if (!macdLineRef.current || !signalLineRef.current || !histogramRef.current || data.length < settings.slow + settings.signal) {
      return;
    }

    const macdData: LineData[] = [];
    const signalData: LineData[] = [];
    const histogramData: HistogramData[] = [];

    // Calculate MACD for each point
    for (let i = settings.slow + settings.signal - 1; i < data.length; i++) {
      const subset = data.slice(0, i + 1);
      const macd = calculateMACD(subset, settings.fast, settings.slow, settings.signal);

      if (macd) {
        const time = subset[subset.length - 1].time as UTCTimestamp;
        
        macdData.push({
          time,
          value: macd.value,
        });

        signalData.push({
          time,
          value: macd.signal,
        });

        histogramData.push({
          time,
          value: macd.histogram,
          color: macd.histogram >= 0 ? '#10B981' : '#EF4444',
        });
      }
    }

    macdLineRef.current.setData(macdData);
    signalLineRef.current.setData(signalData);
    histogramRef.current.setData(histogramData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, settings]);

  return (
    <div 
      ref={containerRef} 
      className="relative"
      data-testid="chart-panel-macd"
    />
  );
}
