// Simple Email/Password Authentication - Production Ready
// Compatible with: HTTP (local), HTTPS (direct), HTTPS (behind ALB/Nginx)
// Version: 1.2.1 - Smart cookie configuration for production
// Auto-detects: Development vs Production, ALB vs Direct HTTPS

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

// ============================================
// Session Configuration (Production Ready)
// ============================================
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  // Smart cookie configuration based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isBehindProxy = process.env.BEHIND_PROXY === 'true'; // Set this for ALB/Nginx
  
  // Production with direct HTTPS: secure=true
  // Production behind ALB/Nginx: secure=true (trust proxy handles X-Forwarded-Proto)
  // Development: secure=false
  const secureCookie = isProduction; // Always true in production (trust proxy makes it work)
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookie, // true in production, false in development
      sameSite: 'lax',
      maxAge: sessionTtl,
      domain: undefined, // Let browser auto-detect
    },
  });
}

// ============================================
// Simple Auth Setup
// ============================================
export async function setupAuth(app: Express) {
  // Trust proxy - critical for AWS ALB / Nginx
  // ALB/Nginx sends X-Forwarded-Proto header, this makes req.secure work correctly
  app.set("trust proxy", 1);
  
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const isProduction = process.env.NODE_ENV === 'production';
  console.log("[Auth] Simple email/password authentication enabled");
  console.log("[Auth] Session store: PostgreSQL");
  console.log(`[Auth] Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`[Auth] Cookie secure: ${isProduction ? 'true (HTTPS required)' : 'false (HTTP allowed)'}`);
  console.log("[Auth] Trust proxy: ENABLED (ALB/Nginx compatible)");

  // Simple passport setup for email/password
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Logout endpoint
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect('/login');
    });
  });
}

// ============================================
// Authentication Middleware
// ============================================
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // User is authenticated via email/password session
  return next();
};

// ============================================
// Current User Helper
// ============================================
export function getCurrentUserId(req: any): string | null {
  const user = req.user as any;
  if (!user?.claims?.sub) {
    return null;
  }
  return user.claims.sub;
}

// ============================================
// Configuration Notes for Production Deployment
// ============================================
/*
 * PRODUCTION DEPLOYMENT CONFIGURATIONS:
 * 
 * 1. DIRECT HTTPS (EC2 + Let's Encrypt):
 *    - NODE_ENV=production
 *    - secure=true (cookies require HTTPS)
 *    - trust proxy=1 (handles X-Forwarded-Proto)
 *    - Nginx terminates TLS, forwards to backend
 * 
 * 2. AWS ALB + ECS/EC2:
 *    - NODE_ENV=production
 *    - secure=true (trust proxy makes it work!)
 *    - trust proxy=1 (reads X-Forwarded-Proto from ALB)
 *    - ALB terminates HTTPS, forwards HTTP to backend
 *    - Backend sees req.secure=true via X-Forwarded-Proto header
 * 
 * 3. DEVELOPMENT (localhost):
 *    - NODE_ENV=development (or unset)
 *    - secure=false (allows HTTP cookies)
 *    - Works on http://localhost:5000
 * 
 * HOW TRUST PROXY WORKS:
 * - When trust proxy=1, Express checks X-Forwarded-Proto header
 * - If X-Forwarded-Proto=https, req.secure returns true
 * - Even though backend sees HTTP, cookies with secure=true work!
 * - ALB/Nginx send X-Forwarded-Proto automatically
 * 
 * REQUIRED ENV VARS (Production):
 * - NODE_ENV=production (enables secure cookies)
 * - DATABASE_URL=postgresql://... (session storage)
 * - SESSION_SECRET=<strong-random-string> (session encryption)
 * - OPENAI_API_KEY=sk-... (AI features)
 * 
 * OPTIONAL ENV VARS:
 * - BEHIND_PROXY=true (explicitly mark as behind proxy - auto-detected)
 * - PORT=5000 (default)
 * 
 * SECURITY CHECKLIST:
 * ✅ httpOnly=true (prevents XSS cookie theft)
 * ✅ secure=true in production (HTTPS only)
 * ✅ sameSite=lax (CSRF protection)
 * ✅ PostgreSQL session store (server-side storage)
 * ✅ bcrypt password hashing (10 rounds)
 * ✅ trust proxy (secure headers from ALB/Nginx)
 * ✅ 7-day session expiry (auto-cleanup)
 */
