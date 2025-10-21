import { Home, History, BarChart3, Settings, Shield, Brain, TrendingUp, BookOpen, Calendar } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const tradingItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Order History",
    url: "/orders",
    icon: History,
  },
  {
    title: "Charts",
    url: "/charts",
    icon: BarChart3,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const northStarItems = [
  {
    title: "Privacy & Control",
    url: "/privacy",
    icon: Shield,
  },
  {
    title: "AI Transparency",
    url: "/ai-transparency",
    icon: Brain,
  },
  {
    title: "Learning Progress",
    url: "/learning-progress",
    icon: TrendingUp,
  },
];

const phaseCItems = [
  {
    title: "Trade Journal",
    url: "/trade-journal",
    icon: BookOpen,
  },
  {
    title: "Timeframe Analysis",
    url: "/timeframe-analysis",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trading</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tradingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>North Star</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {northStarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Phase C: Predictions & Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {phaseCItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
