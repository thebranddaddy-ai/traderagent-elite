import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, AlertTriangle, Play, Pause, AlertOctagon } from "lucide-react";
import { useState } from "react";

interface RiskStatusBannerProps {
  isActive?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  message?: string;
  onToggle?: (active: boolean) => void;
}

export default function RiskStatusBanner({ 
  isActive = true,
  riskLevel = 'low',
  message = "All systems operational",
  onToggle
}: RiskStatusBannerProps) {
  const [active, setActive] = useState(isActive);

  const handleToggle = () => {
    const newState = !active;
    setActive(newState);
    console.log(`Trading ${newState ? 'resumed' : 'paused'}`);
    onToggle?.(newState);
  };

  const getBannerStyle = () => {
    if (!active) {
      return "bg-chart-4/10 border-l-chart-4";
    }
    switch (riskLevel) {
      case 'high':
        return "bg-chart-3/10 border-l-chart-3";
      case 'medium':
        return "bg-chart-4/10 border-l-chart-4";
      default:
        return "bg-chart-2/10 border-l-chart-2";
    }
  };

  const getIcon = () => {
    if (!active) return <Pause className="h-5 w-5 text-chart-4" />;
    if (riskLevel === 'high') return <AlertTriangle className="h-5 w-5 text-chart-3" />;
    return <Shield className="h-5 w-5 text-chart-2" />;
  };

  const getRiskBadgeVariant = () => {
    if (!active) return "secondary";
    return riskLevel === 'high' ? "destructive" : riskLevel === 'medium' ? "default" : "secondary";
  };

  return (
    <div 
      className={`sticky top-0 z-50 border-l-4 backdrop-blur-md shadow-md ${getBannerStyle()}`}
      data-testid="banner-risk-status"
    >
      <div className="flex items-center justify-between px-6 py-3 gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1">
          {getIcon()}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium" data-testid="text-status-message">
              {!active ? 'Trading Paused' : message}
            </span>
            <Badge variant={getRiskBadgeVariant()} data-testid="badge-risk-level">
              {!active ? 'PAUSED' : `${riskLevel.toUpperCase()} RISK`}
            </Badge>
          </div>
        </div>
        {/* Emergency Stop Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={active ? "destructive" : "default"}
              size="icon"
              onClick={handleToggle}
              data-testid="button-toggle-trading"
              className={`h-10 w-10 rounded-full backdrop-blur-sm transition-all ${
                active 
                  ? 'bg-red-500 hover:bg-red-600 border-2 border-red-600 shadow-lg shadow-red-500/50' 
                  : 'bg-green-500 hover:bg-green-600 border-2 border-green-600 shadow-lg shadow-green-500/50'
              }`}
            >
              {active ? (
                <AlertOctagon className="h-5 w-5 text-white" />
              ) : (
                <Play className="h-5 w-5 text-white" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            {active ? 'Emergency Stop - Pause All Trading' : 'Resume Trading'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
