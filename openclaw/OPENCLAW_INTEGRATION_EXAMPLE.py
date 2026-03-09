#!/usr/bin/env python3
"""
Example: How to integrate SmartReminder with OpenClaw Main Process

This shows how OpenClaw should be modified to use the new SmartReminder system.
Copy relevant parts to your OpenClaw main process.
"""

import asyncio
import logging
from typing import Dict, Any

# Import the SmartReminder system
from reminder_integration import (
    reminder_system,
    start_reminder_system,
    stop_reminder_system,
    get_reminder_messages,
    handle_reminder_reply,
    is_reminder_reply
)

logger = logging.getLogger(__name__)


# ============================================================================
# 1. ON OPENC LAW STARTUP - Start the scheduler
# ============================================================================

async def on_openclaw_startup():
    """
    Call this when OpenClaw starts up.
    This starts the internal timer loop (no cron needed!)
    """
    logger.info("🚀 OpenClaw Starting...")
    
    # Start SmartReminder system with internal timer
    await start_reminder_system()
    
    # Start the periodic check loop for outgoing messages
    asyncio.create_task(_reminder_message_loop())
    
    logger.info("✅ OpenClaw Ready with SmartReminder")


# ============================================================================
# 2. BACKGROUND LOOP - Check for reminders to send
# ============================================================================

async def _reminder_message_loop():
    """
    Background loop that checks for reminder messages and sends them.
    This runs continuously alongside OpenClaw.
    """
    while True:
        try:
            # Get any pending reminder messages
            messages = get_reminder_messages()
            
            for msg in messages:
                # Send via OpenClaw's message sender
                await send_openclaw_message(
                    channel="whatsapp",
                    target=msg.get('target', '+6281311417727'),
                    message=msg['message']
                )
                
                logger.info(f"📤 Reminder sent: {msg['course']}")
            
        except Exception as e:
            logger.error(f"Error in reminder message loop: {e}")
        
        # Check every 5 seconds
        await asyncio.sleep(5)


# ============================================================================
# 3. HANDLE INCOMING USER MESSAGES
# ============================================================================

async def handle_incoming_message(
    user_message: str,
    sender: str,
    context: Dict[str, Any]
) -> str:
    """
    Call this when OpenClaw receives a message from user.
    
    Returns: Response message to send back
    """
    
    # Check if this is a reply to a reminder
    if is_reminder_reply(user_message):
        logger.info(f"📝 Attendance reply detected: {user_message}")
        
        # Handle with SmartReminder AI NLU
        result = await handle_reminder_reply(user_message, context)
        
        # Log the detected intent
        logger.info(f"🧠 Intent: {result['intent']} (confidence: {result['confidence']:.2f})")
        
        # Return the AI-generated response
        return result['response']
    
    # Otherwise, process as normal OpenClaw message
    return await process_normal_message(user_message, sender, context)


# ============================================================================
# 4. HELPER FUNCTIONS (Stub implementations)
# ============================================================================

async def send_openclaw_message(channel: str, target: str, message: str):
    """
    Stub: Replace with actual OpenClaw message sending
    Example: npx openclaw message send --channel whatsapp --target ...
    """
    import subprocess
    
    try:
        cmd = [
            "npx", "openclaw", "message", "send",
            "--channel", channel,
            "--target", target,
            "--message", message
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            logger.error(f"Failed to send: {result.stderr}")
        else:
            logger.info(f"✅ Message sent via OpenClaw")
            
    except Exception as e:
        logger.error(f"Error sending message: {e}")


async def process_normal_message(
    user_message: str, 
    sender: str, 
    context: Dict[str, Any]
) -> str:
    """Stub: Replace with normal OpenClaw message processing"""
    # Your existing OpenClaw logic here
    return "OK"


# ============================================================================
# 5. MAIN ENTRY POINT (For testing)
# ============================================================================

async def main():
    """Test the integration"""
    
    # Start OpenClaw with SmartReminder
    await on_openclaw_startup()
    
    try:
        # Keep running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        await stop_reminder_system()


if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run
    asyncio.run(main())
