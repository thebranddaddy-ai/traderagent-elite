#!/bin/bash
# TraderAgent Elite - Auto Update Script
# Run this on your AWS server to update the app

echo "🚀 Updating TraderAgent Elite..."
echo ""

cd ~/aiagent/TraderGenius/traderagent-elite

echo "📥 Pulling latest code from GitHub..."
git pull

echo "🔨 Building production bundle..."
npm run build

echo "♻️  Restarting application..."
docker-compose restart app

echo ""
echo "✅ Update complete!"
echo "🌐 Your app is ready at: http://3.112.235.253"
echo ""
echo "Login should now work properly over HTTP!"
