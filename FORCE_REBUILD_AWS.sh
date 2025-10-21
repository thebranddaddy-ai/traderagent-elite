#!/bin/bash
# Force complete rebuild - ensures new code is used

set -e

echo "🔥 FORCING COMPLETE REBUILD"
echo "============================="
echo ""

cd ~/aiagent/TraderGenius/traderagent-elite

echo "1️⃣ Stopping all containers..."
docker-compose down

echo ""
echo "2️⃣ Removing old Docker images..."
docker rmi traderagent-elite-app 2>/dev/null || echo "No old image to remove"

echo ""
echo "3️⃣ Clearing node_modules and dist..."
rm -rf node_modules/.vite dist/public 2>/dev/null || true

echo ""
echo "4️⃣ Building fresh production bundle..."
npm run build

echo ""
echo "5️⃣ Rebuilding Docker containers from scratch..."
docker-compose build --no-cache app

echo ""
echo "6️⃣ Starting containers..."
docker-compose up -d

echo ""
echo "7️⃣ Waiting for startup (15 seconds)..."
sleep 15

echo ""
echo "8️⃣ Verifying NEW authentication config..."
docker-compose logs app | grep "\[Auth\]"

echo ""
echo "✅ COMPLETE REBUILD FINISHED!"
echo ""
echo "🔍 The Cookie secure line should now say: 'false (HTTP direct access)'"
echo "🌐 Try logging in at: http://3.112.235.253"
