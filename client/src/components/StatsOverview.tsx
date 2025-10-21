import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}

function StatCard({ title, value, change, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs md:text-sm text-muted-foreground">{title}</p>
            <p className="text-xl md:text-2xl font-mono font-semibold truncate" data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {change !== undefined && (
              <div className={`text-xs md:text-sm flex items-center gap-1 ${change >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {change >= 0 ? '+' : ''}{change}%
              </div>
            )}
          </div>
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsOverviewProps {
  totalProfit?: number;
  profitChange?: number;
  activePositions?: number;
  positionsChange?: number;
  winRate?: number;
  winRateChange?: number;
  volume24h?: number;
  volumeChange?: number;
}

export default function StatsOverview({
  totalProfit = 0,
  profitChange = 0,
  activePositions = 0,
  positionsChange = 0,
  winRate = 0,
  winRateChange = 0,
  volume24h = 0,
  volumeChange = 0
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-overview">
      <StatCard 
        title="Total Profit" 
        value={`$${totalProfit.toLocaleString()}`}
        change={profitChange}
        icon={<DollarSign className="h-6 w-6" />}
      />
      <StatCard 
        title="Active Positions" 
        value={activePositions.toString()}
        change={positionsChange}
        icon={<Activity className="h-6 w-6" />}
      />
      <StatCard 
        title="Win Rate" 
        value={`${winRate}%`}
        change={winRateChange}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <StatCard 
        title="24h Volume" 
        value={`$${volume24h.toLocaleString()}`}
        change={volumeChange}
        icon={<Activity className="h-6 w-6" />}
      />
    </div>
  );
}
