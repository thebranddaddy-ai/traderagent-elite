import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, CandlestickData, LineStyle, LineSeries } from 'lightweight-charts';
import { calculateStochastic } from '@/lib/indicators';

interface StochasticPanelProps {
  data: CandlestickData[];
  height: number;
  width: number;
  kPeriod?: number;
  dPeriod?: number;
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Line'>) => void;
  onChartDestroy?: () => void;
}

export function StochasticPanel({
  data,
  height,
  width,
  kPeriod = 14,
  dPeriod = 3,
  onChartReady,
  onChartDestroy,
}: StochasticPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const kSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [currentValues, setCurrentValues] = useState<{ k: number; d: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: 'hsl(var(--muted-foreground))',
      },
      grid: {
        vertLines: { color: 'hsl(var(--border) / 0.1)' },
        horzLines: { color: 'hsl(var(--border) / 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'hsl(var(--border))',
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        mode: 0,
        autoScale: false,
      },
      timeScale: {
        borderColor: 'hsl(var(--border))',
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: 'hsl(var(--primary) / 0.3)',
          style: LineStyle.Solid,
        },
        horzLine: {
          width: 1,
          color: 'hsl(var(--primary) / 0.3)',
          style: LineStyle.Solid,
        },
      },
    });

    chartRef.current = chart;

    // Create %K line (fast stochastic - blue)
    const kSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      title: '%K',
      priceScaleId: 'right',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    kSeriesRef.current = kSeries;

    // Create %D line (slow stochastic - orange)
    const dSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      title: '%D',
      priceScaleId: 'right',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    dSeriesRef.current = dSeries;

    // Add overbought line (80)
    const overboughtSeries = chart.addSeries(LineSeries, {
      color: 'hsl(var(--destructive) / 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Add oversold line (20)
    const oversoldSeries = chart.addSeries(LineSeries, {
      color: 'hsl(var(--chart-1) / 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Add midline (50)
    const midlineSeries = chart.addSeries(LineSeries, {
      color: 'hsl(var(--muted-foreground) / 0.3)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceScaleId: 'right',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Calculate and set data
    const kLineData: LineData[] = [];
    const dLineData: LineData[] = [];
    const overboughtData: LineData[] = [];
    const oversoldData: LineData[] = [];
    const midlineData: LineData[] = [];

    for (let i = kPeriod + dPeriod - 1; i < data.length; i++) {
      const subset = data.slice(0, i + 1);
      const stochastic = calculateStochastic(subset, kPeriod, dPeriod);

      if (stochastic) {
        const time = data[i].time;
        kLineData.push({ time, value: stochastic.k });
        dLineData.push({ time, value: stochastic.d });
        overboughtData.push({ time, value: 80 });
        oversoldData.push({ time, value: 20 });
        midlineData.push({ time, value: 50 });

        // Update current values for the last data point
        if (i === data.length - 1) {
          setCurrentValues(stochastic);
        }
      }
    }

    kSeries.setData(kLineData);
    dSeries.setData(dLineData);
    overboughtSeries.setData(overboughtData);
    oversoldSeries.setData(oversoldData);
    midlineSeries.setData(midlineData);

    // Set price scale to fixed 0-100 range
    chart.priceScale('right').applyOptions({
      autoScale: false,
      scaleMargins: {
        top: 0.05,
        bottom: 0.05,
      },
    });

    chart.timeScale().fitContent();

    // Notify parent that chart is ready (pass %K series for crosshair sync)
    if (onChartReady) {
      onChartReady(chart, kSeries);
    }

    return () => {
      if (onChartDestroy) {
        onChartDestroy();
      }
      chart.remove();
      chartRef.current = null;
      kSeriesRef.current = null;
      dSeriesRef.current = null;
    };
  }, [data, height, width, kPeriod, dPeriod, onChartReady, onChartDestroy]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} data-testid="stochastic-chart" />
      
      {/* Legend */}
      {currentValues && (
        <div className="absolute top-2 left-2 text-xs space-y-0.5 pointer-events-none" data-testid="stochastic-legend">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#3b82f6]" />
            <span className="text-muted-foreground">
              %K: <span className="font-medium text-foreground">{currentValues.k.toFixed(2)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#f59e0b]" />
            <span className="text-muted-foreground">
              %D: <span className="font-medium text-foreground">{currentValues.d.toFixed(2)}</span>
            </span>
          </div>
          {currentValues.k > 80 && (
            <div className="text-destructive font-medium">Overbought</div>
          )}
          {currentValues.k < 20 && (
            <div className="text-chart-1 font-medium">Oversold</div>
          )}
        </div>
      )}
    </div>
  );
}
