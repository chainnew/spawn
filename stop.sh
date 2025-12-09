#!/bin/bash
# Stop all Spawn services

echo "🛑 Stopping Spawn Platform"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill processes on our ports
lsof -ti:3000 -ti:3001 -ti:3080 2>/dev/null | xargs -r kill -9 2>/dev/null || true

# Kill by name as backup
pkill -f "spawn-api" 2>/dev/null || true
pkill -f "terminal-app" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

sleep 1

# Verify
if lsof -i:3000 -i:3001 -i:3080 >/dev/null 2>&1; then
    echo "⚠️  Some processes may still be running"
    lsof -i:3000 -i:3001 -i:3080 2>/dev/null
else
    echo "✅ All services stopped"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
