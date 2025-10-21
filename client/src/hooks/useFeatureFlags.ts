/**
 * Feature Flags Hook
 * 
 * Provides access to environment-based feature flags for gradual rollout
 * and A/B testing of new features.
 */

export function useFeatureFlags() {
  // TradingView Charting Library feature flag
  // Set VITE_ENABLE_TRADINGVIEW_CHARTS=true in .env to enable
  const isTradingViewChartsEnabled = import.meta.env.VITE_ENABLE_TRADINGVIEW_CHARTS === 'true';

  return {
    isTradingViewChartsEnabled,
  };
}
