import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Settings2, 
  Eye, 
  EyeOff, 
  Plus, 
  Check, 
  X,
  LayoutGrid,
  Shield,
  BarChart3,
  Activity,
  Wallet,
  Zap,
  LineChart,
  Bell,
  Brain,
  Lightbulb,
  Sparkles,
  Cpu,
  Heart,
  BookOpen,
  Calendar,
  Sun,
  Download,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  DASHBOARD_MODULES, 
  MODULE_CATEGORIES, 
  DashboardModule,
  getModulesByCategory,
} from "@/lib/moduleRegistry";
import { cn } from "@/lib/utils";

interface CustomizationModePanelProps {
  visibleModules: string[]; // Array of module IDs
  onModuleToggle: (moduleId: string, visible: boolean) => void;
  onSaveLayout?: () => void;
  onImportLayout?: (mode: "simple" | "power", visibleModules: string[]) => void;
  mode?: "simple" | "power";
  layoutId?: string; // Current layout ID for export
}

// Icon mapping for dynamic rendering
const iconMap: Record<string, any> = {
  Shield, BarChart3, Activity, Wallet, Zap, LineChart, Eye, Bell,
  Brain, Lightbulb, Sparkles, Cpu, Heart, BookOpen, Calendar, Sun,
};

export function CustomizationModePanel({
  visibleModules,
  onModuleToggle,
  onSaveLayout,
  onImportLayout,
  mode = "simple",
  layoutId = "default",
}: CustomizationModePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get available modules (filter by mode)
  const availableModules = mode === "simple" 
    ? DASHBOARD_MODULES.filter(m => !m.powerModeOnly)
    : DASHBOARD_MODULES;

  // Filter by category
  const filteredModules = selectedCategory === "all"
    ? availableModules
    : availableModules.filter(m => m.category === selectedCategory);

  const visibleCount = visibleModules.length;
  const totalCount = availableModules.length;

  const handleToggle = (moduleId: string, currentlyVisible: boolean) => {
    onModuleToggle(moduleId, !currentlyVisible);
  };

  // Export layout as JSON file
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/dashboard/layout/${layoutId}/export`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-layout-${mode}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Layout exported",
        description: "Your dashboard layout has been downloaded as JSON",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export layout. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Import layout from JSON file
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const response = await fetch('/api/dashboard/layout/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jsonData: text,
          layoutName: jsonData.layoutName || "Imported Layout",
        }),
      });

      if (!response.ok) throw new Error('Import failed');
      
      const imported = await response.json();
      
      // Apply imported layout
      if (onImportLayout && imported.mode && imported.visibleModules) {
        onImportLayout(imported.mode, imported.visibleModules);
      }

      toast({
        title: "Layout imported",
        description: `Successfully imported "${imported.layoutName}"`,
      });
      
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Invalid layout file. Please check the format.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderModuleCard = (module: DashboardModule) => {
    const isVisible = visibleModules.includes(module.id);
    const Icon = iconMap[module.icon] || LayoutGrid;

    return (
      <Card 
        key={module.id} 
        className={cn(
          "transition-all hover-elevate cursor-pointer",
          isVisible && "border-primary/30 bg-primary/5"
        )}
        onClick={() => handleToggle(module.id, isVisible)}
        data-testid={`module-card-${module.id}`}
      >
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className={cn(
                "p-2 rounded-md",
                isVisible ? "bg-primary/10 text-primary" : "bg-muted"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-medium leading-none mb-1">
                  {module.name}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-1">
                  {module.description}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={isVisible}
              onCheckedChange={(checked) => handleToggle(module.id, !checked)}
              onClick={(e) => e.stopPropagation()}
              data-testid={`switch-module-${module.id}`}
            />
          </div>
        </CardHeader>
      </Card>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          data-testid="button-customize-dashboard"
        >
          <Settings2 className="h-4 w-4" />
          Customize
          <Badge variant="secondary" className="ml-1 text-xs">
            {visibleCount}/{totalCount}
          </Badge>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-3 pb-6">
          <SheetTitle className="text-2xl flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Customize Dashboard
          </SheetTitle>
          <SheetDescription>
            Shape your personal cockpit. Add, hide, or reorder modules to match your trading rhythm.
          </SheetDescription>
        </SheetHeader>

        {/* Module Stats */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">{visibleCount} visible</span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{totalCount - visibleCount} hidden</span>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Category Filter */}
        <div className="mb-4">
          <p className="text-sm font-medium mb-3">Filter by category</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              data-testid="filter-category-all"
            >
              All Modules
            </Button>
            {MODULE_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`filter-category-${cat.id}`}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Module Grid */}
        <div className="space-y-3 mb-6">
          {filteredModules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No modules in this category</p>
            </div>
          ) : (
            filteredModules.map(renderModuleCard)
          )}
        </div>

        <Separator className="mb-6" />

        {/* Export/Import Actions */}
        <div className="flex gap-3 mb-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleExport}
            data-testid="button-export-layout"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleImport}
            data-testid="button-import-layout"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-import-file"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setIsOpen(false)}
            data-testid="button-cancel-customize"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onSaveLayout?.();
              setIsOpen(false);
            }}
            data-testid="button-save-layout"
          >
            <Check className="h-4 w-4 mr-2" />
            Save Layout
          </Button>
        </div>

        {/* Helpful Hint */}
        <div className="mt-6 p-4 bg-muted/50 rounded-md flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Hidden modules are removed from your dashboard but can be restored anytime. Your layout is saved automatically.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
