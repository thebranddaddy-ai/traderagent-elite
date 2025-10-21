import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, UTCTimestamp, CandlestickData, HistogramData } from 'lightweight-charts';

interface OHLCVData extends CandlestickData {
  volume?: number;
}

interface OBVPanelProps {
  data: OHLCVData[];
  height: number;
  width: number;
  onChartReady?: (chart: IChartApi, series?: ISeriesApi<any>) => void;
  onChartDestroy?: () => void;
}

export function OBVPanel({ data, height, width, onChartReady, onChartDestroy }: OBVPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const obvHistogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const zeroLineRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    // Add zero reference line (subtle gray)
    const zeroLine = chart.addLineSeries({
      color: 'rgba(156, 163, 175, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Create OBV histogram (green for bullish, red for bearish)
    const obvHistogram = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'right',
    });

    chartRef.current = chart;
    obvHistogramRef.current = obvHistogram;
    zeroLineRef.current = zeroLine;

    if (onChartReady) {
      onChartReady(chart, obvHistogram);
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

  // Calculate and render OBV
  useEffect(() => {
    if (!obvHistogramRef.current || !zeroLineRef.current || data.length < 2) {
      return;
    }

    const obvData: HistogramData[] = [];
    const zeroData: LineData[] = [];
    let obv = 0;
    let prevObv = 0;

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        // First candle: OBV starts at 0
        obvData.push({
          time: data[i].time as UTCTimestamp,
          value: 0,
          color: 'rgba(156, 163, 175, 0.5)', // neutral gray for first bar
        });
        zeroData.push({
          time: data[i].time as UTCTimestamp,
          value: 0,
        });
      } else {
        // Compare current close to previous close
        const candle = data[i];
        const prevCandle = data[i - 1];

        if (candle.close > prevCandle.close) {
          obv += candle.volume || 0;
        } else if (candle.close < prevCandle.close) {
          obv -= candle.volume || 0;
        }
        // If close === previous close, OBV stays the same

        // Determine color based on OBV direction (bullish=green, bearish=red)
        const color = obv > prevObv 
          ? 'rgba(16, 185, 129, 0.8)'  // Green for bullish (rising OBV)
          : obv < prevObv
          ? 'rgba(239, 68, 68, 0.8)'   // Red for bearish (falling OBV)
          : 'rgba(156, 163, 175, 0.5)'; // Gray for unchanged

        obvData.push({
          time: candle.time as UTCTimestamp,
          value: obv,
          color,
        });

        zeroData.push({
          time: candle.time as UTCTimestamp,
          value: 0,
        });

        prevObv = obv;
      }
    }

    obvHistogramRef.current.setData(obvData);
    zeroLineRef.current.setData(zeroData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div 
      ref={containerRef} 
      className="relative"
      data-testid="chart-panel-obv"
    />
  );
}
