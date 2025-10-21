#!/bin/bash
# Cleanup disk space and rebuild
# Fixes "no space left on device" error

set -e

echo "🧹 CLEANING UP DISK SPACE"
echo "=========================="
echo ""

cd ~/aiagent/TraderGenius/traderagent-elite

echo "📊 Current disk usage:"
df -h /

echo ""
echo "1️⃣ Stopping containers..."
docker-compose down

echo ""
echo "2️⃣ Removing ALL unused Docker data (images, containers, cache)..."
docker system prune -a -f --volumes

echo ""
echo "3️⃣ Cleaning up old build artifacts..."
rm -rf dist/ .vite/ node_modules/.cache/ 2>/dev/null || true

echo ""
echo "📊 Disk usage after cleanup:"
df -h /

echo ""
echo "4️⃣ Pulling latest code..."
git pull

echo ""
echo "5️⃣ Building production bundle (on host, not in Docker)..."
npm run build

echo ""
echo "6️⃣ Building Docker image (lightweight - just copying built files)..."
docker-compose build app

echo ""
echo "7️⃣ Starting containers..."
docker-compose up -d

echo ""
echo "8️⃣ Waiting for startup (15 seconds)..."
sleep 15

echo ""
echo "9️⃣ Checking authentication configuration..."
docker-compose logs app | grep "\[Auth\]"

echo ""
echo "✅ CLEANUP AND REBUILD COMPLETE!"
echo ""
echo "📊 Final disk usage:"
df -h /

echo ""
echo "🌐 Your app is ready at: http://3.112.235.253"
echo ""
echo "Look for: [Auth] Cookie secure: false (HTTP direct access)"
