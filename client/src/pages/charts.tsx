import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from "recharts";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
import { usePriceSocket } from "@/hooks/usePriceSocket";
import { TradingChart } from "@/components/TradingChart";
import { TradingViewChart } from "@/components/TradingViewChart";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

// Technical Indicators Calculations

// Calculate Simple Moving Average
const calculateSMA = (data: any[], period: number, key: string = 'price') => {
  return data.map((item, index) => {
    if (index < period - 1) return { ...item, [`sma${period}`]: null };
    const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + curr[key], 0);
    return { ...item, [`sma${period}`]: parseFloat((sum / period).toFixed(2)) };
  });
};

// Calculate Exponential Moving Average
const calculateEMA = (data: any[], period: number, key: string = 'price') => {
  const multiplier = 2 / (period + 1);
  let ema = data[0][key];
  
  return data.map((item, index) => {
    if (index === 0) return { ...item, [`ema${period}`]: parseFloat(ema.toFixed(2)) };
    ema = (item[key] - ema) * multiplier + ema;
    return { ...item, [`ema${period}`]: parseFloat(ema.toFixed(2)) };
  });
};

// Calculate RSI (Relative Strength Index)
const calculateRSI = (data: any[], period: number = 14) => {
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i].price - data[i - 1].price;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  return data.map((item, index) => {
    if (index < period) return { ...item, rsi: null };
    
    const avgGain = gains.slice(index - period, index).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(index - period, index).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return { ...item, rsi: 100 };
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return { ...item, rsi: parseFloat(rsi.toFixed(2)) };
  });
};

// Calculate MACD
const calculateMACD = (data: any[]) => {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(ema12, 26);
  
  const macdLine = ema26.map((item, index) => {
    if (!item.ema12 || !item.ema26) return { ...item, macd: null, signal: null, histogram: null };
    const macd = item.ema12 - item.ema26;
    return { ...item, macd: parseFloat(macd.toFixed(2)) };
  });
  
  // Calculate Signal Line (9-day EMA of MACD)
  const validMacd = macdLine.filter(item => item.macd !== null);
  let signalEMA = validMacd[0]?.macd || 0;
  const multiplier = 2 / (9 + 1);
  
  return macdLine.map((item, index) => {
    if (item.macd === null) return { ...item, signal: null, histogram: null };
    
    signalEMA = (item.macd - signalEMA) * multiplier + signalEMA;
    const signal = parseFloat(signalEMA.toFixed(2));
    const histogram = parseFloat((item.macd - signal).toFixed(2));
    
    return { ...item, signal, histogram };
  });
};

