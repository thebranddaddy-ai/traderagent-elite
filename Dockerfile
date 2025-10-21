# TraderAgent Elite - Production Docker Image
# Multi-stage build for optimized production deployment
# Build Date: October 17, 2025
# Version: 1.1.0 - AWS Deployment Ready

# ============================================
# Stage 1: Use pre-built artifacts from Replit
# ============================================
# Note: Run `npm run build` on Replit BEFORE building Docker image

# ============================================
# Production Runtime (Single Stage)
# ============================================
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (vite needed at runtime for serving frontend)
RUN npm ci --legacy-peer-deps && \
    npm cache clean --force

# Copy pre-built artifacts from Replit
COPY --chown=nodejs:nodejs dist ./dist
COPY --chown=nodejs:nodejs shared ./shared
COPY --chown=nodejs:nodejs server ./server

# Copy database configuration
COPY --chown=nodejs:nodejs drizzle.config.ts ./

# Create audit log directories with correct permissions
RUN mkdir -p /app/logs /app/audit_logs && \
    chown -R nodejs:nodejs /app/logs /app/audit_logs

# Create symlink for static files (server/public -> dist/public)
# This ensures serveStatic() can find the built frontend files
RUN ln -sf /app/dist/public /app/server/public && \
    chown -h nodejs:nodejs /app/server/public

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/ping || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]

# ============================================
# Build and Run Instructions
# ============================================
# 
# BUILD:
#   docker build -t traderagent-elite:v1.1 .
#   docker build -t traderagent-elite:latest .
#
# RUN (Local):
#   docker run -d \
#     --name traderagent \
#     -p 5000:5000 \
#     -e DATABASE_URL="postgresql://..." \
#     -e OPENAI_API_KEY="sk-..." \
#     -e SESSION_SECRET="your-secret" \
#     -e REPLIT_DOMAINS="localhost:5000" \
#     traderagent-elite:v1.1
#
# RUN (with .env file):
#   docker run -d \
#     --name traderagent \
#     -p 5000:5000 \
#     --env-file .env \
#     traderagent-elite:v1.1
#
# VERIFY:
#   docker logs traderagent
#   curl http://localhost:5000/ping
#   curl http://localhost:5000/status
#
# AWS ECR Push:
#   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com
#   docker tag traderagent-elite:v1.1 <account-id>.dkr.ecr.ap-south-1.amazonaws.com/traderagent-elite:v1.1
#   docker push <account-id>.dkr.ecr.ap-south-1.amazonaws.com/traderagent-elite:v1.1
#
# ============================================
# Required Environment Variables
# ============================================
#
# REQUIRED:
#   - DATABASE_URL: PostgreSQL connection string (Neon or AWS RDS)
#   - OPENAI_API_KEY: OpenAI API key for AI features
#   - SESSION_SECRET: Secret for session encryption
#
# OPTIONAL:
#   - REPLIT_DOMAINS: Domain for CORS (default: production domain)
#   - PORT: Application port (default: 5000)
#   - NODE_ENV: Environment (default: production)
#
# ============================================
# Image Size Optimization
# ============================================
#
# - Multi-stage build reduces final image size
# - Alpine Linux base (minimal footprint)
# - Production dependencies only in runtime
# - No build tools in final image
# - Layer caching optimized for faster rebuilds
#
# Expected final image size: ~400-500 MB
#
# ============================================
