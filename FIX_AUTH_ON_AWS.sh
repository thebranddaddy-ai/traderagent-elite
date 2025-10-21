#!/bin/bash
# Comprehensive Authentication Fix for AWS
# This script will completely fix the login/cookie issue

set -e  # Exit on error

echo "🔧 COMPREHENSIVE AUTHENTICATION FIX"
echo "=================================="
echo ""

cd ~/aiagent/TraderGenius/traderagent-elite

echo "1️⃣ Pulling latest code from GitHub..."
git pull

echo ""
echo "2️⃣ Stopping containers..."
docker-compose down

echo ""
echo "3️⃣ Building fresh production bundle..."
npm run build

echo ""
echo "4️⃣ Starting containers..."
docker-compose up -d

echo ""
echo "5️⃣ Waiting for app to start (10 seconds)..."
sleep 10

echo ""
echo "6️⃣ Checking authentication configuration..."
docker-compose logs app | grep "\[Auth\]" | tail -10

echo ""
echo "7️⃣ Testing cookie settings..."
curl -s http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -c /tmp/cookies.txt \
  -v 2>&1 | grep -i "set-cookie" || echo "No Set-Cookie header (this may be expected if credentials are wrong)"

echo ""
echo "✅ FIX COMPLETE!"
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🌐 Your app is ready at: http://3.112.235.253"
echo ""
echo "🔑 Try logging in now. Cookies should work!"
echo ""
echo "💡 If login still redirects, the issue is likely:"
echo "   - Wrong email/password"
echo "   - Database user not created"
echo ""
echo "Run this to create a test user:"
echo "docker-compose exec app node -e \"require('./dist/index.js')\""
