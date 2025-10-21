import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Shield, Coins, Building2, Anchor, Zap } from "lucide-react";

interface ExchangeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExchange: (exchange: string) => void;
}

interface ExchangeOption {
  id: string;
  name: string;
  icon: typeof Coins;
  iconColor: string;
  bgColor: string;
  description: string;
  supported: boolean;
  tag?: string;
}

const EXCHANGES: ExchangeOption[] = [
  {
    id: "binance",
    name: "Binance",
    icon: Coins,
    iconColor: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-500/10",
    description: "World's largest crypto exchange by trading volume",
    supported: true,
    tag: "Most Popular"
  },
  {
    id: "coinbase",
    name: "Coinbase",
    icon: Building2,
    iconColor: "text-blue-600 dark:text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "US-based exchange with strong regulatory compliance",
    supported: false,
  },
  {
    id: "kraken",
    name: "Kraken",
    icon: Anchor,
    iconColor: "text-purple-600 dark:text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Established exchange with advanced trading features",
    supported: false,
  },
  {
    id: "bybit",
    name: "Bybit",
    icon: Zap,
    iconColor: "text-orange-600 dark:text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Popular for derivatives and futures trading",
    supported: false,
  }
];

export function ExchangeSelectionDialog({ open, onOpenChange, onSelectExchange }: ExchangeSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-exchange-selection">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect Exchange</DialogTitle>
          <DialogDescription>
            Select an exchange to connect to your TraderAgent account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {EXCHANGES.map((exchange) => (
            <button
              key={exchange.id}
              onClick={() => {
                if (exchange.supported) {
                  onSelectExchange(exchange.id);
                }
              }}
              disabled={!exchange.supported}
              className={`
                w-full p-4 rounded-lg border-2 text-left transition-all
                ${exchange.supported 
                  ? 'border-border hover:border-primary hover:bg-accent/50 cursor-pointer hover-elevate active-elevate-2' 
                  : 'border-border/50 opacity-50 cursor-not-allowed'
                }
              `}
              data-testid={`button-exchange-${exchange.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Exchange Icon */}
                  <div className={`w-12 h-12 rounded-full ${exchange.bgColor} flex items-center justify-center`}>
                    <exchange.icon className={`h-6 w-6 ${exchange.iconColor}`} />
                  </div>
                  
                  {/* Exchange Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{exchange.name}</h3>
                      {exchange.tag && (
                        <Badge variant="default" className="text-xs">
                          {exchange.tag}
                        </Badge>
                      )}
                      {!exchange.supported && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {exchange.description}
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                {exchange.supported && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
          <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
          <p className="text-muted-foreground">
            Your API keys are encrypted with <span className="font-semibold">AES-256-GCM</span> before storage. 
            All trades require 2-step confirmation and respect your Risk Guard limits.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
