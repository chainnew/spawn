#!/bin/bash
# Start all Spawn services

set -e

echo "🚀 Starting Spawn Platform"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kill ALL existing spawn processes first
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 -ti:3001 -ti:3080 2>/dev/null | xargs -r kill -9 2>/dev/null || true
pkill -9 -f "spawn-api" 2>/dev/null || true
pkill -9 -f "terminal-app" 2>/dev/null || true
pkill -9 -f "node.*server.js" 2>/dev/null || true
sleep 1

# Verify ports are free
if lsof -i:3000 -i:3001 -i:3080 >/dev/null 2>&1; then
    echo "⚠️  Warning: Some ports still in use, waiting..."
    sleep 2
    lsof -ti:3000 -ti:3001 -ti:3080 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi

# Build first (optional, comment out for faster startup)
if [ "$1" != "--no-build" ]; then
    echo "🔨 Building Rust services..."
    cargo build -p spawn-api -p terminal-app --release 2>&1 | tail -5
fi

# Start services in background
echo ""
echo -e "${BLUE}📟 Starting terminal-app on port 3001...${NC}"
cargo run -p terminal-app --release 2>&1 &
TERMINAL_PID=$!

sleep 2

echo -e "${BLUE}🌐 Starting spawn-api on port 3000...${NC}"
cargo run -p spawn-api --release 2>&1 &
API_PID=$!

sleep 2

echo -e "${BLUE}🐧 Starting sandbox-server on port 3080...${NC}"
cd sandbox-server && node server.js 2>&1 &
SANDBOX_PID=$!
cd ..

sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "  🌐 spawn-api:      http://localhost:3000"
echo "  📟 terminal-app:   http://localhost:3001"
echo "  🐧 sandbox-server: http://localhost:3080"
echo ""
echo "  📊 Control Panel:  http://localhost:3000/admin"
echo "  💬 Sandbox Chat:   http://localhost:3080"
echo ""
echo "Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for any process to exit
wait
