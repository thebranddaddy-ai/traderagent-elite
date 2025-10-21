import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bell, Settings, LogOut, Power, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { TradingModeToggle } from "@/components/TradingModeToggle";
import { useState } from "react";

interface DashboardHeaderProps {
  username?: string;
  notifications?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  statusMessage?: string;
  tradingActive?: boolean;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
  onTradingToggle?: (active: boolean) => void;
}

export default function DashboardHeader({
  username = "Trader",
  notifications = 0,
  riskLevel = 'medium',
  statusMessage = "All systems operational",
  tradingActive = true,
  onSettingsClick,
  onLogoutClick,
  onTradingToggle
}: DashboardHeaderProps) {
  const [isActive, setIsActive] = useState(tradingActive);

  const handlePowerToggle = () => {
    const newState = !isActive;
    setIsActive(newState);
    console.log(`Trading ${newState ? 'activated' : 'deactivated'}`);
    onTradingToggle?.(newState);
  };

  const getRiskColor = () => {
    if (!isActive) return 'text-orange-500';
    switch (riskLevel) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Logo - Left & Top */}
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">TE</span>
          </div>

          {/* Status & Risk Info */}
          <div className="flex items-center gap-2 pr-4 border-r border-border">
            <Shield className={`h-4 w-4 ${getRiskColor()}`} />
            <div className="flex flex-col">
              <span className="text-xs font-medium leading-tight" data-testid="text-status-message">
                {!isActive ? 'Trading Paused' : statusMessage}
              </span>
              <Badge 
                variant={isActive ? "outline" : "secondary"} 
                className={`text-[10px] h-4 px-1.5 w-fit ${getRiskColor()}`}
                data-testid="badge-risk-level"
              >
                {!isActive ? 'PAUSED' : `${riskLevel.toUpperCase()} RISK`}
              </Badge>
            </div>
          </div>

          {/* Emergency Power Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePowerToggle}
                data-testid="button-emergency-power"
                className={`h-8 w-8 rounded-full transition-all ${
                  isActive 
                    ? 'text-green-500 hover:bg-green-500/10 hover:text-green-600' 
                    : 'text-red-500 hover:bg-red-500/10 hover:text-red-600 animate-pulse'
                }`}
              >
                <Power className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              {isActive ? 'Emergency Stop' : 'Resume Trading'}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <TradingModeToggle />

          {/* Theme Toggle */}
          <ThemeToggle />

          <div className="h-6 w-px bg-border" />

          {/* Settings */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              console.log('Settings clicked');
              onSettingsClick?.();
            }}
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* Logout */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              console.log('Logout clicked');
              onLogoutClick?.();
            }}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
