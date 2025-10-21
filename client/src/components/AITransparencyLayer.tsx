import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Info, Database, Brain } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AITransparencyLayerProps {
  reasoning: string;
  dataUsed: Record<string, any>;
  confidence?: number;
  variant?: "compact" | "detailed";
}

export function AITransparencyLayer({
  reasoning,
  dataUsed,
  confidence,
  variant = "compact"
}: AITransparencyLayerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const renderDataValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const formatDataKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-t border-border pt-3 mt-3">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-foreground"
            data-testid="button-toggle-transparency"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              <span className="text-xs">
                {isOpen ? 'Hide' : 'Show'} AI reasoning & data
              </span>
            </div>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3 space-y-3">
          {/* Why this recommendation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Brain className="w-3.5 h-3.5" />
              Why this recommendation
            </div>
            <Card className="p-3 bg-muted/30">
              <p className="text-sm text-foreground leading-relaxed">
                {reasoning}
              </p>
              {confidence !== undefined && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI Confidence</span>
                    <Badge variant="outline" className="text-xs">
                      {confidence}%
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* What data was analyzed */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Database className="w-3.5 h-3.5" />
              What data was analyzed
            </div>
            <Card className="p-3 bg-muted/30">
              <div className="space-y-2">
                {Object.entries(dataUsed).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 text-xs">
                    <span className="text-muted-foreground font-medium min-w-[100px]">
                      {formatDataKey(key)}:
                    </span>
                    <span className="text-foreground font-mono text-right flex-1 break-all">
                      {renderDataValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {variant === "detailed" && (
            <div className="text-xs text-muted-foreground pt-2">
              <Info className="w-3 h-3 inline mr-1" />
              This AI learns from your feedback. Use 👍/👎 to improve recommendations.
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
