import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Shield, Brain, ChartLine } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4" data-testid="text-hero-title">
            TraderAgent Elite
          </h1>
          <p className="text-xl text-muted-foreground mb-8" data-testid="text-hero-subtitle">
            Your AI-Powered Trading Assistant for Smarter Decisions
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/login'}
            data-testid="button-login"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card data-testid="card-feature-trading-dna">
            <CardHeader>
              <Brain className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Trading DNA</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Analyze your trading patterns with AI-powered insights into win rates, profit metrics, and risk scores
              </CardDescription>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-paper-trading">
            <CardHeader>
              <TrendingUp className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Paper Trading</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Practice trading strategies in a risk-free environment with virtual wallets and real-time market data
              </CardDescription>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-ai-briefings">
            <CardHeader>
              <Brain className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>AI Briefings</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get personalized market insights and recommendations powered by OpenAI GPT-4
              </CardDescription>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-risk-guard">
            <CardHeader>
              <Shield className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Risk Guard</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic stop-loss and take-profit protection with real-time price monitoring
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Features */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-8">Advanced Trading Tools</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <ChartLine className="w-10 h-10 mb-2 text-primary mx-auto" />
                <CardTitle>Live Market Data</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Real-time cryptocurrency prices from CoinGecko with WebSocket streaming
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-10 h-10 mb-2 text-primary mx-auto" />
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Complete trading history with P&L tracking and performance analytics
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <ChartLine className="w-10 h-10 mb-2 text-primary mx-auto" />
                <CardTitle>Advanced Charts</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Market price charts and portfolio performance visualization
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Start Trading Smarter?</CardTitle>
              <CardDescription className="text-lg">
                Join TraderAgent Elite and take your trading to the next level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                onClick={() => window.location.href = '/login'}
                data-testid="button-cta-login"
              >
                Sign In with Replit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
