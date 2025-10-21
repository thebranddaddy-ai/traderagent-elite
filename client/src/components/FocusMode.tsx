import { useState, useEffect } from "react";
import { X, Brain, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FocusModeProps {
  isActive: boolean;
  onToggle: () => void;
}

export function FocusMode({ isActive, onToggle }: FocusModeProps) {
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isActive && !sessionStart) {
      setSessionStart(Date.now());
    } else if (!isActive && sessionStart) {
      // Session ended
      const duration = Math.floor((Date.now() - sessionStart) / 1000);
      setSessionStart(null);
      setElapsedTime(0);
      
      // Log focus session completion
      logFocusSession(duration);
    }
  }, [isActive, sessionStart]);

  useEffect(() => {
    if (!isActive || !sessionStart) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, sessionStart]);

  const logFocusSession = async (duration: number) => {
    try {
      const response = await fetch("/api/focus/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration, completed: true }),
      });
      
      if (response.ok) {
        toast({
          title: "Focus session completed",
          description: `Great work! You stayed focused for ${formatTime(duration)}.`,
        });
      }
    } catch (error) {
      console.error("Error logging focus session:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
      data-testid="focus-mode-overlay"
    >
      {/* Focus Mode Header */}
      <div className="fixed top-0 left-0 right-0 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Focus Mode Active</span>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-md">
              <Timer className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            data-testid="button-exit-focus"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Focus Mode
          </Button>
        </div>
      </div>

      {/* Calm Message */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2">
        <Card className="bg-card/80 backdrop-blur-md border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              All systems calm. Trade with clarity.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Break Reminder (after 30 mins) */}
      {elapsedTime > 1800 && elapsedTime % 1800 < 5 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-6">
              <p className="text-sm text-warning">
                Consider taking a short break. You've been focused for {Math.floor(elapsedTime / 60)} minutes.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Keyboard shortcut hook
export function useFocusModeShortcut(onToggle: () => void) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // F key (not in input/textarea)
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onToggle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onToggle]);
}
