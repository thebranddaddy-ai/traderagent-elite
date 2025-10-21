import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, UTCTimestamp, LineSeries } from 'lightweight-charts';
import { CandlestickData } from 'lightweight-charts';
import { calculateRSI } from '@/lib/indicators';

interface RSIPanelProps {
  data: CandlestickData[];
  height: number;
  width: number;
  period: number;
  onChartReady?: (chart: IChartApi, series?: ISeriesApi<any>) => void;
  onChartDestroy?: () => void;
}

export function RSIPanel({ data, height, width, period, onChartReady, onChartDestroy }: RSIPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const overboughtRef = useRef<ISeriesApi<'Line'> | null>(null);
  const oversoldRef = useRef<ISeriesApi<'Line'> | null>(null);

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
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create RSI line (purple)
    const rsiLine = chart.addSeries(LineSeries, {
      color: '#8B5CF6',
      lineWidth: 2,
      title: 'RSI',
    });

    // Create overbought line (70 level)
    const overbought = chart.addSeries(LineSeries, {
      color: '#EF4444',
      lineWidth: 1,
      lineStyle: 2, // dashed
      title: 'Overbought (70)',
    });

    // Create oversold line (30 level)
    const oversold = chart.addSeries(LineSeries, {
      color: '#10B981',
      lineWidth: 1,
      lineStyle: 2, // dashed
      title: 'Oversold (30)',
    });

    chartRef.current = chart;
    rsiLineRef.current = rsiLine;
    overboughtRef.current = overbought;
    oversoldRef.current = oversold;

    if (onChartReady) {
      onChartReady(chart, rsiLine);
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

  // Calculate and render RSI
  useEffect(() => {
    if (!rsiLineRef.current || !overboughtRef.current || !oversoldRef.current || data.length < period + 1) {
      return;
    }

    const rsiData: LineData[] = [];
    const overboughtData: LineData[] = [];
    const oversoldData: LineData[] = [];

    // Calculate RSI for each point
    for (let i = period; i < data.length; i++) {
      const subset = data.slice(0, i + 1);
      const rsi = calculateRSI(subset, period);

      if (rsi !== null) {
        const time = subset[subset.length - 1].time as UTCTimestamp;
        
        rsiData.push({
          time,
          value: rsi,
        });

        overboughtData.push({
          time,
          value: 70,
        });

        oversoldData.push({
          time,
          value: 30,
        });
      }
    }

    rsiLineRef.current.setData(rsiData);
    overboughtRef.current.setData(overboughtData);
    oversoldRef.current.setData(oversoldData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, period]);

  return (
    <div 
      ref={containerRef} 
      className="relative"
      data-testid="chart-panel-rsi"
    />
  );
}
