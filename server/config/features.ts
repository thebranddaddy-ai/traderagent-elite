/**
 * Feature Flags Configuration
 * 
 * North Star Mission: Control rollout and disable risky features
 * Purpose: Toggle AI features based on readiness and user consent requirements
 * 
 * Usage: Import featureFlags and check before enabling features
 */

interface FeatureFlags {
  // Personal Agent - AI that learns trader behavior
  PERSONAL_AGENT: boolean;
  
  // Risk Enforcement - Validate all trades against limits
  RISK_ENFORCEMENT: boolean;
  
  // Global Ensemble - Collective intelligence (requires opt-in)
  GLOBAL_ENSEMBLE: boolean;
  
  // Freedom Engine Features (North Star: Peace, Time, Freedom)
  INSIGHT_LOOP: boolean; // Daily AI insights (morning, midday, evening)
  DNA_STORAGE: boolean; // Encrypted Trading DNA ownership
  
  // AI Features
  AI_SUGGESTIONS: boolean;
  AI_RISK_ADVISOR: boolean;
  AI_PORTFOLIO_OPTIMIZER: boolean;
  AI_COACHING: boolean;
  AI_PREDICTIONS: boolean;
  AI_CORRELATIONS: boolean;
  AI_VOLATILITY: boolean;
  AI_POSITION_SIZING: boolean;
  
  // Live Trading
  LIVE_EXCHANGE_TRADING: boolean;
  
  // Audit & Transparency
  AI_AUDIT_LOGGING: boolean;
}

/**
 * Parse boolean from environment variable
 * Default to true for safety features, false for experimental
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Feature Flags - Loaded from environment variables
 * 
 * Set in Replit Secrets or .env file:
 * FEATURE_PERSONAL_AGENT=true
 * FEATURE_RISK_ENFORCEMENT=true
 * FEATURE_GLOBAL_ENSEMBLE=false (default false - requires opt-in audit)
 */
export const featureFlags: FeatureFlags = {
  // Core Mission Features (default enabled)
  PERSONAL_AGENT: envBool('FEATURE_PERSONAL_AGENT', true),
  RISK_ENFORCEMENT: envBool('FEATURE_RISK_ENFORCEMENT', true),
  
  // Global Ensemble (default DISABLED until opt-in audited)
  GLOBAL_ENSEMBLE: envBool('FEATURE_GLOBAL_ENSEMBLE', false),
  
  // Freedom Engine Features (default enabled - peace, time, freedom mission)
  INSIGHT_LOOP: envBool('FEATURE_INSIGHT_LOOP', true),
  DNA_STORAGE: envBool('FEATURE_DNA_STORAGE', true),
  
  // AI Features (default enabled - already built and tested)
  AI_SUGGESTIONS: envBool('FEATURE_AI_SUGGESTIONS', true),
  AI_RISK_ADVISOR: envBool('FEATURE_AI_RISK_ADVISOR', true),
  AI_PORTFOLIO_OPTIMIZER: envBool('FEATURE_AI_PORTFOLIO_OPTIMIZER', true),
  AI_COACHING: envBool('FEATURE_AI_COACHING', true),
  AI_PREDICTIONS: envBool('FEATURE_AI_PREDICTIONS', true),
  AI_CORRELATIONS: envBool('FEATURE_AI_CORRELATIONS', true),
  AI_VOLATILITY: envBool('FEATURE_AI_VOLATILITY', true),
  AI_POSITION_SIZING: envBool('FEATURE_AI_POSITION_SIZING', true),
  
  // Live Trading (default enabled - has 2-step confirmation)
  LIVE_EXCHANGE_TRADING: envBool('FEATURE_LIVE_EXCHANGE_TRADING', true),
  
  // Audit Logging (default enabled - North Star transparency requirement)
  AI_AUDIT_LOGGING: envBool('FEATURE_AI_AUDIT_LOGGING', true),
};

/**
 * Check if a feature is enabled
 * 
 * Usage:
 * if (isFeatureEnabled('PERSONAL_AGENT')) {
 *   // Execute Personal Agent logic
 * }
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature] === true;
}

/**
 * Require feature to be enabled (throws if disabled)
 * 
 * Usage in routes:
 * requireFeature('GLOBAL_ENSEMBLE');
 */
export function requireFeature(feature: keyof FeatureFlags): void {
  if (!isFeatureEnabled(feature)) {
    throw new Error(`Feature ${feature} is currently disabled`);
  }
}

/**
 * Get all feature flags status (for admin/debug)
 */
export function getAllFeatureFlags(): FeatureFlags {
  return { ...featureFlags };
}

// Log feature flags on startup
console.log('[Feature Flags] Configuration loaded:');
console.log(`  Personal Agent: ${featureFlags.PERSONAL_AGENT ? '✅' : '❌'}`);
console.log(`  Risk Enforcement: ${featureFlags.RISK_ENFORCEMENT ? '✅' : '❌'}`);
console.log(`  Global Ensemble: ${featureFlags.GLOBAL_ENSEMBLE ? '✅' : '❌'} ${!featureFlags.GLOBAL_ENSEMBLE ? '(disabled by default - requires opt-in)' : ''}`);
console.log(`  AI Audit Logging: ${featureFlags.AI_AUDIT_LOGGING ? '✅' : '❌'}`);
console.log(`  Live Exchange Trading: ${featureFlags.LIVE_EXCHANGE_TRADING ? '✅' : '❌'}`);
