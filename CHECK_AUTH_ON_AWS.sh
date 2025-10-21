#!/bin/bash
# Check authentication status on AWS server
# Run this DIRECTLY on your AWS server

echo "🔍 Checking Authentication Status..."
echo ""

cd ~/aiagent/TraderGenius/traderagent-elite

echo "1️⃣ Checking auth code in server/simpleAuth.ts..."
grep -A 2 "secureCookie = " server/simpleAuth.ts

echo ""
echo "2️⃣ Checking Docker container logs for authentication..."
docker-compose logs app 2>&1 | grep "\[Auth\]" | tail -10

echo ""
echo "3️⃣ Testing login endpoint..."
curl -v http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  2>&1 | grep -i "set-cookie"

echo ""
echo "✅ Check complete!"
