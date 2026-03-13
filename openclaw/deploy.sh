#!/bin/bash
# OpenClaw Redeploy Script
# Usage: ./deploy.sh

set -e

echo "=========================================="
echo "🚀 OpenClaw Redeploy Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in correct directory
if [ ! -f "st4cker_skill.py" ]; then
    echo -e "${RED}❌ Error: Must run from openclaw directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Step 1: Building Docker image...${NC}"
docker build -t st4cker-openclaw:latest .

echo ""
echo -e "${YELLOW}🛑 Step 2: Stopping old container...${NC}"
docker stop openclaw 2>/dev/null || true
docker rm openclaw 2>/dev/null || true

echo ""
echo -e "${YELLOW}▶️  Step 3: Starting new container...${NC}"
docker run -d \
    --name openclaw \
    --network st4cker-net \
    -p 127.0.0.1:8001:8000 \
    -e TZ=Asia/Jakarta \
    -e ST4CKER_API_URL=http://st4cker-bot:3000 \
    -e ST4CKER_API_KEY=ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62 \
    -e OPENCLAW_API_KEY=st4cker_openclaw_secure_key_2024 \
    -e MOONSHOT_API_KEY="${MOONSHOT_API_KEY:-}" \
    -e MOONSHOT_BASE_URL="${MOONSHOT_BASE_URL:-https://api.moonshot.cn/v1}" \
    --restart always \
    st4cker-openclaw:latest

echo ""
echo -e "${YELLOW}⏳ Step 4: Waiting for service to start...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}🧪 Step 5: Health check...${NC}"
if curl -s http://localhost:8001/health | grep -q "ok"; then
    echo -e "${GREEN}✅ OpenClaw is healthy!${NC}"
else
    echo -e "${RED}⚠️  Health check failed, checking logs...${NC}"
    docker logs openclaw --tail 20
    exit 1
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ Redeploy complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "📊 Status:"
docker ps --filter "name=openclaw" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "📝 Logs (last 10 lines):"
docker logs openclaw --tail 10 2>/dev/null || echo "Container logs not available yet"
echo ""
echo "💡 Quick commands:"
echo "  - View logs: docker logs -f openclaw"
echo "  - Restart: docker restart openclaw"
echo "  - Stop: docker stop openclaw"
echo ""
