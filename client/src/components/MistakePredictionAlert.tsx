import { Shield, AlertTriangle, Info, Lightbulb, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface MistakePrediction {
  id: string;
  predictionType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string;
  evidence: string[];
  alternativeSuggestion: string;
  triggerFactors: string[];
}

interface MistakePredictionAlertProps {
  prediction: MistakePrediction;
  onDismiss: () => void;
  onModifyTrade: () => void;
  onProceedAnyway: () => void;
}

export function MistakePredictionAlert({
  prediction,
  onDismiss,
  onModifyTrade,
  onProceedAnyway,
}: MistakePredictionAlertProps) {
  const [showDetails, setShowDetails] = useState(false);

  const severityConfig = {
    low: {
      icon: Info,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      label: "Heads Up",
    },
    medium: {
      icon: Shield,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      label: "Worth Considering",
    },
    high: {
      icon: AlertTriangle,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      label: "Important Notice",
    },
    critical: {
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "Critical Alert",
    },
  };

  const config = severityConfig[prediction.severity];
  const IconComponent = config.icon;

  // Format prediction type to friendly label
  const formatPredictionType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className={`${config.border} border-2`} data-testid={`alert-mistake-${prediction.severity}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`${config.bg} p-2 rounded-lg`}>
            <IconComponent className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold" data-testid="text-mistake-label">{config.label}</h3>
              <Badge variant="outline" className="text-xs" data-testid="badge-mistake-type">
                {formatPredictionType(prediction.predictionType)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-mistake-reasoning">
              {prediction.reasoning}
            </p>
          </div>
        </div>

        {/* Alternative Suggestion */}
        <Alert className="mb-3 bg-accent/30" data-testid="alert-alternative-suggestion">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Better approach:</strong> {prediction.alternativeSuggestion}
          </AlertDescription>
        </Alert>

        {/* Expandable Details */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mb-2 text-xs"
              data-testid="button-toggle-details"
            >
              {showDetails ? "Hide Details" : "Why am I seeing this?"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {/* Evidence Points */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Pattern Evidence:</h4>
              <ul className="space-y-1">
                {prediction.evidence.map((item, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-2" data-testid={`text-evidence-${idx}`}>
                    <span className="text-muted-foreground">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trigger Factors */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">What triggered this:</h4>
              <div className="flex flex-wrap gap-1">
                {prediction.triggerFactors.map((factor, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="text-xs"
                    data-testid={`badge-trigger-${idx}`}
                  >
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>

            {/* AI Confidence */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">AI Confidence</span>
              <Badge variant="outline" className="text-xs" data-testid="badge-mistake-confidence">
                {prediction.confidence}%
              </Badge>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onModifyTrade}
            className="flex-1"
            data-testid="button-modify-trade"
          >
            <Shield className="h-3 w-3 mr-1" />
            Modify Trade
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onProceedAnyway}
            className="flex-1"
            data-testid="button-proceed-anyway"
          >
            Proceed Anyway
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            data-testid="button-dismiss-prediction"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
