import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MAValue {
  label: string;
  value: number | null;
  color: string;
}

interface BollingerValue {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

interface ChartLegendProps {
  maValues?: MAValue[];
  bollingerValues?: BollingerValue;
  obvValue?: number | null;
  currentPrice?: number | null;
  priceChange?: number;
  className?: string;
}

export function ChartLegend({
  maValues = [],
  bollingerValues,
  obvValue,
  currentPrice,
  priceChange = 0,
  className,
}: ChartLegendProps) {
  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined) return '--';
    return price.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatLargeNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '--';
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1e9) {
      return `${sign}${(absValue / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
      return `${sign}${(absValue / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
      return `${sign}${(absValue / 1e3).toFixed(2)}K`;
    }
    return `${sign}${absValue.toFixed(0)}`;
  };

  const priceColor = priceChange >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-3 py-2 bg-background/95 backdrop-blur-sm",
        "border-b border-border/50 text-xs font-medium",
        className
      )}
      data-testid="chart-legend"
    >
      {/* Current Price */}
      {currentPrice !== null && currentPrice !== undefined && (
        <div className="flex items-center gap-1.5" data-testid="legend-price">
          <span className="text-muted-foreground">Price:</span>
          <span className={cn("font-semibold", priceColor)}>
            ${formatPrice(currentPrice)}
          </span>
        </div>
      )}

      {/* MA Overlays */}
      {maValues.length > 0 && (
        <div className="flex items-center gap-2" data-testid="legend-ma-values">
          {maValues.map((ma, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: ma.color }}
              />
              <span className="text-muted-foreground">{ma.label}:</span>
              <span className="font-mono" style={{ color: ma.color }}>
                {formatPrice(ma.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bollinger Bands */}
      {bollingerValues && (
        <div className="flex items-center gap-2" data-testid="legend-bollinger">
          <span className="text-muted-foreground">BB(20,2):</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">U:</span>
            <span className="font-mono text-green-500/70">
              {formatPrice(bollingerValues.upper)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">M:</span>
            <span className="font-mono text-blue-500">
              {formatPrice(bollingerValues.middle)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">L:</span>
            <span className="font-mono text-red-500/70">
              {formatPrice(bollingerValues.lower)}
            </span>
          </div>
        </div>
      )}

      {/* OBV (On-Balance Volume) */}
      {obvValue !== null && obvValue !== undefined && (
        <div className="flex items-center gap-1.5" data-testid="legend-obv">
          <span className="text-muted-foreground">OBV:</span>
          <span className={cn("font-mono font-semibold", obvValue >= 0 ? 'text-green-500' : 'text-red-500')}>
            {formatLargeNumber(obvValue)}
          </span>
        </div>
      )}

      {/* Status Badge */}
      <div className="ml-auto">
        <Badge 
          variant="outline" 
          className="text-[10px] h-5 px-2 bg-green-500/10 text-green-500 border-green-500/20"
          data-testid="legend-status"
        >
          LIVE
        </Badge>
      </div>
    </div>
  );
}
