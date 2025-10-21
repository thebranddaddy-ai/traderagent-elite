import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, UTCTimestamp, LineSeries } from 'lightweight-charts';
import { CandlestickData } from 'lightweight-charts';
import { calculateBollingerBands } from '@/lib/indicators';

interface BollingerBandsPanelProps {
  data: CandlestickData[];
  height: number;
  width: number;
  period: number;
  stdDev: number;
  onChartReady?: (chart: IChartApi, series?: ISeriesApi<any>) => void;
  onChartDestroy?: () => void;
}

export function BollingerBandsPanel({ 
  data, 
  height, 
  width, 
  period, 
  stdDev, 
  onChartReady, 
  onChartDestroy 
}: BollingerBandsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const upperBandRef = useRef<ISeriesApi<'Line'> | null>(null);
  const middleBandRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerBandRef = useRef<ISeriesApi<'Line'> | null>(null);

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
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      timeScale: {
        borderColor: '#374151',
        visible: true,
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    chartRef.current = chart;

    // Add upper band (green)
    const upperBand = chart.addSeries(LineSeries, {
      color: '#10B981',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Add middle band (blue - SMA)
    const middleBand = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    // Add lower band (red)
    const lowerBand = chart.addSeries(LineSeries, {
      color: '#EF4444',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    upperBandRef.current = upperBand;
    middleBandRef.current = middleBand;
    lowerBandRef.current = lowerBand;

    if (onChartReady) {
      onChartReady(chart, middleBand);
    }

    return () => {
      if (onChartDestroy) {
        onChartDestroy();
      }
      chart.remove();
    };
  }, [height, width, onChartReady, onChartDestroy]);

  // Calculate and update Bollinger Bands data
  useEffect(() => {
    if (!upperBandRef.current || !middleBandRef.current || !lowerBandRef.current || data.length < period) {
      return;
    }

    const bandsData: { time: UTCTimestamp; upper: number; middle: number; lower: number }[] = [];

    // Calculate bands for each data point
    for (let i = period - 1; i < data.length; i++) {
      const subset = data.slice(i - period + 1, i + 1);
      const bands = calculateBollingerBands(subset, period, stdDev);

      if (bands) {
        bandsData.push({
          time: subset[subset.length - 1].time as UTCTimestamp,
          upper: bands.upper,
          middle: bands.middle,
          lower: bands.lower,
        });
      }
    }

    if (bandsData.length > 0) {
      upperBandRef.current.setData(
        bandsData.map(d => ({ time: d.time, value: d.upper }))
      );
      middleBandRef.current.setData(
        bandsData.map(d => ({ time: d.time, value: d.middle }))
      );
      lowerBandRef.current.setData(
        bandsData.map(d => ({ time: d.time, value: d.lower }))
      );
    }
  }, [data, period, stdDev]);

  // Sync chart size
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width, height });
    }
  }, [width, height]);

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">BB({period},{stdDev})</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-green-500"></span>
            Upper
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-blue-500"></span>
            Middle
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-red-500"></span>
            Lower
          </span>
        </div>
      </div>
      <div ref={containerRef} data-testid="bollinger-bands-panel" />
    </div>
  );
}
