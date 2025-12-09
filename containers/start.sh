#!/bin/bash
# Spawn Agent Stack - Quick Start Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🚀 Spawn Agent Container Stack                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Check for podman
if ! command -v podman &> /dev/null; then
    echo "❌ Podman not found. Install with:"
    echo "   sudo apt-get update && sudo apt-get install -y podman podman-compose"
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "📝 Edit containers/.env to add your API key"
    echo ""
fi

# Parse arguments
ACTION="${1:-up}"

case "$ACTION" in
    up|start)
        echo "🏗️  Building and starting containers..."
        podman-compose up -d --build
        echo ""
        echo "✅ Stack is running!"
        echo "   Agent UI: http://localhost:3080"
        echo "   Health:   http://localhost:3080/health"
        echo ""
        echo "📊 Container status:"
        podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    down|stop)
        echo "🛑 Stopping containers..."
        podman-compose down
        echo "✅ Stack stopped"
        ;;
    logs)
        podman-compose logs -f "${2:-agent}"
        ;;
    shell)
        echo "🐚 Opening shell in agent container..."
        podman exec -it spawn-agent /bin/bash
        ;;
    build)
        echo "🔨 Rebuilding containers..."
        podman-compose build --no-cache
        echo "✅ Build complete"
        ;;
    ps|status)
        echo "📊 Container status:"
        podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    clean)
        echo "🧹 Cleaning up..."
        podman-compose down -v
        podman system prune -f
        echo "✅ Cleanup complete"
        ;;
    *)
        echo "Usage: $0 {up|down|logs|shell|build|status|clean}"
        echo ""
        echo "Commands:"
        echo "  up      - Start the stack"
        echo "  down    - Stop the stack"
        echo "  logs    - View logs (default: agent)"
        echo "  shell   - Open bash in agent container"
        echo "  build   - Rebuild containers"
        echo "  status  - Show container status"
        echo "  clean   - Remove all containers and volumes"
        exit 1
        ;;
esac
