import { storage } from "../storage";
import { encrypt, decrypt } from "../utils/encryption";
import { createBinanceService } from "./binanceService";
import { randomUUID } from "crypto";
import { riskGuardService } from "../riskGuardService";

export interface OrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price?: string;
}

export interface PreCheckResult {
  allowed: boolean;
  reason: string;
  estimatedCost?: number;
  estimatedFees?: number;
  riskWarnings?: string[];
  orderPayload: OrderPayload;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  executedPrice?: string;
  executedQuantity?: string;
  fees?: string;
  error?: string;
}

/**
 * Validates and stores encrypted exchange API credentials
 */
export async function connectExchange(
  userId: string,
  exchange: string,
  apiKey: string,
  apiSecret: string,
  permissions: string,
  testnet: boolean = false
): Promise<{ success: boolean; error?: string; connectionId?: string }> {
  try {
    console.log(`[Exchange] Connecting ${exchange} for user ${userId}...`);

    // Validate credentials with exchange
    const binanceService = createBinanceService(apiKey, apiSecret, testnet);
    const validation = await binanceService.validateCredentials();

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid API credentials',
      };
    }

    console.log(`[Exchange] Credentials validated. Permissions:`, validation.permissions);

    // Encrypt API credentials
    const encryptedApiKey = encrypt(apiKey);
    const encryptedApiSecret = encrypt(apiSecret);

    // Deactivate any existing connections for this exchange
    const existing = await storage.getActiveExchangeConnection(userId, exchange);
    if (existing) {
      await storage.updateExchangeConnection(existing.id, { isActive: false });
    }

    // Store encrypted credentials
    const connection = await storage.createExchangeConnection({
      userId,
      exchange,
      encryptedApiKey,
      encryptedApiSecret,
      permissions,
      isActive: true,
    });

    await storage.updateExchangeConnection(connection.id, {
      lastValidated: new Date(),
    });

    console.log(`[Exchange] Connection saved with ID: ${connection.id}`);

    return {
      success: true,
      connectionId: connection.id,
    };
  } catch (error: any) {
    console.error('[Exchange] Connection error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect exchange',
    };
  }
}

/**
 * Gets exchange connection status for a user
 */
export async function getExchangeStatus(userId: string): Promise<Array<{
  exchange: string;
  connected: boolean;
  permissions: string;
  lastValidated?: Date | null;
}>> {
  const connections = await storage.getExchangeConnectionsByUserId(userId);
  
  return connections
    .filter(c => c.isActive)
    .map(c => ({
      exchange: c.exchange,
      connected: c.isActive,
      permissions: c.permissions,
      lastValidated: c.lastValidated,
    }));
}

/**
 * Pre-check an order against risk limits and generate execution token
 */
export async function preCheckOrder(
  userId: string,
  exchange: string,
  orderPayload: OrderPayload
): Promise<{ token?: string; preCheck: PreCheckResult }> {
  try {
    console.log(`[Exchange] Pre-checking order for user ${userId}:`, orderPayload);

    // Get exchange connection
    const connection = await storage.getActiveExchangeConnection(userId, exchange);
    if (!connection) {
      return {
        preCheck: {
          allowed: false,
          reason: `No active ${exchange} connection found. Please connect your exchange account first.`,
          orderPayload,
        },
      };
    }

    // Check if user is paused
    const user = await storage.getUser(userId);
    if (user?.tradingPaused) {
      return {
        preCheck: {
          allowed: false,
          reason: 'Trading is currently paused due to risk limits. Please review your settings.',
          orderPayload,
        },
      };
    }

    // Get current price
    const apiKey = decrypt(connection.encryptedApiKey);
    const apiSecret = decrypt(connection.encryptedApiSecret);
    const binanceService = createBinanceService(apiKey, apiSecret);
    
    let currentPrice: number;
    try {
      const ticker = await binanceService.getTickerPrice(orderPayload.symbol);
      currentPrice = parseFloat(ticker.price);
    } catch (error) {
      return {
        preCheck: {
          allowed: false,
          reason: `Failed to get current price for ${orderPayload.symbol}`,
          orderPayload,
        },
      };
    }

    const quantity = parseFloat(orderPayload.quantity);
    const price = orderPayload.price ? parseFloat(orderPayload.price) : currentPrice;
    const estimatedCost = quantity * price;
    const estimatedFees = estimatedCost * 0.001; // Binance fee ~0.1%

    // Check risk limits
    const riskSettings = await storage.getRiskGuardSettings(userId);
    if (riskSettings) {
      const wallet = await storage.getPaperWalletByUserId(userId);
      if (wallet) {
        const positionSizePercent = (estimatedCost / parseFloat(wallet.balance)) * 100;
        
        if (positionSizePercent > parseFloat(riskSettings.maxPositionSizePercent || '25')) {
          return {
            preCheck: {
              allowed: false,
              reason: `Order exceeds maximum position size of ${riskSettings.maxPositionSizePercent}% of portfolio`,
              estimatedCost,
              estimatedFees,
              orderPayload,
            },
          };
        }
      }
    }

    // Generate execution token (valid for 5 minutes)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const preCheckResult: PreCheckResult = {
      allowed: true,
      reason: 'Order passed all risk checks. Ready for execution.',
      estimatedCost,
      estimatedFees,
      riskWarnings: [],
      orderPayload,
    };

    // Store execution token
    await storage.createExecutionToken({
      userId,
      token,
      orderPayload: JSON.stringify(orderPayload),
      preCheckResult: JSON.stringify(preCheckResult),
      status: 'pending',
      expiresAt,
    });

    console.log(`[Exchange] Pre-check passed. Token: ${token}`);

    return {
      token,
      preCheck: preCheckResult,
    };
  } catch (error: any) {
    console.error('[Exchange] Pre-check error:', error);
    return {
      preCheck: {
        allowed: false,
        reason: error.message || 'Pre-check failed',
        orderPayload,
      },
    };
  }
}

