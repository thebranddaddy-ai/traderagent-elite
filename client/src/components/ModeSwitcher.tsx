import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSwitcherProps {
  mode: "simple" | "power";
  onModeChange: (mode: "simple" | "power") => void;
  className?: string;
}

export function ModeSwitcher({ mode, onModeChange, className }: ModeSwitcherProps) {
  const isPowerMode = mode === "power";

  const handleToggle = (checked: boolean) => {
    onModeChange(checked ? "power" : "simple");
  };

  return (
    <div 
      className={cn("flex items-center gap-3", className)}
      data-testid="mode-switcher"
    >
      {/* Simple Mode Indicator */}
      <div className={cn(
        "flex items-center gap-2 transition-opacity duration-300",
        isPowerMode ? "opacity-40" : "opacity-100"
      )}>
        <Shield className={cn(
          "h-4 w-4 transition-colors duration-300",
          !isPowerMode ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium transition-colors duration-300",
          !isPowerMode ? "text-foreground" : "text-muted-foreground"
        )}>
          Simple
        </span>
      </div>

      {/* Switch */}
      <Switch
        checked={isPowerMode}
        onCheckedChange={handleToggle}
        data-testid="switch-mode"
        className="transition-all duration-300"
      />

      {/* Power Mode Indicator */}
      <div className={cn(
        "flex items-center gap-2 transition-opacity duration-300",
        isPowerMode ? "opacity-100" : "opacity-40"
      )}>
        <Zap className={cn(
          "h-4 w-4 transition-colors duration-300",
          isPowerMode ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium transition-colors duration-300",
          isPowerMode ? "text-foreground" : "text-muted-foreground"
        )}>
          Power
        </span>
        {isPowerMode && (
          <Badge 
            variant="secondary" 
            className="text-xs animate-in fade-in duration-300"
            data-testid="badge-power-active"
          >
            All features
          </Badge>
        )}
      </div>
    </div>
  );
}
