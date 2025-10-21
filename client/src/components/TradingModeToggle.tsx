import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, Shield, Zap } from "lucide-react";

export function TradingModeToggle() {
  const [isRealMode, setIsRealMode] = useState(() => {
    return localStorage.getItem("tradingMode") === "real";
  });

  useEffect(() => {
    localStorage.setItem("tradingMode", isRealMode ? "real" : "paper");
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent("tradingModeChange", { detail: { mode: isRealMode ? "real" : "paper" } }));
  }, [isRealMode]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover-elevate border border-border"
          data-testid="button-trading-mode-toggle"
        >
          {isRealMode ? (
            <Shield className="h-4 w-4 text-destructive" />
          ) : (
            <Zap className="h-4 w-4 text-primary" />
          )}
          <Badge 
            variant={isRealMode ? "destructive" : "default"}
            className="font-semibold"
            data-testid="badge-trading-mode"
          >
            {isRealMode ? "REAL" : "PAPER"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" data-testid="popover-trading-mode">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Trading Mode</h4>
            <p className="text-xs text-muted-foreground">
              Switch between paper trading (simulated) and real trading (live exchange).
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="mode-toggle" className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium">
                {isRealMode ? "Real Trading" : "Paper Trading"}
              </span>
            </Label>
            <Switch
              id="mode-toggle"
              checked={isRealMode}
              onCheckedChange={setIsRealMode}
              data-testid="switch-trading-mode"
            />
          </div>

          {isRealMode ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive">Real Trading Active</p>
                <p className="text-xs text-muted-foreground">
                  Trades will execute on live exchange using real funds. Ensure API keys are configured.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-primary">Paper Trading Active</p>
                <p className="text-xs text-muted-foreground">
                  Practice trading with simulated funds. Perfect for testing strategies risk-free.
                </p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
