import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { name?: string; email: string; password: string }) => {
      const response = await apiRequest("/api/auth/demo-signup", "POST", data);
      const result = await response.json();
      return result;
    },
    onSuccess: async (data) => {
      toast({
        title: "Welcome Back!",
        description: "Successfully logged in. Redirecting to dashboard...",
      });
      // Wait for auth state to update before redirecting
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      // Small delay to ensure state propagation
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Login failed. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate({ 
      name: name || undefined, 
      email, 
      password 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            Demo / Test Login
          </CardTitle>
          <CardDescription className="text-base">
            Enter your details to continue
          </CardDescription>
          <div className="pt-2">
            <div className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Demo/testing mode — Binance login disabled
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loginMutation.isPending}
              data-testid="button-continue"
            >
              {loginMutation.isPending ? "Please wait..." : "Continue"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            New users will be automatically registered
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
