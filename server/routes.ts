import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { storage } from "./storage";
import { insertTradeSchema, insertWatchlistSchema, insertPriceAlertSchema, whatIfSimulations, aiAuditLogs, RiskGuardSettings } from "@shared/schema";
import { db } from "./db";
import OpenAI from "openai";
import { 
  getPaperWalletWithPositions, 
  executeMarketOrder, 
  executeLimitOrder,
  getMarketPrice,
  setMarketPrice,
  getAllMarketPrices
} from "./services/paperTrading";
import { generateDailyBriefing } from "./services/aiBriefing";
import { calculateTradingDNA } from "./services/tradingDNA";
import { initializePriceService, getAllMarketPrices as getCryptoPrices } from "./services/cryptoPrices";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import { riskGuardService } from "./riskGuardService";
import { aiSentimentService } from "./services/aiSentiment";
import { patternRecognitionService } from "./services/aiPatternRecognition";
import { aiTradeSuggestionsService } from "./services/aiTradeSuggestions";
import { generateDailyInsight, getTodayInsights } from "./services/insightLoop";
import { 
  generateOTP, 
  sendEmailOTP, 
  sendPhoneOTP, 
  storeOTP, 
  verifyOTP,
  generateTOTPSecret,
  verifyTOTP,
  enableTOTP,
  disableTOTP
} from "./authService";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { peaceIndexService } from "./services/peaceIndex";
import { registerOHLCVRoutes } from "./routes/ohlcv";
import { registerUDFRoutes } from "./routes/udf";
import { subscribe as udfSubscribe, unsubscribe as udfUnsubscribe, processPriceTick, cleanupDisconnectedClients } from "./services/udfStreaming";
import { shadowLearningLogger } from "./services/shadowLearningLogger";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints for Docker and AWS ECS
  app.get('/ping', (req, res) => {
    res.json({ status: "ok" });
  });

  app.get('/status', (req, res) => {
    res.json({ 
      status: "healthy",
      version: "1.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Check outgoing IP address (for Binance API whitelisting)
  app.get('/api/check-ip', async (req, res) => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      console.log(`[IP CHECK] Server's outgoing IP address: ${data.ip}`);
      res.json({ 
        ip: data.ip,
        message: `Add this IP to your Binance API whitelist: ${data.ip}`
      });
    } catch (error: any) {
      console.error('[IP CHECK] Failed to get IP:', error);
      res.status(500).json({ error: 'Failed to check IP address' });
    }
  });

  // Public download link for AWS deployment package
  app.get('/download/traderagent-elite-aws.tar.gz', (req, res) => {
    const filePath = path.join(process.cwd(), 'traderagent-elite-aws.tar.gz');
    console.log('[DOWNLOAD] AWS Package requested from:', req.ip);
    console.log('[DOWNLOAD] Sending file:', filePath);
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename=traderagent-elite-aws.tar.gz');
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('[DOWNLOAD] Error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Deployment package not found' });
        }
      } else {
        console.log('[DOWNLOAD] AWS Package sent successfully! (397KB)');
      }
    });
  });

  // Public download link for deployment package (legacy)
  app.get('/download/traderagent-deploy.tar.gz', (req, res) => {
    const filePath = path.join(process.cwd(), 'traderagent-deploy.tar.gz');
    console.log('[DOWNLOAD] Sending file:', filePath);
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename=traderagent-deploy.tar.gz');
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('[DOWNLOAD] Error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Deployment package not found' });
        }
      } else {
        console.log('[DOWNLOAD] File sent successfully!');
      }
    });
  });

  // Public download link for release package (COMPLETE with deployment scripts)
  app.get('/download/release', (req, res) => {
    const filePath = './releases/freedom_loop_v1.1_COMPLETE.tar.gz';
    res.download(filePath, 'freedom_loop_v1.1_COMPLETE.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'Release package not found' });
      }
    });
  });

  // Fixed Dockerfile for AWS deployment
  app.get('/download/dockerfile', (req, res) => {
    const filePath = './Dockerfile';
    res.download(filePath, 'Dockerfile', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'Dockerfile not found' });
      }
    });
  });

  // Rebuild and deploy script
  app.get('/download/rebuild-script', (req, res) => {
    const filePath = './REBUILD_AND_DEPLOY.sh';
    res.download(filePath, 'REBUILD_AND_DEPLOY.sh', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'Script not found' });
      }
    });
  });

  // Updated replitAuth.ts for v1.1.1 (auth optional)
  app.get('/download/replitauth', (req, res) => {
    const filePath = './replitAuth_v1.1.1.ts';
    res.download(filePath, 'replitAuth.ts', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'Updated replitAuth.ts not found' });
      }
    });
  });

  // Direct download endpoint for release package (from root)
  app.get('/download/traderelite', (req, res) => {
    const filePath = './traderelite-v1.2.1.tar.gz';
    res.download(filePath, 'traderelite-v1.2.1.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'Release package not found' });
      }
    });
  });

  // Serve deployment package as static file (bypasses Vite middleware)
  app.use('/deploy', express.static('.', {
    index: false,
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.tar.gz')) {
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename=${path.basename(filepath)}`);
      }
    }
  }));
  
  // Serve public folder for downloads (release packages, etc.)
  app.use('/public', express.static('public'));

  // Setup Replit Auth
  await setupAuth(app);

  // Register OHLCV routes for chart data
  registerOHLCVRoutes(app);

  // Register UDF (Universal Data Feed) routes for TradingView integration
  registerUDFRoutes(app);

  // Email/Password Authentication Routes
  
  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Normalize email (consistent with demo-signup)
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email: normalizedEmail,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
      });

      // Initialize paper wallet for new user
      const { initializePaperWallet } = await import('./services/paperTrading');
      await initializePaperWallet(user.id);

      // Create session
      (req as any).login({ claims: { sub: user.id } }, (err: any) => {
        if (err) {
          return res.status(500).json({ error: "Failed to create session" });
        }
        res.json({ message: "Registration successful", user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error: any) {
      console.error("Error registering user:", error);
      // Don't expose internal database errors to users
      res.status(500).json({ error: "Failed to register user. Please try again later." });
    }
  });

  // Login with email/password
  app.post('/api/auth/login/email', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Normalize email (consistent with demo-signup)
      const normalizedEmail = email.trim().toLowerCase();

      // Get user
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user || !user.password) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Create session
      (req as any).login({ claims: { sub: user.id } }, (err: any) => {
        if (err) {
          return res.status(500).json({ error: "Failed to create session" });
        }
        res.json({ message: "Login successful", user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error: any) {
      console.error("Error logging in:", error);
      // Don't expose internal errors to users
      res.status(500).json({ error: "Login failed. Please try again later." });
    }
  });

  // Demo/Signup - Single endpoint for both login and registration
  // If user exists: login, if not: create account
  app.post('/api/auth/demo-signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      
      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Normalize email
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);

      if (existingUser) {
        // User exists - attempt login
        if (!existingUser.password) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, existingUser.password);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        // Login successful - create session
        (req as any).login({ claims: { sub: existingUser.id } }, (err: any) => {
          if (err) {
            return res.status(500).json({ error: "Failed to create session" });
          }
          res.json({ 
            message: "Login successful", 
            user: { 
              id: existingUser.id, 
              email: existingUser.email, 
              firstName: existingUser.firstName, 
              lastName: existingUser.lastName 
            } 
          });
        });
      } else {
        // User doesn't exist - create new account
        const hashedPassword = await bcrypt.hash(password, 10);

        // Split name into firstName and lastName if provided
        let firstName = null;
        let lastName = null;
        if (name) {
          const nameParts = name.trim().split(' ');
          firstName = nameParts[0];
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
        }

        // Create user
        const newUser = await storage.createUser({
          email: normalizedEmail,
          password: hashedPassword,
          firstName,
          lastName,
        });

        // Initialize paper wallet for new user
        const { initializePaperWallet } = await import('./services/paperTrading');
        await initializePaperWallet(newUser.id);

        // Create session
        (req as any).login({ claims: { sub: newUser.id } }, (err: any) => {
          if (err) {
            return res.status(500).json({ error: "Failed to create session" });
          }
          res.json({ 
            message: "Account created successfully", 
            user: { 
              id: newUser.id, 
              email: newUser.email, 
              firstName: newUser.firstName, 
              lastName: newUser.lastName 
            } 
          });
        });
      }
    } catch (error: any) {
      console.error("Error in demo-signup:", error);
      res.status(500).json({ error: "Failed to process request. Please try again later." });
    }
  });

  // Auth routes - Get current authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // OTP Authentication Routes
  
  // Send Email OTP
  app.post('/api/auth/otp/email/send', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const code = generateOTP();
      await storeOTP(email, code, "email");
      await sendEmailOTP(email, code);

      res.json({ message: "OTP sent to email" });
    } catch (error: any) {
      console.error("Error sending email OTP:", error);
      res.status(500).json({ error: error.message || "Failed to send OTP" });
    }
  });

  // Send Phone OTP
  app.post('/api/auth/otp/phone/send', async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const code = generateOTP();
      await storeOTP(phone, code, "phone");
      await sendPhoneOTP(phone, code);

      res.json({ message: "OTP sent to phone" });
    } catch (error: any) {
      console.error("Error sending phone OTP:", error);
      res.status(500).json({ error: error.message || "Failed to send SMS" });
    }
  });

  // Verify Email OTP
  app.post('/api/auth/otp/email/verify', async (req, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const isValid = await verifyOTP(email, code, "email");
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      // Find or create user by email
      let user = await storage.getUserByEmail(email);
      if (!user) {
        user = await storage.createUser({
          email,
          firstName: null,
          lastName: null,
        });
      }

      // Create session (simplified - in production use proper session management)
      res.json({ 
        message: "Verified successfully",
        userId: user.id,
        email: user.email
      });
    } catch (error: any) {
      console.error("Error verifying email OTP:", error);
      res.status(500).json({ error: error.message || "Failed to verify OTP" });
    }
  });

  // Verify Phone OTP
  app.post('/api/auth/otp/phone/verify', async (req, res) => {
    try {
      const { phone, code } = req.body;
      
      if (!phone || !code) {
        return res.status(400).json({ error: "Phone and code are required" });
      }

      const isValid = await verifyOTP(phone, code, "phone");
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      // Find or create user by phone
      let user = await storage.getUserByPhone(phone);
      if (!user) {
        user = await storage.createUser({
          phone,
          email: null,
        });
      }

      res.json({ 
        message: "Verified successfully",
        userId: user.id,
        phone: user.phone
      });
    } catch (error: any) {
      console.error("Error verifying phone OTP:", error);
      res.status(500).json({ error: error.message || "Failed to verify OTP" });
    }
  });

  // TOTP (Google Authenticator) Routes
  
  // Setup TOTP - Generate QR code
  app.post('/api/auth/totp/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.email) {
        return res.status(400).json({ error: "User email required" });
      }

      const { secret, qrCode } = await generateTOTPSecret(userId, user.email);

      res.json({ 
        secret,
        qrCode,
        message: "Scan QR code with Google Authenticator"
      });
    } catch (error: any) {
      console.error("Error setting up TOTP:", error);
      res.status(500).json({ error: error.message || "Failed to setup TOTP" });
    }
  });

  // Verify and Enable TOTP
  app.post('/api/auth/totp/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const isValid = await verifyTOTP(userId, token);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid TOTP token" });
      }

      await enableTOTP(userId);

      res.json({ message: "TOTP enabled successfully" });
    } catch (error: any) {
      console.error("Error verifying TOTP:", error);
      res.status(500).json({ error: error.message || "Failed to verify TOTP" });
    }
  });

  // Disable TOTP
  app.post('/api/auth/totp/disable', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await disableTOTP(userId);
      res.json({ message: "TOTP disabled successfully" });
    } catch (error: any) {
      console.error("Error disabling TOTP:", error);
      res.status(500).json({ error: error.message || "Failed to disable TOTP" });
    }
  });

  // Chart telemetry endpoint for Trading DNA learning
  app.post("/api/telemetry/chart-events", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;

      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).send("Invalid events format");
      }

      // Store chart interaction telemetry for AI learning
      const { layoutTelemetry } = await import("@shared/schema");
      console.log('[Chart Telemetry] Received events:', JSON.stringify(events, null, 2));
      
      for (const event of events) {
        const { eventType, eventData } = event;
        console.log('[Chart Telemetry] Processing event:', { eventType, eventData });
        
        await db.insert(layoutTelemetry).values({
          userId,
          eventType,
          moduleId: 'chart',
          metadata: eventData,
        });
      }

      res.json({ success: true, count: events.length });
    } catch (error: any) {
      console.error('[Chart Telemetry] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // POST /api/trades - Create a new trade
  app.post("/api/trades", isAuthenticated, async (req: any, res) => {
    try {
      const validationResult = insertTradeSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid trade data", 
          details: validationResult.error.errors 
        });
      }

      const trade = await storage.createTrade(validationResult.data);
      res.status(201).json(trade);
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/paper/wallet/:userId - Get or create wallet with positions
  app.get("/api/paper/wallet/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own wallet
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own wallet" });
      }
      
      const walletData = await getPaperWalletWithPositions(authenticatedUserId);
      res.json(walletData);
    } catch (error) {
      console.error("Error fetching paper wallet:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/paper/order - Execute a paper trade order
  const paperOrderSchema = z.object({
    symbol: z.string(),
    side: z.enum(["buy", "sell"]),
    orderType: z.enum(["market", "limit"]),
    quantity: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? String(val) : val),
    price: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? String(val) : val).optional(),
    stopLoss: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? String(val) : val).optional(),
    takeProfit: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? String(val) : val).optional(),
  });

  app.post("/api/paper/order", isAuthenticated, async (req: any, res) => {
    try {
      // Extract userId from authenticated session
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      console.log("Received order request:", JSON.stringify(req.body));
      
      const validationResult = paperOrderSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error("Validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          error: "Invalid order data", 
          details: validationResult.error.errors 
        });
      }

      const { symbol, side, orderType, quantity, price, stopLoss, takeProfit } = validationResult.data;

      // Additional validation
      const quantityNum = parseFloat(quantity);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
      }

      if (!symbol || symbol.trim() === "") {
        return res.status(400).json({ error: "Please select a symbol" });
      }

      // Get the actual price for risk checking (market price for market orders, limit price for limit orders)
      let orderPriceForRiskCheck = price;
      if (orderType === "market") {
        const marketPrice = getMarketPrice(symbol);
        orderPriceForRiskCheck = marketPrice.toString();
      }

      // Check risk guard limits with actual price
      const riskCheck = await riskGuardService.checkOrderAllowed(userId, symbol, side, quantity, orderPriceForRiskCheck || "0");
      
      // If violations exist (enforcement enabled and limits exceeded), block the trade
      if (!riskCheck.allowed) {
        console.log("[RISK GUARD] Order blocked:", riskCheck.violations);
        return res.status(403).json({ 
          error: "Risk Guard: Order not allowed", 
          violations: riskCheck.violations,
          message: riskCheck.reason 
        });
      }

      // Log warnings if present (informational only, doesn't block)
      if (riskCheck.warnings.length > 0) {
        console.log("[RISK GUARD] Warnings for order:", riskCheck.warnings);
      }

      let result;
      if (orderType === "market") {
        result = await executeMarketOrder(userId, symbol, side, quantity, stopLoss, takeProfit);
      } else {
        if (!price) {
          return res.status(400).json({ error: "Price is required for limit orders" });
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
          return res.status(400).json({ error: "Price must be greater than 0" });
        }
        result = await executeLimitOrder(userId, symbol, side, quantity, price, stopLoss, takeProfit);
      }

      if (!result.success) {
        console.error("Order execution failed:", result.error);
        return res.status(400).json({ error: result.error });
      }

      const walletData = await getPaperWalletWithPositions(userId);
      
      // Include warnings in response if present
      if (riskCheck.warnings.length > 0) {
        res.json({ ...walletData, warnings: riskCheck.warnings });
      } else {
        res.json(walletData);
      }
    } catch (error: any) {
      console.error("Error executing paper order:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({ 
        error: "Internal server error",
        message: error.message 
      });
    }
  });

  // GET /api/paper/orders/:userId - Get order history for user
  app.get("/api/paper/orders/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own orders
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own orders" });
      }
      
      const orders = await storage.getPaperOrdersByUserId(authenticatedUserId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching paper orders:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/paper/order/:orderId/cancel - Cancel a pending order
  app.patch("/api/paper/order/:orderId/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const order = await storage.getPaperOrderById(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status !== "pending") {
        return res.status(400).json({ error: "Only pending orders can be cancelled" });
      }

      await storage.cancelPaperOrder(orderId);
      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/paper/order/:orderId - Update a pending order
  const updateOrderSchema = z.object({
    quantity: z.string(),
    price: z.string(),
  });

  app.patch("/api/paper/order/:orderId", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const validationResult = updateOrderSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.errors 
        });
      }

      const { quantity, price } = validationResult.data;
      const order = await storage.getPaperOrderById(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status !== "pending") {
        return res.status(400).json({ error: "Only pending orders can be modified" });
      }

      const quantityNum = parseFloat(quantity);
      const priceNum = parseFloat(price);

      if (isNaN(quantityNum) || quantityNum <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
      }

      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: "Price must be greater than 0" });
      }

      await storage.updatePaperOrder(orderId, quantity, price);
      res.json({ success: true, message: "Order updated successfully" });
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/ai/briefing - Generate new AI briefing for user
  const aiBriefingSchema = z.object({
    userId: z.string(),
  });

  app.post("/api/ai/briefing", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const briefing = await generateDailyBriefing(userId);
      
      res.json(briefing);
    } catch (error: any) {
      console.error("Error generating AI briefing:", error);
      
      // Check if it's an OpenAI rate limit error
      if (error.status === 429 || error.code === 'insufficient_quota') {
        return res.status(429).json({ 
          error: "OpenAI API quota exceeded. Please add credits to your OpenAI account or try again later.",
          details: "Visit platform.openai.com/billing to manage your credits"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to generate AI briefing",
        message: error.message || "Internal server error"
      });
    }
  });

  // GET /api/ai/briefing/:userId - Get latest briefing for user
  app.get("/api/ai/briefing/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own briefing
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own briefings" });
      }
      
      const briefing = await storage.getLatestBriefingByUserId(authenticatedUserId);
      
      if (!briefing) {
        return res.status(404).json({ error: "No briefing found for this user" });
      }

      res.json(briefing);
    } catch (error) {
      console.error("Error fetching AI briefing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // AI Daily Insights (Freedom Engine Phase A)
  
  // GET /api/ai/insights/today/:userId - Get today's insights with peace index
  app.get("/api/ai/insights/today/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own insights
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own insights" });
      }
      
      const insights = await getTodayInsights(authenticatedUserId, storage);
      res.json(insights);
    } catch (error: any) {
      console.error("Error fetching today's insights:", error);
      res.status(500).json({ 
        error: "Failed to fetch insights",
        message: error.message || "Internal server error"
      });
    }
  });

  // POST /api/ai/insights/generate - Generate new insight based on time of day
  app.post("/api/ai/insights/generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const insight = await generateDailyInsight(userId, storage);
      res.json(insight);
    } catch (error: any) {
      console.error("Error generating insight:", error);
      
      // Check if it's an OpenAI rate limit error
      if (error.status === 429 || error.code === 'insufficient_quota') {
        return res.status(429).json({ 
          error: "OpenAI API quota exceeded. Please add credits to your OpenAI account or try again later.",
          details: "Visit platform.openai.com/billing to manage your credits"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to generate insight",
        message: error.message || "Internal server error"
      });
    }
  });

  // Chart Layout Persistence Routes (Phase 1)
  
  // POST /api/chart/layout - Save chart layout
  app.post("/api/chart/layout", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const layout = await chartLayoutService.saveLayout(userId, req.body);

      res.json(layout);
    } catch (error: any) {
      console.error("[Chart Layout] Save error:", error);
      res.status(500).json({ error: error.message || "Failed to save layout" });
    }
  });

  // GET /api/chart/layout - Get default layout
  app.get("/api/chart/layout", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const layout = await chartLayoutService.getDefaultLayout(userId);

      res.json(layout);
    } catch (error: any) {
      console.error("[Chart Layout] Get error:", error);
      res.status(500).json({ error: error.message || "Failed to get layout" });
    }
  });

  // GET /api/chart/layouts - Get all layouts
  app.get("/api/chart/layouts", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const layouts = await chartLayoutService.getAllLayouts(userId);

      res.json(layouts);
    } catch (error: any) {
      console.error("[Chart Layouts] Get error:", error);
      res.status(500).json({ error: error.message || "Failed to get layouts" });
    }
  });

  // DELETE /api/chart/layout/:id - Delete layout
  app.delete("/api/chart/layout/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const deleted = await chartLayoutService.deleteLayout(userId, req.params.id);

      res.json(deleted);
    } catch (error: any) {
      console.error("[Chart Layout] Delete error:", error);
      res.status(500).json({ error: error.message || "Failed to delete layout" });
    }
  });

  // POST /api/chart/metrics - Log performance metrics
  app.post("/api/chart/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const metrics = await chartLayoutService.logPerformanceMetrics(userId, req.body);

      res.json(metrics);
    } catch (error: any) {
      console.error("[Chart Metrics] Log error:", error);
      res.status(500).json({ error: error.message || "Failed to log metrics" });
    }
  });

  // GET /api/chart/metrics - Get performance metrics
  app.get("/api/chart/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { chartLayoutService } = await import("./services/chartLayout");
      const metrics = await chartLayoutService.getPerformanceMetrics(userId);

      res.json(metrics);
    } catch (error: any) {
      console.error("[Chart Metrics] Get error:", error);
      res.status(500).json({ error: error.message || "Failed to get metrics" });
    }
  });

  // Peace Index & Focus Mode Routes
  
  // GET /api/peace/index/:userId - Get current peace index score
  app.get("/api/peace/index/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const peaceData = await peaceIndexService.calculatePeaceScore(authenticatedUserId);
      res.json(peaceData);
    } catch (error: any) {
      console.error("Error fetching peace index:", error);
      res.status(500).json({ error: "Failed to fetch peace index" });
    }
  });

  // POST /api/focus/session - Log focus session
  app.post("/api/focus/session", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { duration, completed, tradesExecuted } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      await peaceIndexService.logFocusSession(userId, duration, completed, tradesExecuted || 0);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error logging focus session:", error);
      res.status(500).json({ error: "Failed to log focus session" });
    }
  });

  // GET /api/users/:id/dna - Get Trading DNA analytics for user
  app.get("/api/users/:id/dna", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.id;
      
      // Security: Validate user can only access their own trading DNA
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own trading DNA analytics" });
      }
      
      const dna = await calculateTradingDNA(authenticatedUserId);
      res.json(dna);
    } catch (error: any) {
      console.error("Error calculating Trading DNA:", error);
      res.status(500).json({ 
        error: "Failed to calculate Trading DNA",
        message: error.message || "Internal server error"
      });
    }
  });

  // AI Features Routes
  
  // GET /api/ai/sentiment/:symbol - Get market sentiment for a symbol
  app.get("/api/ai/sentiment/:symbol", isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      const price = getMarketPrice(symbol);
      const sentiment = await aiSentimentService.getSentimentForSymbol(symbol, price);
      res.json(sentiment);
    } catch (error: any) {
      console.error("Error getting sentiment:", error);
      res.status(500).json({ error: "Failed to fetch sentiment", message: error.message });
    }
  });

  // GET /api/ai/sentiment - Get sentiment for all symbols
  app.get("/api/ai/sentiment", isAuthenticated, async (req: any, res) => {
    try {
      const prices = getAllMarketPrices();
      const sentiments = await aiSentimentService.getAllSentiments(prices);
      res.json(sentiments);
    } catch (error: any) {
      console.error("Error getting all sentiments:", error);
      res.status(500).json({ error: "Failed to fetch sentiments", message: error.message });
    }
  });

  // POST /api/ai/patterns/analyze - Analyze user's trading patterns
  app.post("/api/ai/patterns/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const patterns = await patternRecognitionService.analyzeUserPatterns(userId);
      res.json(patterns);
    } catch (error: any) {
      console.error("Error analyzing patterns:", error);
      res.status(500).json({ error: "Failed to analyze patterns", message: error.message });
    }
  });

  // GET /api/ai/patterns/:userId - Get user's trading patterns
  app.get("/api/ai/patterns/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own patterns
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own trading patterns" });
      }
      
      const patterns = await patternRecognitionService.getUserPatterns(authenticatedUserId);
      res.json(patterns);
    } catch (error: any) {
      console.error("Error getting patterns:", error);
      res.status(500).json({ error: "Failed to fetch patterns", message: error.message });
    }
  });

  // POST /api/ai/suggestions/generate - Generate AI trade suggestions
  app.post("/api/ai/suggestions/generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const prices = getAllMarketPrices();
      const suggestions = await aiTradeSuggestionsService.generateTradeSuggestions(userId, prices);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions", message: error.message });
    }
  });

  // GET /api/ai/suggestions/active/:userId - Get active suggestions
  app.get("/api/ai/suggestions/active/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own suggestions
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own trade suggestions" });
      }
      
      const suggestions = await aiTradeSuggestionsService.getActiveSuggestions(authenticatedUserId);
      const prices = getAllMarketPrices();
      
      // Transform to match frontend TradeOpportunity interface
      const transformedSuggestions = suggestions.map((s: any) => {
        const currentPrice = prices[s.symbol] || 0;
        const targetPrice = s.targetPrice ? parseFloat(s.targetPrice) : currentPrice * 1.05;
        const expectedGain = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 5;
        
        // Parse basedOn from JSON if it's a string, otherwise default to pattern-based
        let basedOn = ['Market Analysis', 'Trading Patterns'];
        if (s.basedOn) {
          try {
            basedOn = typeof s.basedOn === 'string' ? JSON.parse(s.basedOn) : s.basedOn;
          } catch {
            basedOn = ['Market Analysis', 'Trading Patterns'];
          }
        }
        
        return {
          id: s.id,
          symbol: s.symbol,
          side: s.side,
          confidence: s.confidence ? parseFloat(s.confidence) : 70,
          targetPrice: targetPrice,
          currentPrice: currentPrice,
          expectedGain: Math.round(expectedGain * 10) / 10,
          reasoning: s.reasoning || `AI recommends ${s.side === 'buy' ? 'buying' : 'selling'} ${s.symbol} based on your trading patterns and market analysis.`,
          basedOn: basedOn,
          createdAt: s.createdAt || new Date().toISOString(),
        };
      });
      
      res.json(transformedSuggestions);
    } catch (error: any) {
      console.error("Error getting active suggestions:", error);
      res.status(500).json({ error: "Failed to fetch suggestions", message: error.message });
    }
  });

  // PUT /api/ai/suggestions/:id/execute - Mark suggestion as executed
  app.put("/api/ai/suggestions/:id/execute", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await aiTradeSuggestionsService.executeSuggestion(id);
      res.json({ success: true, message: "Suggestion executed" });
    } catch (error: any) {
      console.error("Error executing suggestion:", error);
      res.status(500).json({ error: "Failed to execute suggestion", message: error.message });
    }
  });

  // PUT /api/ai/suggestions/:id/dismiss - Dismiss suggestion
  app.put("/api/ai/suggestions/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await aiTradeSuggestionsService.dismissSuggestion(id);
      res.json({ success: true, message: "Suggestion dismissed" });
    } catch (error: any) {
      console.error("Error dismissing suggestion:", error);
      res.status(500).json({ error: "Failed to dismiss suggestion", message: error.message });
    }
  });

  // POST /api/ai/trade-assistant - Get AI advice for a specific trade
  app.post("/api/ai/trade-assistant", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { question, tradeContext } = req.body;
      
      if (!question || !question.trim()) {
        return res.status(400).json({ error: "Question is required" });
      }

      // Import AI service
      const { generateTradeAdvice } = await import('./services/aiTradeAssistant');
      
      const advice = await generateTradeAdvice(userId, question, tradeContext);
      res.json({ advice });
    } catch (error: any) {
      console.error("Error generating trade advice:", error);
      res.status(500).json({ error: "Failed to generate trade advice", message: error.message });
    }
  });

  // POST /api/ai/exit-advisor - Get AI exit advice for a position
  app.post("/api/ai/exit-advisor", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { positionContext } = req.body;
      
      if (!positionContext) {
        return res.status(400).json({ error: "Position context is required" });
      }

      // Import AI service
      const { generateExitAdvice } = await import('./services/aiExitAdvisor');
      
      const advice = await generateExitAdvice(userId, positionContext);
      res.json(advice);
    } catch (error: any) {
      console.error("Error generating exit advice:", error);
      res.status(500).json({ error: "Failed to generate exit advice", message: error.message });
    }
  });

  // POST /api/ai/whatif - Run What-If scenario simulation (Phase D)
  const whatIfRequestSchema = z.object({
    userId: z.string(),
    symbol: z.string(),
    side: z.enum(["buy", "sell"]),
    size: z.number().positive(),
    entryPrice: z.number().positive().optional(),
    slippagePct: z.number().min(0).max(10),
    timeframe: z.enum(["1h", "4h", "24h"]),
    lookbackDays: z.number().int().min(1).max(365).default(90),
  });

  app.post("/api/ai/whatif", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Validate request body
      const validationResult = whatIfRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.issues 
        });
      }

      const requestData = validationResult.data;

      // Security: Validate ownership - user can only run simulations for themselves
      if (authenticatedUserId !== requestData.userId) {
        return res.status(403).json({ 
          error: "Forbidden: You can only run simulations for your own account" 
        });
      }

      // Import simulation service
      const { simulateWhatIf } = await import('./services/whatIfService');
      
      // Run simulation
      const simulationResult = await simulateWhatIf(requestData);

      // Prepare AI explanation with OpenAI if available
      let aiExplanation = simulationResult.summary;
      let modelVersion = "fallback";
      
      // Generate deterministic prompt hash for audit trail (can be recomputed for verification)
      const crypto = await import('crypto');
      const canonicalRequest = JSON.stringify(requestData, Object.keys(requestData).sort());
      const promptHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          // Get user's trading DNA for context
          const { calculateTradingDNA } = await import('./services/tradingDNA');
          const tradingDna = await calculateTradingDNA(requestData.userId);
          
          const prompt = `Analyze this What-If trade simulation and provide concise explanation and suggestions.

Trade Setup:
- Symbol: ${requestData.symbol}
- Side: ${requestData.side}
- Size: $${requestData.size}
- Timeframe: ${requestData.timeframe}

Simulation Results:
- Expected return: ${simulationResult.distributions[requestData.timeframe].median}%
- Downside (5th percentile): ${simulationResult.distributions[requestData.timeframe].p5}%
- Upside (95th percentile): ${simulationResult.distributions[requestData.timeframe].p95}%
- Risk signals: ${simulationResult.riskSignals.join(', ') || 'None'}

Trader Profile:
- Win rate: ${tradingDna.winRate}%
- Trading style: ${tradingDna.tradingStyle}
- Risk score: ${tradingDna.riskScore}

Provide:
1. Brief explanation (2-3 sentences)
2. Key risks to watch
3. One alternative suggestion if risks exist

Keep response concise and actionable.`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a trading advisor analyzing probabilistic trade simulations. Be concise, clear, and focus on risk management."
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 300,
          });

          aiExplanation = completion.choices[0]?.message?.content || simulationResult.summary;
          modelVersion = "gpt-4o-mini";
        } catch (aiError: any) {
          console.error("[WHATIF] OpenAI error:", aiError.message);
          // Fallback to simulation summary if AI fails
        }
      }

      // Save simulation to database
      const simulationRecord = {
        userId: requestData.userId,
        requestJson: JSON.stringify(requestData),
        symbol: requestData.symbol,
        side: requestData.side,
        size: String(requestData.size),
        entryPrice: requestData.entryPrice ? String(requestData.entryPrice) : null,
        slippagePct: requestData.slippagePct ? String(requestData.slippagePct) : null,
        timeframe: requestData.timeframe,
        lookbackDays: requestData.lookbackDays || 90,
        resultJson: JSON.stringify(simulationResult),
        confidence: String(simulationResult.confidence),
        aiExplanation,
        modelVersion,
        promptHash, // Always has a value now
        riskSignals: JSON.stringify(simulationResult.riskSignals),
        suggestedAlternatives: JSON.stringify(simulationResult.suggestedAlternatives),
      };

      await db.insert(whatIfSimulations).values(simulationRecord);

      // Log to audit trail
      await db.insert(aiAuditLogs).values({
        userId: requestData.userId,
        featureType: "whatif_simulation",
        modelVersion,
        promptHash, // Always has a value now
        inputData: JSON.stringify(requestData),
        outputData: JSON.stringify(simulationResult),
        explanation: aiExplanation,
        confidence: String(simulationResult.confidence),
      });

      // Build response with AI explanation
      const response = {
        ...simulationResult,
        explanation: aiExplanation,
      };

      // Defensive: Validate response structure before sending to client
      // This ensures service always returns complete data
      const distributionSchema = z.object({
        median: z.number().finite(),
        p5: z.number().finite(),
        p95: z.number().finite(),
        mean: z.number().finite(),
        stdDev: z.number().finite(),
      });

      const suggestedAlternativeSchema = z.object({
        reason: z.string(),
        size: z.number().finite().positive(),
        entryPrice: z.number().finite().positive().optional(),
        slippagePct: z.number().finite().min(0).max(10),
      });

      const responseSchema = z.object({
        summary: z.string(),
        confidence: z.number().finite().min(0).max(100),
        distributions: z.object({
          "1h": distributionSchema,
          "4h": distributionSchema,
          "24h": distributionSchema,
        }),
        probabilityBuckets: z.object({
          veryNegative: z.number().finite().min(0).max(100),
          negative: z.number().finite().min(0).max(100),
          neutral: z.number().finite().min(0).max(100),
          positive: z.number().finite().min(0).max(100),
          veryPositive: z.number().finite().min(0).max(100),
        }),
        riskSignals: z.array(z.string()),
        suggestedAlternatives: z.array(suggestedAlternativeSchema),
        explanation: z.string().optional(),
      });

      const responseValidation = responseSchema.safeParse(response);
      if (!responseValidation.success) {
        console.error("[WHATIF] Response validation failed:", responseValidation.error);
        throw new Error("Invalid simulation result structure - backend data integrity issue");
      }

      res.json(responseValidation.data);
    } catch (error: any) {
      console.error("Error running What-If simulation:", error);
      res.status(500).json({ 
        error: "Failed to run simulation", 
        message: error.message 
      });
    }
  });

  // POST /api/analysis/range - Analyze trading performance over a timeframe (Phase E)
  const timeframeAnalysisSchema = z.object({
    dateFrom: z.string().transform(str => new Date(str)),
    dateTo: z.string().transform(str => new Date(str)),
  });

  app.post("/api/analysis/range", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Validate request body
      const validationResult = timeframeAnalysisSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.issues 
        });
      }

      const { dateFrom, dateTo } = validationResult.data;

      // Import and run timeframe analysis service
      const { analyzeTimeframe } = await import('./services/timeframeAnalysisService');
      
      // Analysis service handles saving to database internally
      const analysisResult = await analyzeTimeframe({
        userId,
        dateFrom,
        dateTo,
      });

      res.json(analysisResult);
    } catch (error: any) {
      console.error("Error analyzing timeframe:", error);
      res.status(500).json({ 
        error: "Failed to analyze timeframe", 
        message: error.message 
      });
    }
  });

  // GET /api/analysis/history - Get analysis history (Phase E)
  app.get("/api/analysis/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const analysisRuns = await storage.getAIAnalysisRuns(userId, limit);
      
      res.json(analysisRuns);
    } catch (error: any) {
      console.error("Error fetching analysis history:", error);
      res.status(500).json({ 
        error: "Failed to fetch analysis history", 
        message: error.message 
      });
    }
  });

  // GET /api/risk/status/:userId - Get trading status and risk guard settings
  app.get("/api/risk/status/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const reqUser = req.user as any;
      const authenticatedUserId = reqUser?.id || reqUser.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own risk status
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own risk status" });
      }
      
      const user = await storage.getUser(authenticatedUserId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get risk guard settings
      const riskSettings = await storage.getRiskGuardSettings(authenticatedUserId);

      res.json({ 
        userId: user.id,
        tradingPaused: user.tradingPaused,
        status: user.tradingPaused ? 'paused' : 'active',
        ...riskSettings // Include all risk guard settings
      });
    } catch (error) {
      console.error("Error fetching risk status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/risk/settings - Update risk guard enforcement settings (authenticated user only)
  const updateRiskSettingsSchema = z.object({
    enforceDailyLossLimit: z.boolean().optional(),
    enforceMonthlyLossLimit: z.boolean().optional(),
    maxDailyLossPercent: z.string().optional(),
    maxDailyLossAmount: z.string().optional(),
    maxMonthlyLossPercent: z.string().optional(),
    maxMonthlyLossAmount: z.string().optional(),
  }).strict(); // Reject any additional fields

  app.patch("/api/risk/settings", isAuthenticated, async (req: any, res) => {
    try {
      const reqUser = req.user as any;
      const authenticatedUserId = reqUser?.id || reqUser.claims.sub;
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Validate input - only allow enforcement flag updates
      const validationResult = updateRiskSettingsSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.errors 
        });
      }

      const { 
        enforceDailyLossLimit, 
        enforceMonthlyLossLimit,
        maxDailyLossPercent,
        maxDailyLossAmount,
        maxMonthlyLossPercent,
        maxMonthlyLossAmount
      } = validationResult.data;

      // Get current settings
      let settings = await storage.getRiskGuardSettings(authenticatedUserId);

      if (!settings) {
        // Create default settings if none exist
        settings = await storage.createRiskGuardSettings({ userId: authenticatedUserId });
      }

      // Update enforcement flags and limit amounts
      const updates: Partial<RiskGuardSettings> = {};
      if (enforceDailyLossLimit !== undefined) {
        updates.enforceDailyLossLimit = enforceDailyLossLimit;
      }
      if (enforceMonthlyLossLimit !== undefined) {
        updates.enforceMonthlyLossLimit = enforceMonthlyLossLimit;
      }
      if (maxDailyLossPercent !== undefined) {
        updates.maxDailyLossPercent = maxDailyLossPercent;
      }
      if (maxDailyLossAmount !== undefined) {
        updates.maxDailyLossAmount = maxDailyLossAmount;
      }
      if (maxMonthlyLossPercent !== undefined) {
        updates.maxMonthlyLossPercent = maxMonthlyLossPercent;
      }
      if (maxMonthlyLossAmount !== undefined) {
        updates.maxMonthlyLossAmount = maxMonthlyLossAmount;
      }

      const updated = await storage.updateRiskGuardSettings(authenticatedUserId, updates);

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating risk settings:", error);
      res.status(500).json({ 
        error: "Failed to update settings", 
        message: error.message 
      });
    }
  });

  // POST /api/risk/pause - Pause trading for a user
  const pauseSchema = z.object({
    userId: z.string(),
  });

  app.post("/api/risk/pause", isAuthenticated, async (req: any, res) => {
    try {
      const validationResult = pauseSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.errors 
        });
      }

      const { userId } = validationResult.data;
      await storage.updateUserTradingStatus(userId, true);
      
      res.json({ 
        success: true, 
        message: "Trading paused",
        tradingPaused: true 
      });
    } catch (error) {
      console.error("Error pausing trading:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/risk/resume - Resume trading for a user
  app.post("/api/risk/resume", isAuthenticated, async (req: any, res) => {
    try {
      const validationResult = pauseSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.errors 
        });
      }

      const { userId } = validationResult.data;
      await storage.updateUserTradingStatus(userId, false);
      
      res.json({ 
        success: true, 
        message: "Trading resumed",
        tradingPaused: false 
      });
    } catch (error) {
      console.error("Error resuming trading:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/risk/guard/:userId - Get risk guard settings
  app.get("/api/risk/guard/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own risk guard settings
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own risk guard settings" });
      }
      
      let settings = await storage.getRiskGuardSettings(authenticatedUserId);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createRiskGuardSettings({ userId: authenticatedUserId });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching risk guard settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/risk/guard/:userId - Update risk guard settings
  const updateRiskGuardSchema = z.object({
    maxDailyLossPercent: z.string().optional(),
    maxDailyLossAmount: z.string().optional(),
    maxPortfolioDrawdownPercent: z.string().optional(),
    maxPositionSizePercent: z.string().optional(),
    maxPositionSizeAmount: z.string().optional(),
    maxOpenPositions: z.number().optional(),
    autoPauseEnabled: z.boolean().optional(),
  });

  app.put("/api/risk/guard/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only update their own risk guard settings
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only update your own risk guard settings" });
      }
      
      const validationResult = updateRiskGuardSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.errors 
        });
      }

      await storage.updateRiskGuardSettings(authenticatedUserId, validationResult.data);
      const updated = await storage.getRiskGuardSettings(authenticatedUserId);
      
      res.json({ 
        success: true, 
        message: "Risk Guard settings updated",
        settings: updated 
      });
    } catch (error) {
      console.error("Error updating risk guard settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/test/prices - Get current market prices
  app.get("/api/test/prices", async (req, res) => {
    try {
      const prices = getAllMarketPrices();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/test/set-price - Update market price for testing
  const setPriceSchema = z.object({
    symbol: z.string(),
    price: z.number().positive(),
  });

  app.post("/api/test/set-price", async (req, res) => {
    try {
      const validationResult = setPriceSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validationResult.error.errors 
        });
      }

      const { symbol, price } = validationResult.data;
      setMarketPrice(symbol, price);
      
      res.json({ 
        success: true, 
        symbol: symbol.toUpperCase(),
        newPrice: price,
        message: `${symbol.toUpperCase()} price updated to $${price}`
      });
    } catch (error) {
      console.error("Error setting price:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== WATCHLIST ROUTES =====
  
  // GET /api/watchlist/:userId - Get user's watchlist
  app.get("/api/watchlist/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own watchlist
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own watchlist" });
      }
      
      const watchlist = await storage.getWatchlistByUserId(authenticatedUserId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  // POST /api/watchlist - Add symbol to watchlist
  app.post("/api/watchlist", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationResult = insertWatchlistSchema.safeParse({
      userId: userId,
      symbol: req.body.symbol?.toUpperCase()
    });

    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid request", details: validationResult.error.errors });
    }

    try {
      // Check if already in watchlist
      const existing = await storage.getWatchlistItem(userId, validationResult.data.symbol);
      if (existing) {
        return res.status(400).json({ error: "Symbol already in watchlist" });
      }

      const item = await storage.addToWatchlist(validationResult.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  });

  // DELETE /api/watchlist/:id - Remove from watchlist
  app.delete("/api/watchlist/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      
      // Security: Verify the watchlist item belongs to the authenticated user
      const item = await storage.getWatchlistItemById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      if (item.userId !== authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only delete your own watchlist items" });
      }
      
      await storage.removeFromWatchlist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  });

  // ===== PRICE ALERTS ROUTES =====
  
  // GET /api/alerts/:userId - Get user's price alerts
  app.get("/api/alerts/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own price alerts
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own price alerts" });
      }
      
      const alerts = await storage.getPriceAlertsByUserId(authenticatedUserId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // POST /api/alerts - Create price alert
  app.post("/api/alerts", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationResult = insertPriceAlertSchema.safeParse({
      userId: userId,
      symbol: req.body.symbol?.toUpperCase(),
      condition: req.body.condition,
      targetPrice: req.body.targetPrice,
      isActive: true
    });

    if (!validationResult.success) {
      return res.status(400).json({ error: "Invalid request", details: validationResult.error.errors });
    }

    try {
      const alert = await storage.createPriceAlert(validationResult.data);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  // PATCH /api/alerts/:id - Update price alert
  app.patch("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      
      // Security: Verify the alert belongs to the authenticated user
      const alert = await storage.getPriceAlertById(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Price alert not found" });
      }
      if (alert.userId !== authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only update your own price alerts" });
      }
      
      await storage.updatePriceAlert(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // DELETE /api/alerts/:id - Delete price alert
  app.delete("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      
      // Security: Verify the alert belongs to the authenticated user
      const alert = await storage.getPriceAlertById(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Price alert not found" });
      }
      if (alert.userId !== authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only delete your own price alerts" });
      }
      
      await storage.deletePriceAlert(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // Live Exchange Routes (Phase 1)
  const { connectExchange, getExchangeStatus, preCheckOrder, confirmAndExecute } = await import("./services/liveExchangeService");

  // POST /api/exchange/connect - Connect exchange with encrypted API keys
  app.post("/api/exchange/connect", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const { exchange, apiKey, apiSecret, permissions, testnet } = req.body;

      console.log(`[EXCHANGE] Connection attempt - User: ${authenticatedUserId}, Exchange: ${exchange}, Testnet: ${testnet}`);
      console.log(`[EXCHANGE] API Key (first 10 chars): ${apiKey?.substring(0, 10)}...`);
      console.log(`[EXCHANGE] Permissions: ${permissions}`);

      if (!exchange || !apiKey || !apiSecret || !permissions) {
        console.error(`[EXCHANGE] Missing required fields - exchange: ${!!exchange}, apiKey: ${!!apiKey}, apiSecret: ${!!apiSecret}, permissions: ${!!permissions}`);
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await connectExchange(authenticatedUserId, exchange, apiKey, apiSecret, permissions, testnet);

      if (!result.success) {
        console.error(`[EXCHANGE] Connection failed: ${result.error}`);
        return res.status(400).json({ error: result.error });
      }

      console.log(`[AUDIT] Exchange connected - User: ${authenticatedUserId}, Exchange: ${exchange}, Permissions: ${permissions}`);

      res.json({ success: true, connectionId: result.connectionId });
    } catch (error: any) {
      console.error("[EXCHANGE] Error connecting exchange:", error);
      res.status(500).json({ error: error.message || "Failed to connect exchange" });
    }
  });

  // GET /api/exchange/status/:userId - Get exchange connection status
  app.get("/api/exchange/status/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;

      // Security: Validate user can only access their own exchange status
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own exchange connection status" });
      }

      const status = await getExchangeStatus(authenticatedUserId);
      res.json(status);
    } catch (error) {
      console.error("Error getting exchange status:", error);
      res.status(500).json({ error: "Failed to get exchange status" });
    }
  });

  // GET /api/exchange/balance/:userId - Get exchange account balance and positions
  app.get("/api/exchange/balance/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;

      // Security: Validate user can only access their own balance
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own exchange balance" });
      }

      // Get exchange connection
      const connections = await storage.getExchangeConnectionsByUserId(authenticatedUserId);
      const connection = connections.find(c => c.exchange === 'binance');
      if (!connection) {
        return res.status(404).json({ error: "No exchange connection found" });
      }

      // Import BinanceService
      const { BinanceService } = await import("./services/binanceService");
      const { decrypt } = await import("./utils/encryption");

      // Decrypt API keys
      const apiKey = decrypt(connection.encryptedApiKey);
      const apiSecret = decrypt(connection.encryptedApiSecret);

      // Create Binance service instance
      const binanceService = new BinanceService({ apiKey, apiSecret, testnet: connection.testnet || false });

      // Fetch account info from Binance
      const accountInfo = await binanceService.getAccountInfo();

      console.log(`[EXCHANGE] Fetched balance for user ${authenticatedUserId} - Total: ${accountInfo.balances.length} assets`);

      res.json({
        balances: accountInfo.balances,
        canTrade: accountInfo.canTrade,
        canDeposit: accountInfo.canDeposit,
        canWithdraw: accountInfo.canWithdraw,
        updateTime: Date.now(),
      });
    } catch (error: any) {
      console.error("[EXCHANGE] Error fetching balance:", error);
      res.status(500).json({ error: error.message || "Failed to fetch exchange balance" });
    }
  });

  // GET /api/exchange/orders/:userId - Get open orders from Binance
  app.get("/api/exchange/orders/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;

      // Security: Validate user can only access their own orders
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own orders" });
      }

      // Get exchange connection
      const connections = await storage.getExchangeConnectionsByUserId(authenticatedUserId);
      const connection = connections.find(c => c.exchange === 'binance');
      if (!connection) {
        return res.status(404).json({ error: "No exchange connection found" });
      }

      // Import BinanceService
      const { BinanceService } = await import("./services/binanceService");
      const { decrypt } = await import("./utils/encryption");

      // Decrypt API keys
      const apiKey = decrypt(connection.encryptedApiKey);
      const apiSecret = decrypt(connection.encryptedApiSecret);

      // Create Binance service instance
      const binanceService = new BinanceService({ apiKey, apiSecret, testnet: connection.testnet || false });

      // Fetch open orders from Binance
      const orders = await binanceService.getOpenOrders();

      console.log(`[EXCHANGE] Fetched ${orders.length} open orders for user ${authenticatedUserId}`);

      res.json({ orders });
    } catch (error: any) {
      console.error("[EXCHANGE] Error fetching orders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch exchange orders" });
    }
  });

  // DELETE /api/exchange/orders/:userId/:symbol/:orderId - Cancel an order
  app.delete("/api/exchange/orders/:userId/:symbol/:orderId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      const { symbol, orderId } = req.params;

      // Security: Validate user can only cancel their own orders
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only cancel your own orders" });
      }

      // Get exchange connection
      const connections = await storage.getExchangeConnectionsByUserId(authenticatedUserId);
      const connection = connections.find(c => c.exchange === 'binance');
      if (!connection) {
        return res.status(404).json({ error: "No exchange connection found" });
      }

      // Import BinanceService
      const { BinanceService } = await import("./services/binanceService");
      const { decrypt } = await import("./utils/encryption");

      // Decrypt API keys
      const apiKey = decrypt(connection.encryptedApiKey);
      const apiSecret = decrypt(connection.encryptedApiSecret);

      // Create Binance service instance
      const binanceService = new BinanceService({ apiKey, apiSecret, testnet: connection.testnet || false });

      // Cancel the order
      const result = await binanceService.cancelOrder(symbol, parseInt(orderId));

      console.log(`[EXCHANGE] Cancelled order ${orderId} for user ${authenticatedUserId}`);

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("[EXCHANGE] Error cancelling order:", error);
      res.status(500).json({ error: error.message || "Failed to cancel order" });
    }
  });

  // POST /api/exchange/execute - Pre-check order and generate execution token
  app.post("/api/exchange/execute", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { exchange, symbol, side, type, quantity, price } = req.body;

      if (!exchange || !symbol || !side || !type || !quantity) {
        return res.status(400).json({ error: "Missing required order fields" });
      }

      // Check if trading is paused
      if (user.tradingPaused) {
        return res.status(403).json({ 
          error: "Trading is paused",
          reason: "Risk limits triggered. Review your settings to resume."
        });
      }

      const orderPayload = { symbol, side, type, quantity, price };
      const result = await preCheckOrder(user.id, exchange, orderPayload);

      console.log(`[AUDIT] Pre-check - User: ${user.id}, Allowed: ${result.preCheck.allowed}, Reason: ${result.preCheck.reason}`);

      res.json({
        token: result.token,
        preCheck: result.preCheck,
      });
    } catch (error: any) {
      console.error("Error in pre-check:", error);
      res.status(500).json({ error: error.message || "Pre-check failed" });
    }
  });

  // POST /api/exchange/confirm - Confirm and execute order with token
  app.post("/api/exchange/confirm", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { exchange, token, twoFactorCode } = req.body;

      if (!exchange || !token) {
        return res.status(400).json({ error: "Missing exchange or token" });
      }

      const result = await confirmAndExecute(user.id, exchange, token, twoFactorCode);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      console.log(`[AUDIT] Order executed - User: ${user.id}, OrderID: ${result.orderId}`);

      res.json(result);
    } catch (error: any) {
      console.error("Error confirming order:", error);
      res.status(500).json({ error: error.message || "Failed to execute order" });
    }
  });

  // ============================================
  // AI FEATURE ROUTES (8 New AI Services)
  // ============================================

  // AI Risk Advisor Routes
  app.post("/api/ai/risk/assess", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { currentPrices } = req.body;
      
      const { generateRiskAssessment } = await import('./services/aiRiskAdvisorService');
      const assessment = await generateRiskAssessment(userId, currentPrices);
      
      res.json(assessment);
    } catch (error: any) {
      console.error("Error generating risk assessment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/risk/latest/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own risk assessment
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own risk assessments" });
      }
      
      const { getLatestRiskAssessment } = await import('./services/aiRiskAdvisorService');
      const assessment = await getLatestRiskAssessment(authenticatedUserId);
      
      res.json(assessment);
    } catch (error: any) {
      console.error("Error fetching risk assessment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI News Analyzer Routes
  app.get("/api/ai/news/latest", isAuthenticated, async (req, res) => {
    try {
      const { symbol, limit } = req.query;
      const { getLatestNews } = await import('./services/aiNewsAnalyzerService');
      const news = await getLatestNews(symbol as string, limit ? parseInt(limit as string) : 10);
      
      res.json(news);
    } catch (error: any) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/news/generate", isAuthenticated, async (req, res) => {
    try {
      const { symbols } = req.body;
      const { generateMarketBriefing } = await import('./services/aiNewsAnalyzerService');
      const briefing = await generateMarketBriefing(symbols || ['BTC', 'ETH', 'SOL']);
      
      res.json(briefing);
    } catch (error: any) {
      console.error("Error generating news briefing:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Portfolio Optimizer Routes
  app.post("/api/ai/portfolio/optimize", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { currentPrices } = req.body;
      
      const { generatePortfolioOptimization } = await import('./services/aiPortfolioOptimizerService');
      const optimization = await generatePortfolioOptimization(userId, currentPrices);
      
      res.json(optimization);
    } catch (error: any) {
      console.error("Error optimizing portfolio:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/portfolio/latest/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own portfolio optimization
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own portfolio optimization" });
      }
      
      const { getLatestOptimization } = await import('./services/aiPortfolioOptimizerService');
      const optimization = await getLatestOptimization(authenticatedUserId);
      
      res.json(optimization);
    } catch (error: any) {
      console.error("Error fetching portfolio optimization:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Trading Coach Routes
  app.post("/api/ai/coach/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { generateCoachingInsights } = await import('./services/aiTradingCoachService');
      const insights = await generateCoachingInsights(userId);
      
      res.json(insights);
    } catch (error: any) {
      console.error("Error generating coaching insights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/coach/insights/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own coaching insights
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own coaching insights" });
      }
      
      const { getUnacknowledgedInsights } = await import('./services/aiTradingCoachService');
      const insights = await getUnacknowledgedInsights(authenticatedUserId);
      
      res.json(insights);
    } catch (error: any) {
      console.error("Error fetching coaching insights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/coach/acknowledge/:insightId", isAuthenticated, async (req, res) => {
    try {
      const { acknowledgeInsight } = await import('./services/aiTradingCoachService');
      await acknowledgeInsight(req.params.insightId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error acknowledging insight:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Price Predictions Routes
  app.post("/api/ai/predictions/generate", isAuthenticated, async (req, res) => {
    try {
      const { symbol, currentPrice, timeframe, marketData } = req.body;
      const { generatePricePrediction } = await import('./services/aiPricePredictionService');
      const prediction = await generatePricePrediction(symbol, currentPrice, timeframe, marketData);
      
      res.json(prediction);
    } catch (error: any) {
      console.error("Error generating price prediction:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/predictions/:symbol", isAuthenticated, async (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeframe } = req.query;
      const { getPredictions } = await import('./services/aiPricePredictionService');
      const predictions = await getPredictions(symbol, timeframe as any);
      
      res.json(predictions);
    } catch (error: any) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Correlation Detector Routes
  app.post("/api/ai/correlations/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { analyzePortfolioCorrelations } = await import('./services/aiCorrelationDetectorService');
      const analysis = await analyzePortfolioCorrelations(userId);
      
      res.json(analysis);
    } catch (error: any) {
      console.error("Error analyzing correlations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/correlations/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own correlation analysis
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own correlation analysis" });
      }
      
      const { getCorrelationAnalysis } = await import('./services/aiCorrelationDetectorService');
      const analysis = await getCorrelationAnalysis(authenticatedUserId);
      
      res.json(analysis);
    } catch (error: any) {
      console.error("Error fetching correlation analysis:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Volatility Forecaster Routes
  app.post("/api/ai/volatility/forecast", isAuthenticated, async (req, res) => {
    try {
      const { symbol, currentPrice, historicalPrices, timeframe } = req.body;
      const { generateVolatilityForecast } = await import('./services/aiVolatilityForecastService');
      const forecast = await generateVolatilityForecast(symbol, currentPrice, historicalPrices, timeframe);
      
      res.json(forecast);
    } catch (error: any) {
      console.error("Error generating volatility forecast:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/volatility/:symbol", isAuthenticated, async (req, res) => {
    try {
      const { getVolatilityForecasts } = await import('./services/aiVolatilityForecastService');
      const forecasts = await getVolatilityForecasts(req.params.symbol);
      
      res.json(forecasts);
    } catch (error: any) {
      console.error("Error fetching volatility forecasts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/volatility/market/overview", isAuthenticated, async (req, res) => {
    try {
      const { symbols } = req.query;
      const { getMarketVolatilityOverview } = await import('./services/aiVolatilityForecastService');
      const overview = await getMarketVolatilityOverview(symbols ? (symbols as string).split(',') : undefined);
      
      res.json(overview);
    } catch (error: any) {
      console.error("Error fetching market volatility overview:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Position Sizing Routes
  app.post("/api/ai/position-size/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { symbol, entryPrice, stopLoss } = req.body;
      
      const { calculateOptimalPositionSize } = await import('./services/aiPositionSizingService');
      const recommendation = await calculateOptimalPositionSize(userId, symbol, entryPrice, stopLoss);
      
      res.json(recommendation);
    } catch (error: any) {
      console.error("Error calculating position size:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/position-size/history/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Validate user can only access their own position sizing history
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own position sizing history" });
      }
      
      const { symbol } = req.query;
      const { getPositionSizingHistory } = await import('./services/aiPositionSizingService');
      const history = await getPositionSizingHistory(authenticatedUserId, symbol as string);
      
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching position sizing history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Risk Precheck Route (North Star: Protect the User)
  app.post("/api/ai/precheck", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { orderPayload, currentPrice } = req.body;
      
      if (!orderPayload || !currentPrice) {
        return res.status(400).json({ error: "orderPayload and currentPrice are required" });
      }

      const { precheckOrder } = await import('./services/riskPrecheckService');
      const result = await precheckOrder(userId, orderPayload, currentPrice);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error in risk precheck:", error);
      res.status(500).json({ 
        allowed: false,
        reason: "Failed to validate order",
        error: error.message 
      });
    }
  });

  // AI Audit Trail Routes (North Star: Transparency & Accountability)
  // SECURITY: Always use authenticated user's ID, never trust URL parameter
  app.get("/api/ai/audit/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const authenticatedUserId = user?.id || user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Security: Only allow users to access their own audit logs
      if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own audit logs" });
      }
      
      const { limit } = req.query;
      const { getUserAuditTrail } = await import('./services/aiAuditService');
      const auditTrail = await getUserAuditTrail(
        authenticatedUserId, 
        limit ? parseInt(limit as string) : 50
      );
      
      res.json(auditTrail);
    } catch (error: any) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/audit/feature/:featureType", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { limit } = req.query;
      const { getAuditLogsByFeature } = await import('./services/aiAuditService');
      const logs = await getAuditLogsByFeature(
        userId,
        req.params.featureType,
        limit ? parseInt(limit as string) : 20
      );
      
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching feature audit logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PHASE A: NORTH STAR CRITICAL FEATURES ====================

  // Privacy Preferences Routes
  app.get("/api/privacy/preferences", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { privacyPreferencesService } = await import('./services/privacyPreferences');
      const prefs = await privacyPreferencesService.getOrCreatePreferences(userId);
      res.json(prefs);
    } catch (error: any) {
      console.error("Error fetching privacy preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/privacy/preferences", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { privacyPreferencesService } = await import('./services/privacyPreferences');
      const updated = await privacyPreferencesService.updatePreferences(userId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating privacy preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Feature Flags Routes
  app.get("/api/feature-flags", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { featureFlagsService } = await import('./services/featureFlags');
      const flags = await featureFlagsService.getAllFlags();
      
      const userFlags = await Promise.all(
        flags.map(async (flag) => ({
          ...flag,
          enabled: await featureFlagsService.isFeatureEnabled(flag.featureKey, userId),
        }))
      );
      
      res.json(userFlags);
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/feature-flags/:featureKey", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { featureFlagsService } = await import('./services/featureFlags');
      const enabled = await featureFlagsService.isFeatureEnabled(req.params.featureKey, userId);
      res.json({ enabled });
    } catch (error: any) {
      console.error("Error checking feature flag:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Risk Precheck Routes
  app.post("/api/risk/precheck", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { riskPrecheckService } = await import('./services/riskPrecheck');
      const result = await riskPrecheckService.validateTrade(userId, req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Error running risk precheck:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/risk/prechecks", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { riskPrecheckService } = await import('./services/riskPrecheck');
      const prechecks = await riskPrecheckService.getRecentPrechecks(userId);
      res.json(prechecks);
    } catch (error: any) {
      console.error("Error fetching prechecks:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Audit Logs Routes (Phase A version)
  app.get("/api/ai-audit/logs", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiAuditLogger } = await import('./services/aiAuditLogger');
      const logs = await aiAuditLogger.getUserLogs(userId, 50);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching AI audit logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai-audit/logs/:featureType", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiAuditLogger } = await import('./services/aiAuditLogger');
      const logs = await aiAuditLogger.getLogsByFeature(userId, req.params.featureType);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching AI audit logs by feature:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PHASE B: AI LEARNING & PERSONALIZATION
  // ========================================

  // AI Outcome Tracking - Record user action on suggestion
  app.post("/api/ai-learning/action", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiOutcomeTracker } = await import('./services/aiOutcomeTracker');
      const outcome = await aiOutcomeTracker.recordUserAction({
        userId,
        ...req.body
      });
      res.json(outcome);
    } catch (error: any) {
      console.error("Error recording user action:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Outcome Tracking - Record trade outcome
  app.post("/api/ai-learning/outcome", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiOutcomeTracker } = await import('./services/aiOutcomeTracker');
      const outcome = await aiOutcomeTracker.recordTradeOutcome({
        userId,
        ...req.body
      });
      res.json(outcome);
    } catch (error: any) {
      console.error("Error recording trade outcome:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get AI outcomes for user
  app.get("/api/ai-learning/outcomes", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiOutcomeTracker } = await import('./services/aiOutcomeTracker');
      const outcomes = await aiOutcomeTracker.getUserOutcomes(userId, 50);
      res.json(outcomes);
    } catch (error: any) {
      console.error("Error fetching AI outcomes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User Feedback - Submit feedback on AI suggestions
  app.post("/api/ai-learning/feedback", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { userFeedbackService } = await import('./services/userFeedbackService');
      const feedback = await userFeedbackService.submitFeedback({
        userId,
        ...req.body
      });
      res.json(feedback);
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick thumbs up/down feedback
  app.post("/api/ai-learning/feedback/quick", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { userFeedbackService } = await import('./services/userFeedbackService');
      const feedback = await userFeedbackService.quickFeedback({
        userId,
        ...req.body
      });
      res.json(feedback);
    } catch (error: any) {
      console.error("Error submitting quick feedback:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user feedback history
  app.get("/api/ai-learning/feedback", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { userFeedbackService } = await import('./services/userFeedbackService');
      const feedback = await userFeedbackService.getUserFeedback(userId, 50);
      res.json(feedback);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Learning Analytics - Get AI accuracy and progress
  app.get("/api/ai-learning/progress", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { learningAnalytics } = await import('./services/learningAnalytics');
      const progress = await learningAnalytics.getProgressSummary(userId);
      res.json(progress);
    } catch (error: any) {
      console.error("Error fetching learning progress:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get learning checkpoints
  app.get("/api/ai-learning/checkpoints", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { learningAnalytics } = await import('./services/learningAnalytics');
      const checkpoints = await learningAnalytics.getCheckpointHistory(userId, 10);
      res.json(checkpoints);
    } catch (error: any) {
      console.error("Error fetching checkpoints:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create manual learning checkpoint
  app.post("/api/ai-learning/checkpoint", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { learningAnalytics } = await import('./services/learningAnalytics');
      const checkpoint = await learningAnalytics.createCheckpoint({
        userId,
        checkpointType: 'manual',
        modelVersion: req.body.modelVersion || 'gpt-4o-mini'
      });
      res.json(checkpoint);
    } catch (error: any) {
      console.error("Error creating checkpoint:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trading DNA Evolution - Get evolution timeline
  app.get("/api/ai-learning/dna/evolution", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { tradingDnaEvolution } = await import('./services/tradingDnaEvolution');
      const timeline = await tradingDnaEvolution.getEvolutionTimeline(userId);
      res.json(timeline);
    } catch (error: any) {
      console.error("Error fetching DNA evolution:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get DNA snapshots
  app.get("/api/ai-learning/dna/snapshots", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { tradingDnaEvolution } = await import('./services/tradingDnaEvolution');
      const snapshots = await tradingDnaEvolution.getSnapshotHistory(userId, 30);
      res.json(snapshots);
    } catch (error: any) {
      console.error("Error fetching DNA snapshots:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all milestones
  app.get("/api/ai-learning/dna/milestones", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { tradingDnaEvolution } = await import('./services/tradingDnaEvolution');
      const milestones = await tradingDnaEvolution.getAllMilestones(userId);
      res.json(milestones);
    } catch (error: any) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create DNA snapshot
  app.post("/api/ai-learning/dna/snapshot", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { tradingDnaEvolution } = await import('./services/tradingDnaEvolution');
      const snapshot = await tradingDnaEvolution.createSnapshot({
        userId,
        snapshotType: req.body.snapshotType || 'manual'
      });
      res.json(snapshot);
    } catch (error: any) {
      console.error("Error creating DNA snapshot:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // PHASE 3: PERSONAL AI AGENT LEARNING & DECISION SUPPORT
  // ============================================================================

  // Submit AI feedback with thumbs up/down and notes
  app.post("/api/ai/feedback", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      
      const {
        contextType,
        contextId,
        aiInput,
        aiOutput,
        aiReasoning,
        feedbackType,
        feedbackNotes,
        userAction
      } = req.body;

      // Validate required fields
      if (!contextType || !aiInput || !aiOutput || !feedbackType) {
        return res.status(400).json({ 
          error: "contextType, aiInput, aiOutput, and feedbackType are required" 
        });
      }

      if (!['thumbs_up', 'thumbs_down', 'neutral'].includes(feedbackType)) {
        return res.status(400).json({ 
          error: "feedbackType must be 'thumbs_up', 'thumbs_down', or 'neutral'" 
        });
      }

      // Check user's data share opt-in status
      const userRecord = await storage.getUser(userId);
      const sharedToEnsemble = userRecord?.dataShareOptIn || false;

      // Create the personal example
      const example = await storage.createAIPersonalExample({
        userId,
        contextType,
        contextId,
        aiInput,
        aiOutput,
        aiReasoning,
        feedbackType,
        feedbackNotes,
        userAction,
        isPrivate: true, // Always private by default
        sharedToEnsemble, // Only shared if user has opted in
        outcomeTracked: false
      });

      // Update agent health metrics
      let health = await storage.getAIAgentHealth(userId);
      
      if (!health) {
        // Create new health record
        health = await storage.createAIAgentHealth({
          userId,
          totalExamples: 1,
          positiveExamples: feedbackType === 'thumbs_up' ? 1 : 0,
          negativeExamples: feedbackType === 'thumbs_down' ? 1 : 0,
          lastFeedbackAt: new Date()
        });
      } else {
        // Update existing health record
        const updates: Partial<any> = {
          totalExamples: (health.totalExamples || 0) + 1,
          lastFeedbackAt: new Date()
        };

        if (feedbackType === 'thumbs_up') {
          updates.positiveExamples = (health.positiveExamples || 0) + 1;
        } else if (feedbackType === 'thumbs_down') {
          updates.negativeExamples = (health.negativeExamples || 0) + 1;
        }

        // Calculate confidence and readiness scores
        const total = updates.totalExamples;
        const positive = updates.positiveExamples || health.positiveExamples || 0;
        
        // Confidence based on positive feedback ratio
        updates.confidenceScore = total > 0 ? ((positive / total) * 100).toFixed(2) : '0';
        
        // Readiness score based on total examples and positive ratio
        let readiness = Math.min(100, (total / 50) * 100); // Max at 50 examples
        if (positive / total < 0.5) readiness *= 0.5; // Penalize if less than 50% positive
        updates.readinessScore = readiness.toFixed(2);
        
        // Readiness level based on score
        if (readiness >= 80) updates.readinessLevel = 'expert';
        else if (readiness >= 60) updates.readinessLevel = 'ready';
        else if (readiness >= 30) updates.readinessLevel = 'training';
        else updates.readinessLevel = 'learning';

        await storage.updateAIAgentHealth(userId, updates);
      }

      // SHADOW LEARNING: Log user feedback to audit_log.jsonl
      const feedbackValue = feedbackType === 'thumbs_up' ? 'positive' : 
                           feedbackType === 'thumbs_down' ? 'negative' : 'ignored';
      
      await shadowLearningLogger.updateOutcome(
        userId,
        contextType || 'unknown',
        {
          action_taken: userAction || feedbackValue,
        },
        feedbackValue
      );

      res.json({ 
        success: true, 
        exampleId: example.id,
        message: "Feedback recorded successfully" 
      });
    } catch (error: any) {
      console.error("Error recording AI feedback:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Personal Agent Health status
  app.get("/api/ai/agent-health", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;

      let health = await storage.getAIAgentHealth(userId);
      
      if (!health) {
        // Create default health record if none exists
        health = await storage.createAIAgentHealth({
          userId,
          totalExamples: 0,
          positiveExamples: 0,
          negativeExamples: 0,
          confidenceScore: '0',
          readinessScore: '0',
          readinessLevel: 'learning'
        });
      }

      res.json(health);
    } catch (error: any) {
      console.error("Error fetching agent health:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // SHADOW LEARNING: Get audit log stats
  app.get("/api/ai/shadow-stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await shadowLearningLogger.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching shadow learning stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // SHADOW LEARNING: Get sample audit logs
  app.get("/api/ai/shadow-samples", isAuthenticated, async (req: any, res) => {
    try {
      const count = parseInt(req.query.count as string) || 5;
      const samples = await shadowLearningLogger.getSamples(count);
      res.json(samples);
    } catch (error: any) {
      console.error("Error fetching shadow learning samples:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get personal learning examples
  app.get("/api/ai/examples", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;

      const examples = await storage.getAIPersonalExamples(userId, limit);
      res.json(examples);
    } catch (error: any) {
      console.error("Error fetching personal examples:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // PHASE C: PREDICTIVE INTELLIGENCE & PRO TRADER SUITE
  // ============================================================================

  // Mistake Prediction Engine - Analyze trade before execution
  app.post("/api/mistake-prediction/analyze", isAuthenticated, async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.symbol || !req.body.side || !req.body.quantity || !req.body.orderType) {
        return res.status(400).json({ error: 'Invalid request: symbol, side, quantity, and orderType are required' });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { mistakePredictionEngine } = await import('./services/mistakePredictionEngine');
      
      const prediction = await mistakePredictionEngine.analyzeTrade({
        userId,
        symbol: req.body.symbol,
        side: req.body.side,
        quantity: req.body.quantity,
        price: req.body.price,
        orderType: req.body.orderType,
        leverage: req.body.leverage,
      });
      
      res.json(prediction);
    } catch (error: any) {
      console.error("Error analyzing trade for mistakes:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record user response to mistake prediction
  app.post("/api/mistake-prediction/:id/response", isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      if (!req.body.response || typeof req.body.wasHeeded !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request: response and wasHeeded are required' });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { mistakePredictionEngine } = await import('./services/mistakePredictionEngine');
      
      await mistakePredictionEngine.recordUserResponse(
        req.params.id,
        userId,
        req.body.response,
        req.body.wasHeeded
      );
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording prediction response:", error);
      const statusCode = error.message.includes('access denied') ? 403 : 500;
      res.status(statusCode).json({ error: error.message });
    }
  });

  // Record trade outcome for mistake prediction
  app.post("/api/mistake-prediction/:id/outcome", isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      if (!req.body.tradeId || !req.body.outcome) {
        return res.status(400).json({ error: 'Invalid request: tradeId and outcome are required' });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { mistakePredictionEngine } = await import('./services/mistakePredictionEngine');
      
      await mistakePredictionEngine.recordOutcome(
        req.params.id,
        userId,
        req.body.tradeId,
        req.body.outcome,
        req.body.details
      );
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording prediction outcome:", error);
      const statusCode = error.message.includes('access denied') ? 403 : 500;
      res.status(statusCode).json({ error: error.message });
    }
  });

  // PHASE 5: Adaptive Refinement - Record full trade outcome with P&L
  app.post("/api/adaptive-refinement/outcome", isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      if (!req.body.predictionId || !req.body.tradeId || typeof req.body.actualPnL !== 'number') {
        return res.status(400).json({ 
          error: 'Invalid request: predictionId, tradeId, and actualPnL are required' 
        });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { adaptiveRefinement } = await import('./services/adaptiveRefinement');
      
      const result = await adaptiveRefinement.recordTradeOutcome({
        predictionId: req.body.predictionId,
        userId,
        tradeId: req.body.tradeId,
        actualPnL: req.body.actualPnL,
        expectedPnL: req.body.expectedPnL,
        userHeededWarning: req.body.userHeededWarning || false,
        finalDecision: req.body.finalDecision,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error recording adaptive refinement outcome:", error);
      const statusCode = error.message.includes('access denied') ? 403 : 500;
      res.status(statusCode).json({ error: error.message });
    }
  });

  // AI Trade Journal - Auto-log a trade
  app.post("/api/trade-journal/log", isAuthenticated, async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.tradeId || !req.body.tradeType || !req.body.symbol || !req.body.side || !req.body.entryPrice || !req.body.quantity) {
        return res.status(400).json({ error: 'Invalid request: tradeId, tradeType, symbol, side, entryPrice, and quantity are required' });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiTradeJournal } = await import('./services/aiTradeJournal');
      
      const entry = await aiTradeJournal.logTrade({
        userId,
        tradeId: req.body.tradeId,
        tradeType: req.body.tradeType,
        symbol: req.body.symbol,
        side: req.body.side,
        entryPrice: req.body.entryPrice,
        exitPrice: req.body.exitPrice,
        quantity: req.body.quantity,
        profitLoss: req.body.profitLoss,
        profitLossPercent: req.body.profitLossPercent,
      });
      
      res.json(entry);
    } catch (error: any) {
      console.error("Error logging trade to journal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's trade journal
  app.get("/api/trade-journal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiTradeJournal } = await import('./services/aiTradeJournal');
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const entries = await aiTradeJournal.getUserJournal(userId, limit);
      
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching trade journal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific journal entry
  app.get("/api/trade-journal/:id", isAuthenticated, async (req, res) => {
    try {
      const { aiTradeJournal } = await import('./services/aiTradeJournal');
      const entry = await aiTradeJournal.getEntryById(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Journal entry not found" });
      }
      
      res.json(entry);
    } catch (error: any) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add user notes to journal entry
  app.post("/api/trade-journal/:id/notes", isAuthenticated, async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.notes) {
        return res.status(400).json({ error: 'Invalid request: notes are required' });
      }
      
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { aiTradeJournal } = await import('./services/aiTradeJournal');
      
      await aiTradeJournal.addUserNotes(
        req.params.id,
        userId,
        req.body.notes,
        req.body.tags
      );
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error adding journal notes:", error);
      const statusCode = error.message.includes('access denied') ? 403 : 500;
      res.status(statusCode).json({ error: error.message });
    }
  });

  // ===== Phase 2: Dashboard Layout Persistence API Routes =====
  
  // Save or update dashboard layout
  app.post("/api/dashboard/layout", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const layout = await LayoutService.saveLayout(userId, req.body);
      res.json(layout);
    } catch (error: any) {
      console.error("Error saving dashboard layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all layouts for user
  app.get("/api/dashboard/layouts", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const layouts = await LayoutService.getUserLayouts(userId);
      res.json(layouts);
    } catch (error: any) {
      console.error("Error fetching layouts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get default layout for user
  app.get("/api/dashboard/layout/default", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const layout = await LayoutService.getDefaultLayout(userId);
      if (!layout) {
        return res.status(404).json({ error: "No default layout found" });
      }
      res.json(layout);
    } catch (error: any) {
      console.error("Error fetching default layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific layout by ID
  app.get("/api/dashboard/layout/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const layout = await LayoutService.getLayoutById(userId, req.params.id);
      if (!layout) {
        return res.status(404).json({ error: "Layout not found" });
      }
      res.json(layout);
    } catch (error: any) {
      console.error("Error fetching layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a layout
  app.delete("/api/dashboard/layout/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const deleted = await LayoutService.deleteLayout(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Layout not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set layout as default
  app.patch("/api/dashboard/layout/:id/default", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const layout = await LayoutService.setDefaultLayout(userId, req.params.id);
      if (!layout) {
        return res.status(404).json({ error: "Layout not found" });
      }
      res.json(layout);
    } catch (error: any) {
      console.error("Error setting default layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export layout as JSON
  app.get("/api/dashboard/layout/:id/export", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const jsonData = await LayoutService.exportLayout(userId, req.params.id);
      if (!jsonData) {
        return res.status(404).json({ error: "Layout not found" });
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="dashboard-layout.json"');
      res.send(jsonData);
    } catch (error: any) {
      console.error("Error exporting layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Import layout from JSON
  app.post("/api/dashboard/layout/import", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { LayoutService } = await import('./services/layoutService');
      
      const { jsonData, layoutName } = req.body;
      if (!jsonData) {
        return res.status(400).json({ error: "JSON data is required" });
      }
      
      const layout = await LayoutService.importLayout(userId, jsonData, layoutName);
      res.json(layout);
    } catch (error: any) {
      console.error("Error importing layout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Phase 2: Telemetry API Routes =====
  
  // Log a telemetry event
  app.post("/api/telemetry/event", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { TelemetryService } = await import('./services/telemetryService');
      
      const event = await TelemetryService.logEvent({
        userId,
        ...req.body,
      });
      res.json(event);
    } catch (error: any) {
      console.error("Error logging telemetry event:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user telemetry events
  app.get("/api/telemetry/events", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { TelemetryService } = await import('./services/telemetryService');
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const events = await TelemetryService.getUserEvents(userId, limit);
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching telemetry events:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get telemetry analytics/summary
  app.get("/api/telemetry/analytics", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { TelemetryService } = await import('./services/telemetryService');
      
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const analytics = await TelemetryService.getUserAnalytics(userId, days);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching telemetry analytics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Phase 2.5: Trading DNA & Adaptive Suggestions =====
  
  // Get Trading DNA profile
  app.get("/api/trading-dna/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { BehaviorMappingService } = await import('./services/behaviorMapping');
      
      const profile = await BehaviorMappingService.generateTradingDNAProfile(userId);
      res.json(profile);
    } catch (error: any) {
      console.error("Error generating Trading DNA profile:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get active suggestions
  app.get("/api/suggestions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { SuggestionGenerationService } = await import('./services/suggestionGeneration');
      
      const suggestions = await SuggestionGenerationService.getActiveSuggestions(userId);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate new suggestions
  app.post("/api/suggestions/generate", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { SuggestionGenerationService } = await import('./services/suggestionGeneration');
      
      // Generate suggestions based on current behavior
      const suggestions = await SuggestionGenerationService.generateSuggestions(userId);
      
      // Save to database
      await SuggestionGenerationService.saveSuggestions(userId, suggestions);
      
      // Return generated suggestions
      const saved = await SuggestionGenerationService.getActiveSuggestions(userId);
      res.json(saved);
    } catch (error: any) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Respond to suggestion (accept/dismiss/pin)
  app.post("/api/suggestions/:id/respond", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user.claims.sub;
      const { id } = req.params;
      const { responseType, feedback } = req.body;
      
      const { db } = await import('./db');
      const { adaptiveSuggestions, suggestionResponses } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { SuggestionActionExecutor } = await import('./services/suggestionActionExecutor');
      
      // Verify ownership
      const suggestion = await db
        .select()
        .from(adaptiveSuggestions)
        .where(
          and(
            eq(adaptiveSuggestions.id, id),
            eq(adaptiveSuggestions.userId, userId)
          )
        )
        .limit(1);
      
      if (!suggestion.length) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      const suggestionData = suggestion[0];
      
      // Execute action if accepted
      let actionResult = null;
      if (responseType === "accept") {
        actionResult = await SuggestionActionExecutor.executeAction(
          userId,
          suggestionData.actionType,
          suggestionData.actionData as Record<string, any>
        );
        
        if (!actionResult.success) {
          return res.status(500).json({ 
            error: "Failed to execute suggestion action",
            details: actionResult.error 
          });
        }
      }
      
      // Update suggestion status
      let newStatus = responseType === "accept" ? "accepted" : responseType === "dismiss" ? "dismissed" : "active";
      const isPinned = responseType === "pin";
      
      await db
        .update(adaptiveSuggestions)
        .set({
          status: newStatus,
          isPinned,
          respondedAt: new Date(),
        })
        .where(eq(adaptiveSuggestions.id, id));
      
      // Log response
      await db.insert(suggestionResponses).values({
        suggestionId: id,
        userId,
        responseType,
        feedback: feedback || null,
      });
      
      res.json({ 
        success: true, 
        status: newStatus, 
        isPinned,
        updatedLayout: actionResult?.updatedLayout // Return updated layout for client reconciliation
      });
    } catch (error: any) {
      console.error("Error responding to suggestion:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize default feature flags on startup
  (async () => {
    const { featureFlagsService } = await import('./services/featureFlags');
    await featureFlagsService.initializeDefaultFlags();
    console.log("[Phase A] Feature flags initialized");
  })();

  // 404 handler for undefined API routes (must be before Vite middleware)
  app.use("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "API endpoint not found",
      path: req.path,
      method: req.method 
    });
  });

  const httpServer = createServer(app);

  // WebSocket connection pooling configuration
  const MAX_WS_CONNECTIONS = 1000;
  const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
  
  interface WSClientMeta {
    isAlive: boolean;
    lastPing: number;
  }
  
  const wsClientMeta = new WeakMap<WebSocket, WSClientMeta>();
  let activeConnections = 0;

  // Set up WebSocket server for real-time price updates
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/ws/prices",
    maxPayload: 1024 * 1024, // 1MB max payload
  });
  
  wss.on("connection", (ws: WebSocket, req) => {
    // Connection pooling: reject if at capacity
    if (activeConnections >= MAX_WS_CONNECTIONS) {
      console.warn(`[WS] Connection rejected - pool at capacity (${activeConnections}/${MAX_WS_CONNECTIONS})`);
      ws.close(1008, "Server at capacity");
      return;
    }
    
    activeConnections++;
    console.log(`[WS] Client connected to price feed (${activeConnections} active, readyState: ${ws.readyState})`);
    
    // Initialize client metadata for heartbeat tracking
    wsClientMeta.set(ws, { isAlive: true, lastPing: Date.now() });
    
    // Function to send current prices (called on resync request)
    const sendInitialPrices = () => {
      try {
        console.log(`[WS] sendInitialPrices called, readyState: ${ws.readyState}`);
        const initialPrices = getCryptoPrices(); // FIX: Use getCryptoPrices (from cryptoPrices.ts with change/changePercent) instead of getAllMarketPrices (from paperTrading.ts)
        console.log(`[WS] Got ${initialPrices.length} prices from getCryptoPrices`);
        console.log(`[WS] DEBUG - First 3 prices:`, JSON.stringify(initialPrices.slice(0, 3), null, 2));
        
        if (ws.readyState === WebSocket.OPEN) {
          const priceData = {
            type: "prices",
            data: initialPrices
          };
          console.log(`[WS] Sending initial prices (${priceData.data.length} symbols)`);
          const jsonData = JSON.stringify(priceData);
          console.log(`[WS] JSON size: ${jsonData.length} bytes, first symbol:`, priceData.data[0]);
          ws.send(jsonData);
          console.log(`[WS] Initial prices sent successfully`);
        } else {
          console.log(`[WS] Cannot send initial prices - connection not open (state: ${ws.readyState})`);
        }
      } catch (error) {
        console.error("[WS] Error sending initial prices:", error);
      }
    };
    
    // Send initial prices immediately upon connection
    console.log("[WS] Sending initial prices to new client...");
    sendInitialPrices();
    
    // Handle incoming messages (ping, resync)
    ws.on("message", (data: Buffer) => {
      try {
        console.log(`[WS] Received message, length: ${data.length}, readyState: ${ws.readyState}`);
        const message = JSON.parse(data.toString());
        console.log(`[WS] Parsed message type: ${message.type}`);
        const meta = wsClientMeta.get(ws);
        
        if (message.type === "ping") {
          // Respond to client ping with pong
          console.log("[WS] Received ping from client");
          if (meta) {
            meta.isAlive = true;
            meta.lastPing = Date.now();
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } else if (message.type === "resync") {
          // Client requesting state resync
          console.log("[WS] Client requested state resync");
          sendInitialPrices();
        } else {
          console.log(`[WS] Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error("[WS] Error handling client message:", error);
        console.error("[WS] Raw data:", data.toString());
      }
    });
    
    // Handle pong responses (if we send pings to client)
    ws.on("pong", () => {
      const meta = wsClientMeta.get(ws);
      if (meta) {
        meta.isAlive = true;
        meta.lastPing = Date.now();
      }
    });
    
    ws.on("close", (code, reason) => {
      activeConnections--;
      wsClientMeta.delete(ws);
      const reasonStr = reason ? reason.toString() : '';
      console.log(`[WS] Client disconnected from price feed (${activeConnections} active, code: ${code}, reason: "${reasonStr}")`);
      
      // Debug: Log stack trace for abnormal closures
      if (code === 1006) {
        console.log(`[WS DEBUG] Abnormal closure detected - connection may have been terminated prematurely`);
      }
    });
    
    ws.on("error", (error) => {
      console.error("[WS] WebSocket error:", error);
      // Will trigger close event
    });
  });
  
  // Heartbeat mechanism - ping clients to detect stale connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const meta = wsClientMeta.get(ws);
      
      if (!meta) {
        // No metadata, terminate
        return ws.terminate();
      }
      
      if (meta.isAlive === false) {
        // Client didn't respond to last ping, terminate
        console.warn("[WS] Terminating unresponsive client");
        wsClientMeta.delete(ws);
        return ws.terminate();
      }
      
      // Mark as pending response and send ping
      meta.isAlive = false;
      ws.ping();
    });
  }, WS_HEARTBEAT_INTERVAL);
  
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
  
  console.log("[WS] WebSocket server configured on /ws/prices with pooling (max: " + MAX_WS_CONNECTIONS + ")");

  // Set up WebSocket server for UDF streaming (real-time OHLCV bars)
  const udfWss = new WebSocketServer({ server: httpServer, path: "/ws/udf/stream" });
  
  udfWss.on("connection", (ws: WebSocket) => {
    console.log("[UDF STREAM] Client connected");
    
    ws.on("message", (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "subscribe") {
          udfSubscribe(ws, message.symbol, message.resolution);
        } else if (message.type === "unsubscribe") {
          udfUnsubscribe(ws, message.symbol, message.resolution);
        }
      } catch (error) {
        console.error("[UDF STREAM] Error parsing message:", error);
      }
    });
    
    ws.on("close", () => {
      console.log("[UDF STREAM] Client disconnected");
      cleanupDisconnectedClients();
    });
    
    ws.on("error", (error) => {
      console.error("[UDF STREAM] WebSocket error:", error);
    });
  });
  
  // Initialize multi-source crypto price service (Coinbase WS → Kraken WS → CoinGecko)
  initializePriceService().then(() => {
    console.log('[Price Feed] ✅ Multi-source price service initialized');
    console.log('[Price Feed] 🚀 Broadcasting prices every 500ms (0.5 seconds)');
    
    // Broadcast prices to WebSocket clients every 500ms
    setInterval(() => {
      const priceUpdates = getCryptoPrices();
      
      if (priceUpdates.length > 0) {
        const message = JSON.stringify({
          type: "prices",
          data: priceUpdates
        });
        
        // Broadcast to price feed WebSocket clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
        
        // Feed ticks to UDF streaming service for bar bucketing
        priceUpdates.forEach(update => {
          processPriceTick(update.symbol, update.price, update.volume || 0);
        });
      }
    }, 500); // Broadcast every 500ms (0.5 seconds)
  }).catch((error) => {
    console.error('[Price Feed] ❌ Failed to initialize price service:', error);
  });
  
  console.log("[UDF STREAM] WebSocket server configured on /ws/udf/stream");
  
  // Cleanup disconnected clients every 30 seconds
  setInterval(() => {
    cleanupDisconnectedClients();
  }, 30000);

  return httpServer;
}