// Calculate Bollinger Bands
const calculateBollingerBands = (data: any[], period: number = 20, stdDev: number = 2) => {
  return data.map((item, index) => {
    if (index < period - 1) return { ...item, bb_upper: null, bb_middle: null, bb_lower: null };
    
    const slice = data.slice(index - period + 1, index + 1);
    const sma = slice.reduce((acc, curr) => acc + curr.price, 0) / period;
    
    const squaredDiffs = slice.map(d => Math.pow(d.price - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(variance);
    
    return {
      ...item,
      bb_middle: parseFloat(sma.toFixed(2)),
      bb_upper: parseFloat((sma + stdDev * sd).toFixed(2)),
      bb_lower: parseFloat((sma - stdDev * sd).toFixed(2))
    };
  });
};

// Historical price data generator with volume (uses live price as base)
const generatePriceData = (symbol: string, currentPrice: number) => {
  const data = [];
  let price = currentPrice * 0.90; // Start 10% lower
  
  for (let i = 0; i < 60; i++) {
    const change = (Math.random() - 0.48) * currentPrice * 0.015;
    price = Math.max(price + change, currentPrice * 0.80);
    
    data.push({
      date: new Date(Date.now() - (59 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 5000000) + 1000000,
    });
  }
  
  data[data.length - 1].price = currentPrice;
  
  // Add all technical indicators
  let enriched = calculateSMA(data, 7);
  enriched = calculateSMA(enriched, 20);
  enriched = calculateSMA(enriched, 50);
  enriched = calculateEMA(enriched, 12);
  enriched = calculateEMA(enriched, 26);
  enriched = calculateRSI(enriched);
  enriched = calculateMACD(enriched);
  enriched = calculateBollingerBands(enriched);
  
  return enriched;
};

// Mock portfolio value over time
const generatePortfolioData = () => {
  const data = [];
  let value = 10000;
  
  for (let i = 0; i < 30; i++) {
    const change = (Math.random() - 0.45) * 500;
    value = Math.max(value + change, 8000);
    
    data.push({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(value.toFixed(2)),
      profit: parseFloat((value - 10000).toFixed(2)),
    });
  }
  
  return data;
};

const portfolioData = generatePortfolioData();

export default function Charts() {
  const [selectedSymbol, setSelectedSymbol] = useState<"BTC" | "ETH" | "SOL">("BTC");
  const [indicatorView, setIndicatorView] = useState<"overview" | "rsi" | "macd" | "bollinger">("overview");
  const [chartView, setChartView] = useState<"advanced" | "technical">("advanced");
  const { prices, connected } = usePriceSocket();

  const livePrices = {
    BTC: prices.BTC?.price || 108000,
    ETH: prices.ETH?.price || 3600,
    SOL: prices.SOL?.price || 177
  };

  const getPriceData = () => {
    switch (selectedSymbol) {
      case "BTC":
        return generatePriceData("BTC", livePrices.BTC);
      case "ETH":
        return generatePriceData("ETH", livePrices.ETH);
      case "SOL":
        return generatePriceData("SOL", livePrices.SOL);
      default:
        return generatePriceData("BTC", livePrices.BTC);
    }
  };

  const currentData = getPriceData();
  const currentPrice = currentData[currentData.length - 1].price;
  const priceChange = ((currentPrice - currentData[0].price) / currentData[0].price) * 100;
  const latestRSI = currentData[currentData.length - 1].rsi || 50;
  const latestMACD = currentData[currentData.length - 1].macd || 0;

  const priceMap = {
    BTC: prices.BTC?.price || livePrices.BTC,
    ETH: prices.ETH?.price || livePrices.ETH,
    SOL: prices.SOL?.price || livePrices.SOL,
  };

  // Feature flags - TradingView Charting Library integration
  const { isTradingViewChartsEnabled } = useFeatureFlags();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Charts</h1>
          <p className="text-muted-foreground mt-2">
            Professional trading charts with technical indicators
          </p>
        </div>
        
        {/* Chart View Toggle */}
        <Tabs value={chartView} onValueChange={(v) => setChartView(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="advanced" data-testid="tab-chart-advanced">
              TradingView Chart
            </TabsTrigger>
            <TabsTrigger value="technical" data-testid="tab-chart-technical">
              Technical Analysis
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Advanced Chart - Conditional rendering based on feature flag */}
      {chartView === "advanced" && (
        <>
          {isTradingViewChartsEnabled ? (
            <TradingViewChart
              symbol={selectedSymbol}
              prices={priceMap}
              onSymbolChange={(symbol) => setSelectedSymbol(symbol as any)}
              height={600}
            />
          ) : (
            <TradingChart
              symbol={selectedSymbol}
              prices={priceMap}
              onSymbolChange={(symbol) => setSelectedSymbol(symbol as any)}
              height={600}
            />
          )}
        </>
      )}

      {/* Market Price Charts with Technical Indicators */}
      {chartView === "technical" && (
        <>
          <Card data-testid="card-market-charts">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Price Charts
            </div>
            <div className="flex items-center gap-2 text-sm font-normal">
              <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-muted'}`} />
              <span className="text-muted-foreground">
                {connected ? '🟢 Live' : '⚪ Connecting...'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedSymbol} onValueChange={(v) => setSelectedSymbol(v as any)}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="BTC" data-testid="tab-btc">Bitcoin (BTC)</TabsTrigger>
              <TabsTrigger value="ETH" data-testid="tab-eth">Ethereum (ETH)</TabsTrigger>
              <TabsTrigger value="SOL" data-testid="tab-sol">Solana (SOL)</TabsTrigger>
            </TabsList>

            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="text-2xl font-bold font-mono">${currentPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">60-Day Change</p>
                <p className={`text-2xl font-bold ${priceChange >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RSI (14)</p>
                <p className={`text-2xl font-bold ${latestRSI > 70 ? 'text-chart-3' : latestRSI < 30 ? 'text-chart-2' : 'text-foreground'}`}>
                  {latestRSI.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MACD</p>
                <p className={`text-2xl font-bold ${latestMACD >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                  {latestMACD >= 0 ? '+' : ''}{latestMACD.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Indicator Selector */}
            <Tabs value={indicatorView} onValueChange={(v) => setIndicatorView(v as any)} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" data-testid="indicator-overview">Overview</TabsTrigger>
                <TabsTrigger value="rsi" data-testid="indicator-rsi">RSI</TabsTrigger>
                <TabsTrigger value="macd" data-testid="indicator-macd">MACD</TabsTrigger>
                <TabsTrigger value="bollinger" data-testid="indicator-bollinger">Bollinger Bands</TabsTrigger>
              </TabsList>
            </Tabs>

            {["BTC", "ETH", "SOL"].map((symbol) => (
              <TabsContent key={symbol} value={symbol}>
                {/* Overview: Price + Volume + MAs */}
                {indicatorView === "overview" && (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={currentData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          yAxisId="price"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Area 
                          yAxisId="price"
                          type="monotone" 
                          dataKey="price" 
                          stroke="hsl(var(--chart-1))" 
                          strokeWidth={2}
                          fill="url(#colorPrice)"
                          name="Price"
                        />
                        <Line 
                          yAxisId="price"
                          type="monotone" 
                          dataKey="sma7" 
                          stroke="hsl(var(--chart-4))" 
                          strokeWidth={1.5}
                          dot={false}
                          name="SMA 7"
                        />
                        <Line 
                          yAxisId="price"
                          type="monotone" 
                          dataKey="sma20" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={1.5}
                          dot={false}
                          name="SMA 20"
                        />
                        <Line 
                          yAxisId="price"
                          type="monotone" 
                          dataKey="sma50" 
                          stroke="hsl(var(--chart-3))" 
                          strokeWidth={1.5}
                          dot={false}
                          name="SMA 50"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>

                    {/* Volume Chart */}
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={currentData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${(value / 1000000).toFixed(2)}M`, 'Volume']}
                        />
                        <Bar dataKey="volume" fill="hsl(var(--chart-1))" opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* RSI Indicator */}
                {indicatorView === "rsi" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={currentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <ReferenceLine y={70} stroke="hsl(var(--chart-3))" strokeDasharray="3 3" label="Overbought" />
                      <ReferenceLine y={30} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" label="Oversold" />
                      <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Line 
                        type="monotone" 
                        dataKey="rsi" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={false}
                        name="RSI (14)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {/* MACD Indicator */}
                {indicatorView === "macd" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={currentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                      <Bar 
                        dataKey="histogram" 
                        fill="hsl(var(--chart-4))" 
                        opacity={0.6}
                        name="MACD Histogram"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="macd" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={false}
                        name="MACD Line"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="signal" 
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        dot={false}
                        name="Signal Line"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* Bollinger Bands */}
                {indicatorView === "bollinger" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={currentData}>
                      <defs>
                        <linearGradient id="colorBB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="bb_upper" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={1}
                        fill="url(#colorBB)"
                        name="Upper Band"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="bb_middle" 
                        stroke="hsl(var(--chart-4))" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Middle Band (SMA 20)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="bb_lower" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={1}
                        dot={false}
                        name="Lower Band"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={false}
                        name="Price"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
          </Card>

          {/* Portfolio Performance */}
          <Card data-testid="card-portfolio-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Portfolio Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl font-bold font-mono">
                ${portfolioData[portfolioData.length - 1].value.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p className={`text-2xl font-bold ${portfolioData[portfolioData.length - 1].profit >= 0 ? 'text-chart-2' : 'text-chart-3'}`}>
                {portfolioData[portfolioData.length - 1].profit >= 0 ? '+' : ''}
                ${portfolioData[portfolioData.length - 1].profit.toLocaleString()}
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={portfolioData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [
                  name === 'value' ? `$${value.toLocaleString()}` : `${value >= 0 ? '+' : ''}$${value.toLocaleString()}`,
                  name === 'value' ? 'Portfolio Value' : 'Profit/Loss'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={false}
                name="Portfolio Value"
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={false}
                name="P&L"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
          </Card>

          {/* Technical Indicators Legend */}
          <Card data-testid="card-indicators-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Technical Indicators Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">RSI (Relative Strength Index)</h3>
            <p className="text-sm text-muted-foreground">
              Measures momentum. Above 70 = overbought (potential sell), below 30 = oversold (potential buy)
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">MACD</h3>
            <p className="text-sm text-muted-foreground">
              Trend-following indicator. MACD crossing above signal = bullish, below = bearish
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Bollinger Bands</h3>
            <p className="text-sm text-muted-foreground">
              Volatility indicator. Price touching upper band = overbought, lower band = oversold
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Moving Averages (SMA)</h3>
            <p className="text-sm text-muted-foreground">
              Trend indicators. Price above MA = uptrend, below = downtrend. SMA7/20/50 for different timeframes
            </p>
          </div>
        </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
