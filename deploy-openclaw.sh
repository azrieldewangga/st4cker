#!/bin/bash
# Deploy OpenClaw to VPS
# Copy this script to your VPS and run it

set -e

echo "🚀 Deploying OpenClaw..."

# Go to project directory
cd ~/projects/st4cker || exit 1

# Pull latest changes
echo "📦 Pulling latest changes..."
git pull origin main

# Ensure GEMINI_API_KEY is set in openclaw/.env
if ! grep -q "GEMINI_API_KEY" openclaw/.env 2>/dev/null; then
    echo "⚠️  GEMINI_API_KEY not found in openclaw/.env"
    echo "Adding from telegram-bot/.env..."
    GEMINI_KEY=$(grep GEMINI_API_KEY ../telegram-bot/.env 2>/dev/null | cut -d= -f2 || echo "")
    if [ -z "$GEMINI_KEY" ]; then
        echo "❌ GEMINI_API_KEY not found in telegram-bot/.env either"
        echo "Please add it manually to openclaw/.env"
        exit 1
    fi
    echo "GEMINI_API_KEY=$GEMINI_KEY" >> openclaw/.env
    echo "✅ GEMINI_API_KEY added"
fi

# Rebuild and restart OpenClaw container
echo "🐳 Rebuilding OpenClaw container (no cache)..."
docker-compose build --no-cache openclaw

echo "🔄 Restarting OpenClaw..."
docker-compose up -d openclaw

# Wait for health check
echo "⏳ Waiting for health check..."
sleep 5

# Check if running
if docker-compose ps openclaw | grep -q "Up"; then
    echo "✅ OpenClaw is running!"
    echo ""
    echo "Health check:"
    curl -s http://localhost:8001/health || echo "Health endpoint not available (this is OK)"
    echo ""
    echo "Logs:"
    docker-compose logs --tail=20 openclaw
else
    echo "❌ OpenClaw failed to start"
    echo "Checking logs..."
    docker-compose logs openclaw
    exit 1
fi

echo ""
echo "🎉 Deploy complete!"
echo "OpenClaw is now running on http://localhost:8001"
