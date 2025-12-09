#!/bin/bash
# Spawn Sandbox Setup - LOCAL MODE
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         🐧 Spawn Sandbox Setup (Local Mode)               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check for node
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install npm dependencies
echo "📦 Installing Node dependencies..."
npm install

# Create workspace
mkdir -p ./public/workspace
echo "✅ Created workspace at ./public/workspace"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << 'ENVFILE'
PORT=3080
CONTAINER_NAME=
WORKSPACE_PATH=./public/workspace
OPENROUTER_API_KEY=
OPENROUTER_REFERER=spawn-sandbox
OPENROUTER_TITLE=spawn
#XAI_API_KEY=
ENVFILE
fi

# Prompt for API key
echo ""
read -p "Enter your OpenRouter API key (or press Enter to skip): " API_KEY
if [ -n "$API_KEY" ]; then
    sed -i "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$API_KEY|" .env
    echo "✅ API key saved"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup complete!                                       ║"
echo "║                                                           ║"
echo "║  Start: npm start                                         ║"
echo "║  Open:  http://localhost:3080                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