/**
 * Confirm and execute an order using execution token
 */
export async function confirmAndExecute(
  userId: string,
  exchange: string,
  token: string,
  twoFactorCode?: string
): Promise<ExecutionResult> {
  try {
    console.log(`[Exchange] Confirming execution with token: ${token}`);

    // Get and validate token
    const executionToken = await storage.getExecutionToken(token);
    
    if (!executionToken) {
      return {
        success: false,
        error: 'Invalid or expired execution token',
      };
    }

    if (executionToken.userId !== userId) {
      return {
        success: false,
        error: 'Token does not belong to this user',
      };
    }

    if (executionToken.status !== 'pending') {
      return {
        success: false,
        error: `Token already ${executionToken.status}`,
      };
    }

    if (new Date() > new Date(executionToken.expiresAt)) {
      await storage.updateExecutionTokenStatus(token, 'expired');
      return {
        success: false,
        error: 'Execution token has expired',
      };
    }

    // Parse order payload
    const orderPayload: OrderPayload = JSON.parse(executionToken.orderPayload);

    // Get exchange connection
    const connection = await storage.getActiveExchangeConnection(userId, exchange);
    if (!connection) {
      await storage.updateExecutionTokenStatus(token, 'rejected');
      return {
        success: false,
        error: 'Exchange connection not found',
      };
    }

    // Decrypt credentials and execute order
    const apiKey = decrypt(connection.encryptedApiKey);
    const apiSecret = decrypt(connection.encryptedApiSecret);
    const binanceService = createBinanceService(apiKey, apiSecret);

    try {
      const result = await binanceService.placeOrder({
        symbol: orderPayload.symbol,
        side: orderPayload.side,
        type: orderPayload.type,
        quantity: orderPayload.quantity,
        price: orderPayload.price,
      });

      // Mark token as confirmed
      await storage.updateExecutionTokenStatus(token, 'confirmed');

      console.log(`[Exchange] Order executed successfully:`, result);

      // Log execution for audit
      console.log(`[AUDIT] Live order executed - User: ${userId}, Order: ${JSON.stringify(orderPayload)}, Result: ${JSON.stringify(result)}`);

      return {
        success: true,
        orderId: result.orderId || result.clientOrderId,
        executedPrice: result.fills?.[0]?.price || orderPayload.price,
        executedQuantity: result.executedQty || orderPayload.quantity,
        fees: result.fills?.[0]?.commission || '0',
      };
    } catch (error: any) {
      await storage.updateExecutionTokenStatus(token, 'rejected');
      console.error('[Exchange] Order execution failed:', error.message);
      
      return {
        success: false,
        error: error.message || 'Order execution failed',
      };
    }
  } catch (error: any) {
    console.error('[Exchange] Confirmation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to confirm execution',
    };
  }
}
