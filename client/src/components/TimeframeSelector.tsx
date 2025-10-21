import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeframeSelectorProps {
  onAnalyze: (dateFrom: Date, dateTo: Date) => void;
  isLoading?: boolean;
}

export function TimeframeSelector({ onAnalyze, isLoading = false }: TimeframeSelectorProps) {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  const handleAnalyze = () => {
    if (dateFrom && dateTo) {
      onAnalyze(dateFrom, dateTo);
    }
  };

  const isValid = dateFrom && dateTo && dateFrom <= dateTo;

  // Quick selection presets
  const selectLast7Days = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    setDateFrom(from);
    setDateTo(to);
  };

  const selectLast30Days = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setDateFrom(from);
    setDateTo(to);
  };

  const selectThisMonth = () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <Card data-testid="card-timeframe-selector">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          AI Performance Analysis
        </CardTitle>
        <CardDescription>
          Analyze your trading performance over a custom timeframe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectLast7Days}
            data-testid="button-preset-7days"
          >
            Last 7 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectLast30Days}
            data-testid="button-preset-30days"
          >
            Last 30 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectThisMonth}
            data-testid="button-preset-month"
          >
            This Month
          </Button>
        </div>

        {/* Date range selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                  data-testid="button-select-from-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  data-testid="calendar-from-date"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                  data-testid="button-select-to-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  data-testid="calendar-to-date"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Analyze button */}
        <Button
          onClick={handleAnalyze}
          disabled={!isValid || isLoading}
          className="w-full"
          data-testid="button-analyze-range"
        >
          {isLoading ? "Analyzing..." : "Analyze Trading Performance"}
        </Button>

        {dateFrom && dateTo && dateFrom > dateTo && (
          <p className="text-sm text-destructive" data-testid="text-error-invalid-range">
            From date must be before To date
          </p>
        )}
      </CardContent>
    </Card>
  );
}
