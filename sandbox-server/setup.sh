#!/bin/bash
# Spawn Sandbox Setup Script
# Run this on your Kali VM to get everything running

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         🐧 Spawn Sandbox Setup                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check for podman
if ! command -v podman &> /dev/null; then
    echo "📦 Installing Podman..."
    sudo apt-get update && sudo apt-get install -y podman
fi

# Check for node
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create container if it doesn't exist
CONTAINER_NAME="spawn-sandbox"
if ! podman container exists $CONTAINER_NAME 2>/dev/null; then
    echo "🐳 Creating Podman container..."
    podman run -d \
        --name $CONTAINER_NAME \
        -v spawn-workspace:/workspace \
        ubuntu:22.04 \
        sleep infinity
    
    echo "📦 Installing tools in container..."
    podman exec $CONTAINER_NAME apt-get update
    podman exec $CONTAINER_NAME apt-get install -y git curl nodejs npm python3 python3-pip
    podman exec $CONTAINER_NAME mkdir -p /workspace
else
    echo "✅ Container '$CONTAINER_NAME' already exists"
    podman start $CONTAINER_NAME 2>/dev/null || true
fi

# Install npm dependencies
echo "📦 Installing Node dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  Edit .env to add your API keys:"
    echo "    OPENROUTER_API_KEY=sk-or-v1-xxx"
    echo "    XAI_API_KEY=xai-xxx"
    echo ""
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup complete!                                       ║"
echo "║                                                           ║"
echo "║  Start the server:                                        ║"
echo "║    npm start                                              ║"
echo "║                                                           ║"
echo "║  Then open:                                               ║"
echo "║    http://localhost:3080                                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
