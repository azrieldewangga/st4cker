#!/bin/bash
# Setup SmartReminder Integration for OpenClaw
# This script:
# 1. Installs required Python packages
# 2. Removes old standalone cron jobs
# 3. Provides instructions for OpenClaw integration

set -e

echo "=" 


echo "🔄 Removing old standalone cron jobs..."
# Remove old SmartReminder cron jobs (standalone mode)
(crontab -l 2>/dev/null | grep -v "SmartReminder v3" | \
 grep -v "localhost:5000/check" | \
 grep -v "localhost:5000/setup-now" | \
 grep -v "smart_reminder" | \
 grep -v "openclaw/workspace/SmartReminder") | crontab - 2>/dev/null || true

echo "✅ Old cron jobs removed"
echo ""

echo "=" 

echo "   - OpenClaw sends messages with full context"
echo "   - User replies are processed by OpenClaw AI"
echo ""

echo "📋 NEXT STEPS:"
echo ""
echo "1. Start SmartReminder Subagent Server:"
echo "   cd ~/.openclaw/workspace/SmartReminder"
echo "   ./start-subagent.sh"
echo ""
echo "2. Modify your OpenClaw main process to include:"
echo ""
echo "   from reminder_integration import start_reminder_system, get_reminder_messages"
echo ""
echo "   # On startup:"
echo "   await start_reminder_system()"
echo ""
echo "   # In your message loop:"
echo "   reminders = get_reminder_messages()"
echo "   for r in reminders:"
echo "       await send_whatsapp_message(r['message'])"
echo ""
echo "3. For handling user replies:"
echo ""
echo "   from reminder_integration import handle_reminder_reply, is_reminder_reply"
echo ""
echo "   if is_reminder_reply(user_message):"
echo "       result = await handle_reminder_reply(user_message, context)"
echo "       return result['response']"
echo ""
echo "=" 


echo "✅ Setup complete!"
