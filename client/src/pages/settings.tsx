import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Check, X, Smartphone, AlertTriangle } from "lucide-react";
import { ExchangeConnectPanel } from "@/components/ExchangeConnectPanel";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [totpToken, setTotpToken] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // Setup TOTP
  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/auth/totp/setup", "POST");
      return await response.json();
    },
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setSecret(data.secret);
      toast({
        title: "QR Code Generated",
        description: "Scan the QR code with Google Authenticator",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });

  // Verify and Enable TOTP
  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("/api/auth/totp/verify", "POST", { token });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "2FA Enabled!",
        description: "Google Authenticator is now active on your account",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setQrCode(null);
      setSecret(null);
      setTotpToken("");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again",
        variant: "destructive",
      });
    },
  });

  // Disable TOTP
  const disableMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/auth/totp/disable", "POST");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "2FA Disabled",
        description: "Google Authenticator has been removed from your account",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Disable Failed",
        description: error.message || "Failed to disable 2FA",
        variant: "destructive",
      });
    },
  });

  const handleSetup = () => {
    setupMutation.mutate();
  };

  const handleVerify = () => {
    if (!totpToken) {
      toast({
        title: "Error",
        description: "Please enter the code from your authenticator app",
        variant: "destructive",
      });
      return;
    }
    verifyMutation.mutate(totpToken);
  };

  const handleDisable = () => {
    if (confirm("Are you sure you want to disable 2FA?")) {
      disableMutation.mutate();
    }
  };

  // Fetch Risk Guard settings
  const { data: riskSettings } = useQuery({
    queryKey: ["/api/risk/status", user?.id],
    enabled: !!user?.id,
  });

  // Local state for risk limit inputs
  const [dailyLossPercent, setDailyLossPercent] = useState<string>("10");
  const [dailyLossAmount, setDailyLossAmount] = useState<string>("1000");
  const [monthlyLossPercent, setMonthlyLossPercent] = useState<string>("25");
  const [monthlyLossAmount, setMonthlyLossAmount] = useState<string>("5000");

  // Sync local state with query data
  useEffect(() => {
    if (riskSettings) {
      setDailyLossPercent((riskSettings as any)?.maxDailyLossPercent?.toString() || "10");
      setDailyLossAmount((riskSettings as any)?.maxDailyLossAmount?.toString() || "1000");
      setMonthlyLossPercent((riskSettings as any)?.maxMonthlyLossPercent?.toString() || "25");
      setMonthlyLossAmount((riskSettings as any)?.maxMonthlyLossAmount?.toString() || "5000");
    }
  }, [riskSettings]);

  // Update risk guard enforcement settings
  const updateRiskSettings = useMutation({
    mutationFn: async (settings: { 
      enforceDailyLossLimit?: boolean; 
      enforceMonthlyLossLimit?: boolean;
      maxDailyLossPercent?: string;
      maxDailyLossAmount?: string;
      maxMonthlyLossPercent?: string;
      maxMonthlyLossAmount?: string;
    }) => {
      return await apiRequest(`/api/risk/settings`, "PATCH", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/status", user?.id] });
      toast({
        title: "Settings Updated",
        description: "Your risk guard settings have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6" data-testid="text-settings-title">
        Account Settings
      </h1>

      {/* Two-Factor Authentication Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account with Google Authenticator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5" />
              <div>
                <p className="font-medium">Google Authenticator</p>
                <p className="text-sm text-muted-foreground">
                  {user?.totpEnabled ? "Active" : "Not set up"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user?.totpEnabled ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Enabled</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Disabled</span>
                </>
              )}
            </div>
          </div>

          {/* Setup Flow */}
          {!user?.totpEnabled && !qrCode && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set up Google Authenticator to protect your account with time-based one-time passwords
              </p>
              <Button
                onClick={handleSetup}
                disabled={setupMutation.isPending}
                data-testid="button-setup-2fa"
              >
                {setupMutation.isPending ? "Generating..." : "Set Up 2FA"}
              </Button>
            </div>
          )}

          {/* QR Code Display */}
          {qrCode && (
            <div className="space-y-4 border rounded-lg p-6">
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-lg">Scan QR Code</h3>
                <p className="text-sm text-muted-foreground">
                  Open Google Authenticator and scan this QR code
                </p>
                
                {/* QR Code Image */}
                <div className="flex justify-center">
                  <img 
                    src={qrCode} 
                    alt="QR Code for 2FA" 
                    className="w-64 h-64 border rounded-lg"
                    data-testid="img-qr-code"
                  />
                </div>

                {/* Manual Entry Code */}
                {secret && (
                  <div className="bg-muted p-3 rounded">
                    <p className="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
                    <code className="text-sm font-mono" data-testid="text-secret-code">
                      {secret}
                    </code>
                  </div>
                )}

                {/* Verification */}
                <div className="space-y-3 max-w-sm mx-auto">
                  <Label htmlFor="totp-verify">Enter 6-digit code from app</Label>
                  <Input
                    id="totp-verify"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ""))}
                    data-testid="input-totp-verify"
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={verifyMutation.isPending || totpToken.length !== 6}
                    className="w-full"
                    data-testid="button-verify-2fa"
                  >
                    {verifyMutation.isPending ? "Verifying..." : "Verify & Enable 2FA"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Disable 2FA */}
          {user?.totpEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Disabling 2FA will remove the extra security layer from your account
              </p>
              <Button
                onClick={handleDisable}
                disabled={disableMutation.isPending}
                variant="destructive"
                data-testid="button-disable-2fa"
              >
                {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Exchange Integration */}
      <ExchangeConnectPanel />

      {/* Risk Guard Settings */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <CardTitle>Risk Guard Protection</CardTitle>
          </div>
          <CardDescription>
            Control when Risk Guard blocks trades vs. showing warnings only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>By default</strong>, Risk Guard shows warnings but <strong>never blocks trades</strong>. 
              Enable limits below to enforce hard stop-loss protection.
            </p>
          </div>

          {/* Daily Loss Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enforce-daily" className="text-base">
                Daily Loss Limit Enforcement
              </Label>
              <Switch
                id="enforce-daily"
                checked={(riskSettings as any)?.enforceDailyLossLimit || false}
                onCheckedChange={(checked) => 
                  updateRiskSettings.mutate({ enforceDailyLossLimit: checked })
                }
                disabled={updateRiskSettings.isPending}
                data-testid="switch-enforce-daily-limit"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="daily-loss-percent" className="text-sm text-muted-foreground">
                  Max Daily Loss (%)
                </Label>
                <Input
                  id="daily-loss-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={dailyLossPercent}
                  onChange={(e) => setDailyLossPercent(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(dailyLossPercent);
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      updateRiskSettings.mutate({ maxDailyLossPercent: value.toString() });
                    }
                  }}
                  disabled={updateRiskSettings.isPending}
                  data-testid="input-max-daily-loss-percent"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="daily-loss-amount" className="text-sm text-muted-foreground">
                  Max Daily Loss ($)
                </Label>
                <Input
                  id="daily-loss-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={dailyLossAmount}
                  onChange={(e) => setDailyLossAmount(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(dailyLossAmount);
                    if (!isNaN(value) && value >= 0) {
                      updateRiskSettings.mutate({ maxDailyLossAmount: value.toString() });
                    }
                  }}
                  disabled={updateRiskSettings.isPending}
                  data-testid="input-max-daily-loss-amount"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Monthly Loss Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enforce-monthly" className="text-base">
                Monthly Loss Limit Enforcement
              </Label>
              <Switch
                id="enforce-monthly"
                checked={(riskSettings as any)?.enforceMonthlyLossLimit || false}
                onCheckedChange={(checked) => 
                  updateRiskSettings.mutate({ enforceMonthlyLossLimit: checked })
                }
                disabled={updateRiskSettings.isPending}
                data-testid="switch-enforce-monthly-limit"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthly-loss-percent" className="text-sm text-muted-foreground">
                  Max Monthly Loss (%)
                </Label>
                <Input
                  id="monthly-loss-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={monthlyLossPercent}
                  onChange={(e) => setMonthlyLossPercent(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(monthlyLossPercent);
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      updateRiskSettings.mutate({ maxMonthlyLossPercent: value.toString() });
                    }
                  }}
                  disabled={updateRiskSettings.isPending}
                  data-testid="input-max-monthly-loss-percent"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="monthly-loss-amount" className="text-sm text-muted-foreground">
                  Max Monthly Loss ($)
                </Label>
                <Input
                  id="monthly-loss-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyLossAmount}
                  onChange={(e) => setMonthlyLossAmount(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(monthlyLossAmount);
                    if (!isNaN(value) && value >= 0) {
                      updateRiskSettings.mutate({ maxMonthlyLossAmount: value.toString() });
                    }
                  }}
                  disabled={updateRiskSettings.isPending}
                  data-testid="input-max-monthly-loss-amount"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Leave these disabled to maintain full trading freedom with AI-powered warnings. 
              Enable only if you want strict automated protection.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium" data-testid="text-user-email">{user?.email || "Not set"}</span>
            
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.firstName || user?.lastName || "Not set"}
            </span>
            
            <span className="text-muted-foreground">User ID:</span>
            <span className="font-mono text-xs" data-testid="text-user-id">{user?.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
