#!/bin/bash
# Setup script for ARCHITECT workspace
# Run with: sudo ./setup-workspace.sh

set -e

echo "=== Setting up ARCHITECT workspace ==="

# Create architect user if doesn't exist
if ! id architect &>/dev/null; then
    echo "[1/6] Creating architect user..."
    useradd -m -s /bin/bash -d /home/architect architect
else
    echo "[1/6] architect user already exists"
fi

# Create workspace structure
echo "[2/6] Creating workspace directories..."
mkdir -p /home/architect/workspace
mkdir -p /home/architect/.local/bin
mkdir -p /home/architect/.cache
mkdir -p /home/architect/.npm
mkdir -p /home/architect/.pnpm-store

# Set ownership
chown -R architect:architect /home/architect

# Install system dependencies
echo "[3/6] Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
    python3 python3-pip python3-venv \
    nodejs npm \
    git curl wget \
    build-essential \
    ripgrep fd-find \
    jq tree \
    sqlite3 \
    2>/dev/null || true

# Install pnpm globally
echo "[4/6] Installing pnpm..."
npm install -g pnpm 2>/dev/null || true

# Install common Python packages for architect
echo "[5/6] Setting up Python environment..."
sudo -u architect bash -c '
    cd /home/architect
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install pygame numpy pandas matplotlib requests flask fastapi uvicorn
' 2>/dev/null || true

# Setup Node environment
echo "[6/6] Setting up Node environment..."
sudo -u architect bash -c '
    cd /home/architect
    # Create package.json for global workspace deps
    cat > workspace/package.json << EOF
{
  "name": "architect-workspace",
  "private": true,
  "scripts": {
    "dev": "echo Ready"
  }
}
EOF
' 2>/dev/null || true

# Create .bashrc additions for architect
sudo -u architect bash -c '
cat >> /home/architect/.bashrc << EOF

# ARCHITECT environment
export PATH="/home/architect/.local/bin:\$PATH"
source /home/architect/.venv/bin/activate 2>/dev/null || true
cd /home/architect/workspace

# Aliases
alias ll="ls -la"
alias py="python3"
EOF
'

# Allow spawn user to run commands as architect without password
echo "spawn ALL=(architect) NOPASSWD: ALL" > /etc/sudoers.d/spawn-architect
chmod 440 /etc/sudoers.d/spawn-architect

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Workspace: /home/architect/workspace"
echo "Python:    /home/architect/.venv (pygame, numpy, pandas, etc.)"
echo "Node:      System node + pnpm"
echo ""
echo "Commands run via: sudo -u architect bash -c 'cd /home/architect/workspace && ...'"
