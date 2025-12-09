#!/bin/bash
# Spawn Agent Container Entrypoint
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🚀 Spawn Agent Container Starting...                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Setup workspace if empty
if [ -z "$(ls -A /home/agent/workspace 2>/dev/null)" ]; then
    echo "[init] Initializing workspace..."
    mkdir -p /home/agent/workspace
fi

# Activate Python venv if available
if [ -d "/app/.venv" ]; then
    echo "[init] Activating Python virtual environment..."
    source /app/.venv/bin/activate
fi

# Print environment info
echo "[info] Node.js: $(node --version)"
echo "[info] Python: $(python3 --version 2>&1)"
echo "[info] Workspace: ${WORKSPACE_PATH:-/home/agent/workspace}"
echo "[info] Port: ${PORT:-3080}"

# Check for API keys
if [ -n "$XAI_API_KEY" ]; then
    echo "[info] XAI API key configured ✓"
elif [ -n "$OPENROUTER_API_KEY" ]; then
    echo "[info] OpenRouter API key configured ✓"
else
    echo "[warn] No API key configured - set XAI_API_KEY or OPENROUTER_API_KEY"
fi

# Run the main command
echo "[start] Running: $@"
exec "$@"
