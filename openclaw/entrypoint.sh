#!/bin/bash

# Install openclaw if not already installed
if ! command -v openclaw &> /dev/null; then
    echo "Installing OpenClaw..."
    npm install -g openclaw@2026.3.7 &
    OPENCLAW_PID=$!
    
    # Show progress
    while kill -0 $OPENCLAW_PID 2>/dev/null; do
        echo -n "."
        sleep 10
    done
    wait $OPENCLAW_PID
    echo " OpenClaw installed!"
fi

# Start the server
echo "Starting OpenClaw server..."
exec uvicorn st4cker_skill:app --host 0.0.0.0 --port 8000 --reload
