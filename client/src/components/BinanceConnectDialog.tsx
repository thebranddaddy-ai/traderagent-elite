import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, ExternalLink, AlertCircle, Key, Lock, Coins } from "lucide-react";

interface BinanceConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BinanceConnectDialog({ open, onOpenChange }: BinanceConnectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);

  const connectMutation = useMutation({
    mutationFn: async (data: { exchange: string; apiKey: string; apiSecret: string; permissions: string; testnet: boolean }) => {
      return await apiRequest("/api/exchange/connect", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange/status"] });
      toast({
        title: "Exchange Connected",
        description: "Your Binance account has been securely connected.",
      });
      onOpenChange(false);
      setApiKey("");
      setApiSecret("");
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect exchange. Please verify your API credentials.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    if (!apiKey || !apiSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both API key and secret.",
        variant: "destructive",
      });
      return;
    }

    connectMutation.mutate({
      exchange: "binance",
      apiKey,
      apiSecret,
      permissions: "SPOT_TRADING,USER_DATA,READ_ONLY",
      testnet,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]" data-testid="dialog-binance-connect">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            </div>
            Connect to Binance
          </DialogTitle>
          <DialogDescription>
            Securely connect your Binance account to execute real trades with advanced security
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-semibold">Security First:</span> Your API keys are encrypted with AES-256-GCM before storage. All trades require 2-step confirmation and respect your Risk Guard limits.
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </Label>
            <Input
              id="api-key"
              type="text"
              placeholder="Enter your Binance API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              data-testid="input-api-key"
              className="font-mono text-sm"
            />
          </div>

          {/* API Secret Input */}
          <div className="space-y-2">
            <Label htmlFor="api-secret" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              API Secret
            </Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your Binance API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              data-testid="input-api-secret"
              className="font-mono text-sm"
            />
          </div>

          {/* Testnet Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label htmlFor="testnet" className="text-sm font-medium">
                Use Testnet
              </Label>
              <p className="text-xs text-muted-foreground">
                Connect to Binance Testnet for safe testing
              </p>
            </div>
            <Switch
              id="testnet"
              checked={testnet}
              onCheckedChange={setTestnet}
              data-testid="switch-testnet"
            />
          </div>

          {/* Setup Instructions */}
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-xs">
                <p className="font-semibold">How to get your Binance API keys:</p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                  <li>Go to Binance → Account → API Management</li>
                  <li>Create a new API key with "Spot & Margin Trading" enabled</li>
                  <li>Do <span className="font-semibold">NOT</span> enable withdrawal permissions</li>
                  <li>Copy your API key and secret here</li>
                </ol>
                <a
                  href={testnet ? "https://testnet.binance.vision/" : "https://www.binance.com/en/my/settings/api-management"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                  data-testid="link-binance-api"
                >
                  Open Binance API Management
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
            disabled={connectMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!apiKey || !apiSecret || connectMutation.isPending}
            data-testid="button-connect"
          >
            {connectMutation.isPending ? "Connecting..." : "Connect Exchange"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
