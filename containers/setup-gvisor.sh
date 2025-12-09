#!/bin/bash
# gVisor Setup Script for Spawn Agent
# This installs runsc (gVisor) for secure container sandboxing
# Same runtime used by Claude Desktop for code execution
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🔒 gVisor (runsc) Installation                           ║"
echo "║  Secure container sandbox runtime                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Check if already installed
if command -v runsc &> /dev/null; then
    echo "✅ runsc already installed: $(runsc --version)"
    exit 0
fi

# Install prerequisites
echo "[1/4] Installing prerequisites..."
sudo apt-get update
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg

# Add gVisor repository
echo "[2/4] Adding gVisor repository..."
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null

# Install runsc
echo "[3/4] Installing runsc..."
sudo apt-get update
sudo apt-get install -y runsc

# Configure for Docker (if installed)
if command -v docker &> /dev/null; then
    echo "[4/4] Configuring Docker runtime..."
    sudo runsc install
    sudo systemctl reload docker
    echo "✅ Docker configured with runsc runtime"

    # Test it
    echo ""
    echo "Testing gVisor sandbox..."
    docker run --rm --runtime=runsc hello-world && echo "✅ gVisor test passed!"
fi

# Configure for Podman (if installed)
if command -v podman &> /dev/null; then
    echo "[4/4] Configuring Podman runtime..."

    # Create Podman runtime configuration
    mkdir -p ~/.config/containers
    cat >> ~/.config/containers/containers.conf << 'EOF'
[engine]
runtime = "runsc"

[engine.runtimes]
runsc = ["/usr/bin/runsc"]
EOF

    echo "✅ Podman configured with runsc runtime"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ gVisor installed successfully!                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "runsc version: $(runsc --version)"
echo ""
echo "Usage:"
echo "  Docker:  docker run --runtime=runsc <image>"
echo "  Podman:  podman run --runtime=runsc <image>"
echo ""
echo "For spawn agent with gVisor:"
echo "  ./start.sh up   (uses runsc by default when available)"
