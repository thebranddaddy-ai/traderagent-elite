import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModulePreviewProps {
  moduleName: string;
  moduleDescription: string;
  onKeep: () => void;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function ModulePreview({
  moduleName,
  moduleDescription,
  onKeep,
  onDismiss,
  children,
}: ModulePreviewProps) {
  const [timeLeft, setTimeLeft] = useState(5);
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleKeep = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onKeep();
    }, 300);
  }, [onKeep]);

  const handleDismiss = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProgress((timeLeft / 5) * 100);
    
    // Auto-dismiss when timer reaches 0
    if (timeLeft <= 0 && isVisible && !isFadingOut) {
      handleDismiss();
    }
  }, [timeLeft, isVisible, isFadingOut, handleDismiss]);

  return (
    <div className="relative">
      {/* Module Content with Preview Overlay */}
      <div className={cn(
        "transition-opacity duration-300",
        isVisible && !isFadingOut ? "opacity-50" : "opacity-100"
      )}>
        {children}
      </div>

      {/* Preview Overlay Card */}
      {isVisible && (
        <Card 
          className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6",
            "bg-background/95 backdrop-blur-sm border-2 border-primary",
            "transition-opacity duration-300",
            isFadingOut ? "animate-out fade-out duration-300" : "animate-in fade-in duration-300"
          )}
          data-testid="module-preview-overlay"
        >
          {/* Preview Icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Eye className="w-8 h-8 text-primary" />
          </div>

          {/* Module Info */}
          <div className="text-center space-y-2">
            <h3 
              className="text-lg font-semibold"
              data-testid="text-preview-title"
            >
              Previewing: {moduleName}
            </h3>
            <p 
              className="text-sm text-muted-foreground max-w-xs"
              data-testid="text-preview-description"
            >
              {moduleDescription}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-xs space-y-2">
            <Progress 
              value={progress} 
              className="h-2"
              data-testid="progress-preview"
            />
            <p 
              className="text-xs text-center text-muted-foreground"
              data-testid="text-preview-timer"
            >
              {timeLeft.toFixed(1)}s remaining
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={handleDismiss}
              data-testid="button-dismiss-preview"
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Dismiss
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={handleKeep}
              data-testid="button-keep-preview"
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Keep Module
            </Button>
          </div>

          {/* Subtle Hint */}
          <p className="text-xs text-muted-foreground italic">
            This module will auto-dismiss in {Math.ceil(timeLeft)} seconds
          </p>
        </Card>
      )}
    </div>
  );
}
