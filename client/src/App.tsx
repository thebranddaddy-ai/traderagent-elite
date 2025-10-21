import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { TradingModeToggle } from "@/components/TradingModeToggle";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import OrderHistory from "@/pages/order-history";
import Charts from "@/pages/charts";
import Settings from "@/pages/settings";
import PrivacySettings from "@/pages/privacy-settings";
import AITransparency from "@/pages/ai-transparency";
import LearningProgress from "@/pages/learning-progress";
import TradeJournal from "@/pages/trade-journal";
import TimeframeAnalysis from "@/pages/timeframe-analysis";
import AICoach from "@/pages/ai-coach";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show landing/login page for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Show authenticated app
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/register">{() => { window.location.href = "/"; return null; }}</Route>
      <Route path="/orders" component={OrderHistory} />
      <Route path="/charts" component={Charts} />
      <Route path="/settings" component={Settings} />
      <Route path="/privacy" component={PrivacySettings} />
      <Route path="/ai-transparency" component={AITransparency} />
      <Route path="/learning-progress" component={LearningProgress} />
      <Route path="/trade-journal" component={TradeJournal} />
      <Route path="/timeframe-analysis" component={TimeframeAnalysis} />
      <Route path="/ai-coach" component={AICoach} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthenticatedLayout style={style} />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedLayout({ style }: { style: any }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show landing page without sidebar/header for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return <Router />;
  }

  // Show full app with sidebar for authenticated users
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <Router />
        </main>
      </div>
    </SidebarProvider>
  );
}

export default App;
