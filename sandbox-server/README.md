# 🐧 Spawn Sandbox Server

Multi-agent sandbox with Podman exec, SSE streaming, and live artifact rendering.

## Quick Start

```bash
# 1. Run setup (installs deps, creates container)
chmod +x setup.sh && ./setup.sh

# 2. Add your API keys to .env
nano .env

# 3. Start server
npm start

# 4. Open browser
http://localhost:3080
```

## Features

- **🐳 Podman Container Exec** - Run commands in isolated container
- **📡 SSE Streaming** - Real-time command output
- **🎨 Artifact Renderer** - Live preview of React/HTML/Mermaid/SVG/Markdown
- **🤖 LLM Proxy** - OpenRouter + Grok/xAI integration
- **📁 File Operations** - Read/write files in workspace
- **🐙 GitHub Clone** - Clone repos into container

## API Endpoints

### Health & Status
```bash
GET /health
GET /api/status
```

### GitHub
```bash
POST /api/github/clone
  { "url": "https://github.com/owner/repo" }

POST /api/github/clone/stream  # SSE
  { "url": "https://github.com/owner/repo" }
```

### Workspaces
```bash
GET /api/workspaces
GET /api/workspaces/:name
GET /api/workspaces/:name/tree
POST /api/workspaces/:name/install
```

### Sandbox Exec
```bash
POST /api/sandbox/exec
  { "command": "ls -la", "cwd": "/workspace/myproject" }

POST /api/sandbox/exec/stream  # SSE
  { "command": "npm test" }
```

### Files
```bash
GET /api/sandbox/workspaces/:name/files/*
POST /api/sandbox/workspaces/:name/files/*
  { "content": "file contents" }
DELETE /api/sandbox/workspaces/:name/files/*
```

### LLM Proxy
```bash
POST /v1/chat/completions  # OpenRouter compatible
POST /api/grok/chat        # xAI/Grok
POST /api/artifacts/generate
  { "prompt": "Create a todo app", "type": "react" }
```

## Artifact Format

Agents should emit artifacts like this:

```xml
<artifact type="react" title="My Component">
function App() {
  return <div>Hello World!</div>;
}
</artifact>

<artifact type="mermaid" title="Flow">
flowchart LR
  A --> B --> C
</artifact>

<artifact type="markdown" title="Notes">
# Title
- Item 1
- Item 2
</artifact>
```

Supported types: `react`, `html`, `svg`, `markdown`, `mermaid`, `code`

## Environment Variables

```env
PORT=3080
CONTAINER_NAME=spawn-sandbox
WORKSPACE_PATH=/workspace
OPENROUTER_API_KEY=sk-or-v1-xxx
XAI_API_KEY=xai-xxx
```

## Container Setup

The setup script creates a container automatically, but you can also do it manually:

```bash
# Create container with persistent volume
podman run -d \
  --name spawn-sandbox \
  -v spawn-workspace:/workspace \
  ubuntu:22.04 \
  sleep infinity

# Install tools
podman exec spawn-sandbox apt-get update
podman exec spawn-sandbox apt-get install -y git curl nodejs npm python3
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (localhost:3080)          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Prompt    │  │  Artifact   │  │   Preview   │ │
│  │   Input     │  │    List     │  │   (iframe)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Express Server (Node.js)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │ GitHub  │  │  Exec   │  │  Files  │  │  LLM   │ │
│  │  Clone  │  │   SSE   │  │   API   │  │ Proxy  │ │
│  └─────────┘  └─────────┘  └─────────┘  └────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│            Podman Container (Ubuntu 22.04)          │
│  ┌─────────────────────────────────────────────┐   │
│  │              /workspace                      │   │
│  │   project-1/  project-2/  project-3/        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## License

MIT
