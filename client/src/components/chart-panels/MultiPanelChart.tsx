import { useEffect, useRef, useState, useCallback } from 'react';
import { IChartApi, ISeriesApi, CandlestickData, MouseEventParams, Time } from 'lightweight-charts';
import { MACDPanel } from './MACDPanel';
import { RSIPanel } from './RSIPanel';
import { BollingerBandsPanel } from './BollingerBandsPanel';
import { StochasticPanel } from './StochasticPanel';
import { OBVPanel } from './OBVPanel';
import { cn } from '@/lib/utils';

interface MultiPanelChartProps {
  mainChart: IChartApi | null;
  mainSeries?: ISeriesApi<any> | null;
  data: CandlestickData[];
  enabledIndicators: string[];
  indicatorSettings: {
    macd: { fast: number; slow: number; signal: number };
    rsi: { period: number };
    bollinger?: { period: number; stdDev: number };
    stochastic?: { kPeriod: number; dPeriod: number };
  };
  width: number;
}

interface ChartRegistration {
  id: string;
  chart: IChartApi;
  series?: ISeriesApi<any>;
}

export function MultiPanelChart({
  mainChart,
  mainSeries = null,
  data,
  enabledIndicators,
  indicatorSettings,
  width,
}: MultiPanelChartProps) {
  const [charts, setCharts] = useState<ChartRegistration[]>([]);
  const allChartsRef = useRef<ChartRegistration[]>([]);
  const crosshairPositionRef = useRef<{ time: Time | null; price: number | null }>({ time: null, price: null });

  // Main panel height
  const mainPanelHeight = 400;
  
  // Indicator panel heights
  const macdPanelHeight = 120;
  const rsiPanelHeight = 100;
  const bollingerPanelHeight = 120;
  const stochasticPanelHeight = 100;
  const obvPanelHeight = 120;

  // Register chart when panel is ready
  const registerChart = useCallback((id: string, chart: IChartApi, series?: ISeriesApi<any>) => {
    setCharts(prev => {
      const exists = prev.find(c => c.id === id);
      if (exists) return prev;
      return [...prev, { id, chart, series }];
    });
  }, []);

  // Unregister chart when panel unmounts
  const unregisterChart = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Update all charts ref when charts change
  useEffect(() => {
    const allChartRegs: ChartRegistration[] = mainChart 
      ? [{ id: 'main', chart: mainChart, series: mainSeries || undefined }, ...charts]
      : charts;
    allChartsRef.current = allChartRegs;
  }, [mainChart, mainSeries, charts]);

  // Synchronize time scales across all panels
  useEffect(() => {
    const allChartRegs = allChartsRef.current;
    if (allChartRegs.length < 2) return;

    const syncTimeScale = (sourceChart: IChartApi) => {
      const visibleRange = sourceChart.timeScale().getVisibleRange();
      if (!visibleRange) return;

      allChartRegs.forEach(reg => {
        if (reg.chart !== sourceChart) {
          reg.chart.timeScale().setVisibleRange(visibleRange);
        }
      });
    };

    const subscriptions = allChartRegs.map(reg => {
      const timeScale = reg.chart.timeScale();
      const handler = () => syncTimeScale(reg.chart);
      timeScale.subscribeVisibleTimeRangeChange(handler);
      return { chart: reg.chart, handler };
    });

    return () => {
      subscriptions.forEach(({ chart, handler }) => {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
      });
    };
  }, [charts, mainChart, mainSeries]);

  // Synchronize crosshair across all panels
  useEffect(() => {
    const allChartRegs = allChartsRef.current;
    if (allChartRegs.length < 2) return;

    const syncCrosshair = (sourceReg: ChartRegistration, point: MouseEventParams) => {
      if (!point.time) {
        // Mouse left - hide crosshair on all charts
        allChartRegs.forEach(reg => {
          if (reg.chart !== sourceReg.chart) {
            reg.chart.clearCrosshairPosition();
          }
        });
        crosshairPositionRef.current = { time: null, price: null };
        return;
      }

      // Get time and price from source
      const time = point.time;
      
      // Synchronize crosshair to same time on all other panels
      allChartRegs.forEach(targetReg => {
        if (targetReg.chart !== sourceReg.chart && targetReg.series) {
          try {
            // Use stored series reference to set crosshair position
            // The price doesn't need to match - lightweight-charts will find the correct price on the series
            targetReg.chart.setCrosshairPosition(0, time, targetReg.series);
          } catch (e) {
            console.debug('[MultiPanel] Crosshair sync error:', e);
          }
        }
      });
    };

    const subscriptions = allChartRegs.map(reg => {
      const handler = (param: MouseEventParams) => syncCrosshair(reg, param);
      reg.chart.subscribeCrosshairMove(handler);
      return { chart: reg.chart, handler };
    });

    return () => {
      subscriptions.forEach(({ chart, handler }) => {
        chart.unsubscribeCrosshairMove(handler);
      });
    };
  }, [charts, mainChart, mainSeries]);

  // Show panels if enabled
  const showMACD = enabledIndicators.includes('macd');
  const showRSI = enabledIndicators.includes('rsi');
  const showBollinger = enabledIndicators.includes('bollinger');
  const showStochastic = enabledIndicators.includes('stochastic');
  const showOBV = enabledIndicators.includes('obv');

  return (
    <div className="flex flex-col" data-testid="multi-panel-chart">
      {/* MACD Panel */}
      {showMACD && (
        <div 
          className={cn(
            "border-t border-border transition-all duration-300",
            "animate-in slide-in-from-top-2 fade-in"
          )}
          style={{ height: macdPanelHeight }}
        >
          <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              MACD ({indicatorSettings.macd.fast}, {indicatorSettings.macd.slow}, {indicatorSettings.macd.signal})
            </span>
          </div>
          <MACDPanel
            data={data}
            height={macdPanelHeight - 25}
            width={width}
            settings={indicatorSettings.macd}
            onChartReady={(chart, series) => registerChart('macd', chart, series)}
            onChartDestroy={() => unregisterChart('macd')}
          />
        </div>
      )}

      {/* RSI Panel */}
      {showRSI && (
        <div 
          className={cn(
            "border-t border-border transition-all duration-300",
            "animate-in slide-in-from-top-2 fade-in"
          )}
          style={{ height: rsiPanelHeight }}
        >
          <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              RSI ({indicatorSettings.rsi.period})
            </span>
          </div>
          <RSIPanel
            data={data}
            height={rsiPanelHeight - 25}
            width={width}
            period={indicatorSettings.rsi.period}
            onChartReady={(chart, series) => registerChart('rsi', chart, series)}
            onChartDestroy={() => unregisterChart('rsi')}
          />
        </div>
      )}

      {/* Bollinger Bands Panel */}
      {showBollinger && indicatorSettings.bollinger && (
        <div 
          className={cn(
            "border-t border-border transition-all duration-300",
            "animate-in slide-in-from-top-2 fade-in"
          )}
          style={{ height: bollingerPanelHeight }}
        >
          <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              Bollinger Bands ({indicatorSettings.bollinger.period}, {indicatorSettings.bollinger.stdDev})
            </span>
          </div>
          <BollingerBandsPanel
            data={data}
            height={bollingerPanelHeight - 25}
            width={width}
            period={indicatorSettings.bollinger.period}
            stdDev={indicatorSettings.bollinger.stdDev}
            onChartReady={(chart, series) => registerChart('bollinger', chart, series)}
            onChartDestroy={() => unregisterChart('bollinger')}
          />
        </div>
      )}

      {/* Stochastic Oscillator Panel */}
      {showStochastic && indicatorSettings.stochastic && (
        <div 
          className={cn(
            "border-t border-border transition-all duration-300",
            "animate-in slide-in-from-top-2 fade-in"
          )}
          style={{ height: stochasticPanelHeight }}
        >
          <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              Stochastic ({indicatorSettings.stochastic.kPeriod}, {indicatorSettings.stochastic.dPeriod})
            </span>
          </div>
          <StochasticPanel
            data={data}
            height={stochasticPanelHeight - 25}
            width={width}
            kPeriod={indicatorSettings.stochastic.kPeriod}
            dPeriod={indicatorSettings.stochastic.dPeriod}
            onChartReady={(chart, series) => registerChart('stochastic', chart, series)}
            onChartDestroy={() => unregisterChart('stochastic')}
          />
        </div>
      )}

      {/* OBV Panel */}
      {showOBV && (
        <div 
          className={cn(
            "border-t border-border transition-all duration-300",
            "animate-in slide-in-from-top-2 fade-in"
          )}
          style={{ height: obvPanelHeight }}
        >
          <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">
              On-Balance Volume (OBV)
            </span>
          </div>
          <OBVPanel
            data={data}
            height={obvPanelHeight - 25}
            width={width}
            onChartReady={(chart, series) => registerChart('obv', chart, series)}
            onChartDestroy={() => unregisterChart('obv')}
          />
        </div>
      )}
    </div>
  );
}
