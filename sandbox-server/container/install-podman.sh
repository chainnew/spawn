#!/bin/bash
# Install podman and setup for ARCHITECT sandbox
set -e

echo "=== Installing Podman ==="
sudo apt-get update -qq
sudo apt-get install -y podman

echo "=== Podman installed ==="
podman --version

echo ""
echo "Now build the ARCHITECT image:"
echo "  cd /home/spawn/spawn/sandbox-server/container"
echo "  podman build -t architect:latest ."
