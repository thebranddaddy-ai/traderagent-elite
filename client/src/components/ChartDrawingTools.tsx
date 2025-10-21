import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Minus, TrendingUp, Ruler, Layers, MoveHorizontal, Type, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChartTelemetry } from "@/hooks/useChartTelemetry";

export interface Drawing {
  id: string;
  type: "trendline" | "fibonacci" | "zone" | "horizontal" | "text" | "alert";
  points: { time: number; price: number }[]; // Store in price/time space, not pixels
  color?: string;
  label?: string; // For text annotations and price labels
}

interface ChartDrawingToolsProps {
  width: number;
  height: number;
  drawings: Drawing[];
  onDrawingsChange: (drawings: Drawing[]) => void;
  priceScale: { min: number; max: number };
  timeScale: { min: number; max: number }; // Actual time range from chart
}

export function ChartDrawingTools({
  width,
  height,
  drawings,
  onDrawingsChange,
  priceScale,
  timeScale,
}: ChartDrawingToolsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<"none" | "trendline" | "fibonacci" | "zone" | "horizontal" | "text" | "alert">("none");
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [pendingTextPoint, setPendingTextPoint] = useState<{ time: number; price: number } | null>(null);
  const { logDrawingToolSelected, logDrawingCreated, logDrawingDeleted } = useChartTelemetry();

  // Wrapper for setActiveTool with telemetry
  const selectTool = (tool: typeof activeTool) => {
    if (tool !== "none") {
      logDrawingToolSelected(tool);
    }
    setActiveTool(tool);
  };

  // Convert price/time to canvas pixels
  const priceToY = (price: number): number => {
    const priceRange = priceScale.max - priceScale.min;
    if (priceRange === 0) return height / 2;
    return height - ((price - priceScale.min) / priceRange) * height;
  };

  const timeToX = (time: number): number => {
    const timeRange = timeScale.max - timeScale.min;
    if (timeRange === 0) return width / 2;
    return ((time - timeScale.min) / timeRange) * width;
  };

  // Convert canvas pixels to price/time
  const yToPrice = (y: number): number => {
    const priceRange = priceScale.max - priceScale.min;
    return priceScale.max - (y / height) * priceRange;
  };

  const xToTime = (x: number): number => {
    const timeRange = timeScale.max - timeScale.min;
    return timeScale.min + (x / width) * timeRange;
  };

  // Draw all drawings on canvas (redraw when scales change for proper persistence)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw all existing drawings
    drawings.forEach((drawing) => {
      drawShape(ctx, drawing);
    });

    // Draw current drawing being created
    if (currentDrawing && currentDrawing.points && currentDrawing.points.length > 0) {
      drawShape(ctx, currentDrawing as Drawing);
    }
  }, [drawings, currentDrawing, width, height, priceScale, timeScale]);

  const drawShape = (ctx: CanvasRenderingContext2D, drawing: Partial<Drawing>) => {
    if (!drawing.points || drawing.points.length === 0) return;

    ctx.strokeStyle = drawing.color || "#3B82F6";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    if (drawing.type === "trendline" && drawing.points.length >= 2) {
      // Convert price/time to pixels
      const x1 = timeToX(drawing.points[0].time);
      const y1 = priceToY(drawing.points[0].price);
      const x2 = timeToX(drawing.points[1].time);
      const y2 = priceToY(drawing.points[1].price);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (drawing.type === "fibonacci" && drawing.points.length >= 2) {
      // Draw Fibonacci levels using price coordinates
      const startPrice = drawing.points[0].price;
      const endPrice = drawing.points[1].price;
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      
      levels.forEach((level) => {
        const price = startPrice + (endPrice - startPrice) * level;
        const y = priceToY(price);
        
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = level === 0.5 ? "#10B981" : "#3B82F6";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Draw level label
        ctx.fillStyle = "#9CA3AF";
        ctx.font = "12px monospace";
        ctx.fillText(`${(level * 100).toFixed(1)}%`, 5, y - 5);
      });

      // Draw vertical line
      ctx.setLineDash([]);
      ctx.strokeStyle = "#3B82F6";
      const x1 = timeToX(drawing.points[0].time);
      const y1 = priceToY(drawing.points[0].price);
      const x2 = timeToX(drawing.points[1].time);
      const y2 = priceToY(drawing.points[1].price);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (drawing.type === "zone" && drawing.points.length >= 2) {
      // Draw support/resistance zone using price coordinates
      const price1 = drawing.points[0].price;
      const price2 = drawing.points[1].price;
      const y1 = Math.min(priceToY(price1), priceToY(price2));
      const y2 = Math.max(priceToY(price1), priceToY(price2));
      
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(0, y1, width, y2 - y1);
      
      ctx.strokeStyle = "#3B82F6";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(width, y1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, y2);
      ctx.lineTo(width, y2);
      ctx.stroke();
    } else if (drawing.type === "horizontal" && drawing.points.length >= 1) {
      // Draw horizontal support/resistance line
      const price = drawing.points[0].price;
      const y = priceToY(price);
      
      ctx.strokeStyle = drawing.color || "#F59E0B";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Draw price label on right edge
      ctx.setLineDash([]);
      ctx.fillStyle = drawing.color || "#F59E0B";
      ctx.font = "12px monospace";
      const priceText = price.toFixed(2);
      const textWidth = ctx.measureText(priceText).width;
      ctx.fillRect(width - textWidth - 8, y - 12, textWidth + 6, 20);
      ctx.fillStyle = "#000";
      ctx.fillText(priceText, width - textWidth - 5, y + 4);
    } else if (drawing.type === "text" && drawing.points.length >= 1 && drawing.label) {
      // Draw text annotation
      const x = timeToX(drawing.points[0].time);
      const y = priceToY(drawing.points[0].price);
      
      ctx.font = "14px sans-serif";
      ctx.fillStyle = drawing.color || "#10B981";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      
      // Draw text with outline for better visibility
      ctx.strokeText(drawing.label, x + 5, y - 5);
      ctx.fillText(drawing.label, x + 5, y - 5);
    } else if (drawing.type === "alert" && drawing.points.length >= 1) {
      // Draw alert price marker
      const price = drawing.points[0].price;
      const y = priceToY(price);
      
      // Draw horizontal dashed line in orange
      ctx.strokeStyle = drawing.color || "#F97316";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Draw bell icon on left edge
      ctx.setLineDash([]);
      ctx.fillStyle = drawing.color || "#F97316";
      ctx.font = "16px sans-serif";
      ctx.fillText("🔔", 8, y + 5);
      
      // Draw price label on right edge
      ctx.fillStyle = drawing.color || "#F97316";
      ctx.font = "11px monospace";
      const priceText = `Alert: ${price.toFixed(2)}`;
      const textWidth = ctx.measureText(priceText).width;
      ctx.fillRect(width - textWidth - 8, y - 10, textWidth + 6, 18);
      ctx.fillStyle = "#FFF";
      ctx.fillText(priceText, width - textWidth - 5, y + 3);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "none") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel coordinates to price/time
    const time = xToTime(x);
    const price = yToPrice(y);

    // Horizontal line only needs one point - complete immediately
    if (activeTool === "horizontal") {
      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: "horizontal",
        points: [{ time, price }],
        color: "#F59E0B",
      };
      onDrawingsChange([...drawings, newDrawing]);
      logDrawingCreated("horizontal", newDrawing.id);
      setActiveTool("none");
      return;
    }

    // Alert marker only needs one point - complete immediately
    if (activeTool === "alert") {
      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: "alert",
        points: [{ time, price }],
        color: "#F97316",
        label: "Alert",
      };
      onDrawingsChange([...drawings, newDrawing]);
      logDrawingCreated("alert", newDrawing.id);
      setActiveTool("none");
      return;
    }

    // Text annotation needs text input - open dialog
    if (activeTool === "text") {
      setPendingTextPoint({ time, price });
      setTextDialogOpen(true);
      return;
    }

    setIsDrawing(true);
    setCurrentDrawing({
      id: `drawing-${Date.now()}`,
      type: activeTool,
      points: [{ time, price }],
      color: "#3B82F6",
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel coordinates to price/time
    const time = xToTime(x);
    const price = yToPrice(y);

    setCurrentDrawing({
      ...currentDrawing,
      points: [currentDrawing.points![0], { time, price }],
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDrawing) return;

    if (currentDrawing.points && currentDrawing.points.length >= 2) {
      const drawing = currentDrawing as Drawing;
      onDrawingsChange([...drawings, drawing]);
      logDrawingCreated(drawing.type, drawing.id);
    }

    setIsDrawing(false);
    setCurrentDrawing(null);
    setActiveTool("none");
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !pendingTextPoint) return;

    const newDrawing: Drawing = {
      id: `drawing-${Date.now()}`,
      type: "text",
      points: [pendingTextPoint],
      color: "#10B981",
      label: textInput.trim(),
    };

    onDrawingsChange([...drawings, newDrawing]);
    logDrawingCreated("text", newDrawing.id);
    setTextDialogOpen(false);
    setTextInput("");
    setPendingTextPoint(null);
    setActiveTool("none");
  };

  const clearDrawings = () => {
    // Log deletion for all drawings
    drawings.forEach(drawing => {
      logDrawingDeleted(drawing.type, drawing.id);
    });
    onDrawingsChange([]);
  };

  return (
    <div className="relative">
      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={cn(
          "absolute top-0 left-0",
          activeTool !== "none" ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-testid="canvas-drawing"
      />

      {/* Drawing Tools Toolbar */}
      <div className="absolute top-2 left-2 flex gap-1 bg-card/95 backdrop-blur-sm border rounded-lg p-1">
        <Button
          size="sm"
          variant={activeTool === "trendline" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "trendline" ? "none" : "trendline")}
          data-testid="button-draw-trendline"
          className="h-8 w-8 p-0"
        >
          <TrendingUp className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={activeTool === "horizontal" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "horizontal" ? "none" : "horizontal")}
          data-testid="button-draw-horizontal"
          className="h-8 w-8 p-0"
        >
          <MoveHorizontal className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={activeTool === "text" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "text" ? "none" : "text")}
          data-testid="button-draw-text"
          className="h-8 w-8 p-0"
        >
          <Type className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={activeTool === "alert" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "alert" ? "none" : "alert")}
          data-testid="button-draw-alert"
          className="h-8 w-8 p-0"
        >
          <Bell className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={activeTool === "fibonacci" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "fibonacci" ? "none" : "fibonacci")}
          data-testid="button-draw-fibonacci"
          className="h-8 w-8 p-0"
        >
          <Ruler className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={activeTool === "zone" ? "default" : "ghost"}
          onClick={() => selectTool(activeTool === "zone" ? "none" : "zone")}
          data-testid="button-draw-zone"
          className="h-8 w-8 p-0"
        >
          <Layers className="h-4 w-4" />
        </Button>

        <div className="w-px bg-border" />

        <Button
          size="sm"
          variant="ghost"
          onClick={clearDrawings}
          disabled={drawings.length === 0}
          data-testid="button-clear-drawings"
          className="h-8 w-8 p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {/* Text Annotation Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent data-testid="dialog-text-annotation">
          <DialogHeader>
            <DialogTitle>Add Text Annotation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter annotation text..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTextSubmit();
                }
              }}
              autoFocus
              data-testid="input-annotation-text"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTextDialogOpen(false);
                setTextInput("");
                setPendingTextPoint(null);
                setActiveTool("none");
              }}
              data-testid="button-cancel-annotation"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              data-testid="button-submit-annotation"
            >
              Add Annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
