import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startPriceMonitoring } from "./services/priceMonitoring";
import { alertMonitoringService } from "./services/alertMonitoring";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const isProduction = process.env.NODE_ENV === "production";
    
    console.log(`Starting server in ${isProduction ? 'production' : 'development'} mode`);
    
    if (!isProduction) {
      const { setupVite, log } = await import("./vite");
      log(`Starting server in development mode`, "server");
      await setupVite(app, server);
    } else {
      const { serveStatic } = await import("./static");
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(`serving on port ${port}`);
      
      // Start automatic stop-loss/take-profit monitoring for demo user
      startPriceMonitoring("demo-user-123", 5000);
      console.log(`Price monitoring started - checking SL/TP every 5 seconds`);
      
      // Start alert monitoring for price alerts
      alertMonitoringService.startMonitoring(10000);
      console.log(`Alert monitoring started - checking price alerts every 10 seconds`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
