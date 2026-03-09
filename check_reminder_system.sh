#!/bin/bash
# 🔍 Check Reminder System Health

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🔍 CHECKING REMINDER SYSTEM HEALTH"
echo "=========================================="
echo ""

# Test 1: SmartReminder Subagent
echo -n "1️⃣ SmartReminder Subagent (Port 5001): "
SR_RESPONSE=$(curl -s http://localhost:5001/api/v1/schedules/today 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$SR_RESPONSE" ]; then
    DAY=$(echo $SR_RESPONSE | grep -o '"day_name":"[^"]*"' | cut -d'"' -f4)
    COURSES=$(echo $SR_RESPONSE | grep -o '"courses":\[' | wc -l)
    echo -e "${GREEN}✅ RUNNING${NC} (Today: $DAY)"
else
    echo -e "${RED}❌ DOWN${NC}"
    echo "   Fix: cd ~/.openclaw/workspace/SmartReminder && ./start-subagent.sh"
fi

# Test 2: St4cker Backend
echo -n "2️⃣ St4cker Backend (VPS): "
ST_RESPONSE=$(curl -s http://103.127.134.173:3000/api/v1/schedules \
  -H "x-api-key: ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62" 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$ST_RESPONSE" ]; then
    COUNT=$(echo $ST_RESPONSE | grep -o '"count":[0-9]*' | cut -d: -f2)
    echo -e "${GREEN}✅ ONLINE${NC} ($COUNT schedules)"
else
    echo -e "${RED}❌ DOWN${NC}"
fi

# Test 3: Check Tomorrow (Monday) Schedule
echo -n "3️⃣ Monday Schedule Data: "
MONDAY_CHECK=$(curl -s http://103.127.134.173:3000/api/v1/schedules \
  -H "x-api-key: ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62" 2>/dev/null | \
  grep -o '"dayOfWeek":1')
if [ -n "$MONDAY_CHECK" ]; then
    echo -e "${GREEN}✅ AVAILABLE${NC}"
else
    echo -e "${RED}❌ NO DATA${NC}"
fi

# Test 4: Check Desktop App Data
echo -n "4️⃣ Desktop App SQLite: "
if [ -f "$HOME/.config/st4cker/st4cker.db" ] || [ -f "$HOME/.local/share/st4cker/st4cker.db" ]; then
    echo -e "${GREEN}✅ EXISTS${NC}"
else
    echo -e "${YELLOW}⚠️ NOT FOUND${NC} (Using different path)"
fi

echo ""
echo "=========================================="
echo "⏰ MONDAY REMINDER TIMELINE"
echo "=========================================="
echo "05:45 - Komputasi Bergerak (first class < 9:00)"
echo "09:00 - Praktikum Pemrograman Jaringan (90 min)"
echo ""
echo "⚠️  If no reminder at 05:45, check:"
echo "   1. curl http://localhost:5001/api/v1/reminders/next"
echo "   2. cat ~/.openclaw/workspace/SmartReminder/subagent.log"
echo ""
