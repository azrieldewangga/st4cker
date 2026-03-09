#!/bin/bash
# Rebuild OpenClaw container with SmartReminder integration
# WARNING: This will restart the OpenClaw service

set -e

echo "=============================================="
echo "  REBUILD OPENC LAW CONTAINER"
echo "=============================================="
echo ""
echo "This will:"
echo "1. Stop current OpenClaw container"
echo "2. Rebuild with SmartReminder integration"
echo "3. Start new container"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

cd ~/projects/st4cker

echo ""
echo "Step 1: Stopping current OpenClaw container..."
docker-compose stop openclaw

echo ""
echo "Step 2: Rebuilding container..."
docker-compose build openclaw

echo ""
echo "Step 3: Starting new container..."
docker-compose up -d openclaw

echo ""
echo "Step 4: Waiting for healthcheck..."
sleep 5

for i in {1..10}; do
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo "✅ OpenClaw is healthy!"
        break
    fi
    echo "  Waiting... ($i/10)"
    sleep 2
done

echo ""
echo "Step 5: Testing SmartReminder endpoint..."
if curl -s http://localhost:8001/api/v1/smart-reminder/poll > /dev/null 2>&1; then
    echo "✅ SmartReminder endpoint is working!"
else
    echo "⚠️  SmartReminder endpoint not found (may need container restart)"
fi

echo ""
echo "=============================================="
echo "  REBUILD COMPLETE"
echo "=============================================="
echo ""
echo "Check logs: docker logs -f openclaw"
