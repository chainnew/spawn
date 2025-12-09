# SPAWN.NEW - Master Documentation

## Project Overview

Spawn.new is a modular AI-powered development platform combining:
- **Rust Backend** - High-performance API server with terminal management
- **Node Sandbox** - Grok-powered AI chat with tool execution
- **Control Panel** - Admin UI for system management
- **Terminal Suite** - PTY-based terminal sessions with programmatic access

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SPAWN.NEW PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│   │  spawn-api   │    │ terminal-app │    │   sandbox    │             │
│   │  (Rust)      │    │   (Rust)     │    │   (Node)     │             │
│   │  Port: 3000  │    │  Port: 3001  │    │  Port: 3080  │             │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘             │
│          │                   │                   │                      │
│   ┌──────▼───────────────────▼───────────────────▼──────┐              │
│   │                    SHARED SERVICES                    │              │
│   │  • Database (SQLite / PostgreSQL + pgvector)          │              │
│   │  • OpenRouter API (Grok/Claude/Embeddings)            │              │
│   │  • Vector Memory (Semantic Search)                    │              │
│   │  • File System (Workspace)                            │              │
│   └─────────────────────────────────────────────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Crate Reference

### Core Crates

| Crate | Location | Purpose | Key Files |
|-------|----------|---------|-----------|
| `spawn-core` | `crates/spawn-core/` | Shared types, config, LLM traits | `src/lib.rs` |
| `spawn-ai` | `crates/spawn-ai/` | OpenRouter client implementation | `src/lib.rs` |
| `spawn-agents` | `crates/spawn-agents/` | Agent orchestration, database, vector memory | `src/orchestrator.rs`, `src/vector_memory.rs` |
| `spawn-api` | `crates/spawn-api/` | Main HTTP server (port 3000) | `src/main.rs` |

### Terminal Suite Crates

| Crate | Location | Purpose | Key Files |
|-------|----------|---------|-----------|
| `terminal-core` | `crates/terminal-core/` | PTY handling, sessions, buffers | `src/session.rs:54` |
| `terminal-code-editor` | `crates/terminal-code-editor/` | Code editing with ropey | `src/lib.rs:53` |
| `terminal-file` | `crates/terminal-file/` | File system operations | `src/lib.rs:8` |
| `terminal-webrtc` | `crates/terminal-webrtc/` | WebRTC signaling (stub) | `src/lib.rs` |
| `terminal-app` | `crates/terminal-app/` | Terminal HTTP server (port 3001) | `src/main.rs` |

---

## API Reference

### spawn-api (Port 3000)

#### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/health` | Detailed status |

#### Missions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/missions` | Create new mission |
| `GET` | `/api/missions` | List all missions |

#### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Chat with LLM |

#### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List files in workspace |
| `GET` | `/api/files/*path` | Read file |
| `POST` | `/api/files/*path` | Write file |

#### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/status` | System status |
| `GET` | `/api/admin/prompts` | Get system prompts |
| `POST` | `/api/admin/prompts` | Update system prompts |
| `GET` | `/api/admin/config` | Get configuration |
| `POST` | `/api/admin/config` | Update configuration |

#### ARCHITECT API (Rust-Native Tool Execution)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/architect/status` | ARCHITECT system status |
| `POST` | `/api/architect/exec` | Execute shell command |
| `POST` | `/api/architect/read` | Read file contents |
| `POST` | `/api/architect/write` | Write file contents |
| `POST` | `/api/architect/list` | List directory |
| `POST` | `/api/architect/terminal/create` | Create PTY terminal |
| `POST` | `/api/architect/terminal/exec` | Execute in terminal |
| `GET` | `/api/architect/terminal/buffer` | Get terminal output |
| `GET` | `/api/architect/terminal/list` | List all terminals |
| `POST` | `/api/architect/mission` | Convert chat to mission |

#### Semantic Search API (pgvector)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=query` | General semantic search |
| `GET` | `/api/search/code?q=query&language=rust` | Search code with language filter |
| `POST` | `/api/search/index` | Index file for semantic search |
| `POST` | `/api/search/chat` | Store chat with embedding |
| `GET` | `/api/search/context?q=query` | Get relevant chat context (RAG) |
| `GET` | `/api/search/status` | Vector search system status |

#### WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| `WS` | `/ws/terminal` | Terminal WebSocket |

#### Static UIs
| Path | Description |
|------|-------------|
| `/admin` | Control Panel UI |
| `/sandbox` | Sandbox Chat UI |
| `/docs` | API Documentation |

---

### terminal-app (Port 3001)

#### Terminal API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/terminals` | List all terminals |
| `POST` | `/api/terminals` | Create terminal |
| `GET` | `/api/terminals/:id` | Get terminal info |
| `DELETE` | `/api/terminals/:id` | Kill terminal |
| `POST` | `/api/terminals/:id/exec` | Execute command |
| `POST` | `/api/terminals/:id/exec/wait` | Execute & wait for output |
| `POST` | `/api/terminals/:id/write` | Write raw input |
| `POST` | `/api/terminals/:id/resize` | Resize terminal |
| `GET` | `/api/terminals/:id/buffer` | Get output buffer |
| `DELETE` | `/api/terminals/:id/buffer` | Flush buffer |
| `GET` | `/api/terminals/by-name/:name` | Get terminal by name |
| `POST` | `/api/terminals/by-name/:name/exec` | Execute by name |

#### Editor API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/editor/open` | Open file in buffer |
| `POST` | `/api/editor/save` | Save buffer to disk |
| `GET` | `/api/editor/buffers` | List open buffers |
| `GET` | `/api/editor/buffers/:id` | Get buffer content |
| `PUT` | `/api/editor/buffers/:id` | Update buffer content |
| `DELETE` | `/api/editor/buffers/:id` | Close buffer |

#### File API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List directory |
| `GET` | `/api/files/tree` | Get file tree |
| `POST` | `/api/files/read` | Read file content |
| `POST` | `/api/files/write` | Write file content |
| `POST` | `/api/files/create` | Create new file |
| `POST` | `/api/files/delete` | Delete file/directory |
| `POST` | `/api/files/rename` | Rename/move file |
| `POST` | `/api/files/mkdir` | Create directory |
| `POST` | `/api/files/search` | Search files by pattern |

#### WebRTC API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webrtc/offer` | Handle WebRTC offer |
| `POST` | `/api/webrtc/answer` | Handle WebRTC answer |

---

### sandbox-server (Port 3080)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/chat/stream` | SSE streaming chat with Grok |
| `POST` | `/api/sandbox/exec` | Execute command directly |
| `POST` | `/api/sandbox/exec/stream` | Execute command with SSE stream |
| `GET` | `/api/workspaces` | List workspace projects |

#### Available Tools (Grok/ARCHITECT)

**Core Tools**
- `execute_command` - Run shell commands
- `read_file` - Read file contents
- `write_file` - Write file contents
- `list_files` - List directory contents
- `create_artifact` - Create visual artifacts (React, HTML, Mermaid, etc.)

**Terminal Tools (via terminal-app)**
- `terminal_create` - Create named PTY terminal session
- `terminal_exec` - Execute command in named terminal
- `terminal_buffer` - Get terminal output buffer
- `terminal_list` - List all terminal sessions

**Editor Tools**
- `editor_open` - Open file in code editor buffer
- `editor_save` - Save editor buffer to disk

**Mission Tools (via spawn-api)**
- `create_mission` - Create mission from chat
- `list_missions` - List all missions
- `get_architect_status` - Get ARCHITECT system status

---

## Configuration

### Environment Variables

#### spawn-api
```bash
# SQLite (default/dev)
DATABASE_URL=sqlite:spawn.db

# PostgreSQL + pgvector (production)
# POSTGRES_URL=postgres://user:pass@localhost/spawn

OPENROUTER_API_KEY=sk-or-v1-xxx
SERVER_HOST=0.0.0.0
SERVER_PORT=3000
WORKSPACE_ROOT=/home/spawn/spawn
SANDBOX_ENDPOINT=http://localhost:3080
```

#### terminal-app
```bash
TERMINAL_HOST=0.0.0.0
TERMINAL_PORT=3001
TERMINAL_WORKSPACE=/home/spawn/spawn
TERMINAL_MAX_SESSIONS=10
RUST_LOG=terminal_app=debug
```

#### sandbox-server
```bash
PORT=3080
WORKSPACE_PATH=./public/workspace
OPENROUTER_API_KEY=sk-or-v1-xxx
XAI_API_KEY=xai-xxx  # Alternative to OpenRouter
```

### Configuration Files

| File | Purpose |
|------|---------|
| `config/spawn.json` | Main configuration (sandbox, rules) |
| `config/prompts.json` | System prompts for chat/agent |

---

## Directory Structure

```
/home/spawn/spawn/
├── crates/
│   ├── spawn-core/          # Core types and config
│   ├── spawn-ai/            # LLM client
│   ├── spawn-agents/        # Agent orchestration
│   ├── spawn-api/           # Main API server
│   ├── terminal-core/       # PTY handling
│   ├── terminal-code-editor/# Code editing
│   ├── terminal-file/       # File operations
│   ├── terminal-webrtc/     # WebRTC stub
│   └── terminal-app/        # Terminal server
├── web/
│   ├── admin/               # Control Panel UI
│   │   └── index.html
│   ├── sandbox/             # Sandbox Chat UI
│   │   └── index.html
│   ├── docs/                # API Documentation
│   │   └── index.html
│   └── dist/                # Main React frontend
├── sandbox-server/
│   ├── server.js            # Node.js sandbox server
│   ├── public/
│   │   ├── index.html       # Sandbox UI
│   │   └── workspace/       # Sandbox workspace
│   └── setup.sh             # Setup script
├── config/
│   ├── spawn.json           # Main config
│   └── prompts.json         # System prompts
├── Cargo.toml               # Workspace manifest
├── spawn.db                 # SQLite database
└── MASTERDOCUMENT.md        # This file
```

---

## PostgreSQL + pgvector Setup

### Why pgvector?

pgvector enables semantic search over code, chat history, and mission context using vector embeddings:
- **Code Search** - Find similar functions/classes by semantic meaning, not just keywords
- **Chat Context (RAG)** - Retrieve relevant previous conversations for context
- **Mission Memory** - Search past mission goals, steps, and results

### Installation

#### 1. Install PostgreSQL with pgvector
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo apt install postgresql-15-pgvector  # Adjust version

# macOS (Homebrew)
brew install postgresql pgvector

# Docker (recommended)
docker run -d \
  --name spawn-postgres \
  -e POSTGRES_PASSWORD=spawn \
  -e POSTGRES_DB=spawn \
  -p 5432:5432 \
  pgvector/pgvector:pg15
```

#### 2. Enable pgvector Extension
```sql
-- Connect to your database
psql -U postgres -d spawn

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 3. Run Migration
```bash
# Set POSTGRES_URL environment variable
export POSTGRES_URL="postgres://postgres:spawn@localhost/spawn"

# Run migration (done automatically by sqlx on startup)
# Or manually:
psql $POSTGRES_URL -f migrations/20241209000000_pgvector.sql
```

#### 4. Configure spawn-api
```bash
# In .env or environment
POSTGRES_URL=postgres://postgres:spawn@localhost/spawn
OPENROUTER_API_KEY=sk-or-v1-xxx  # For embeddings
```

### Schema Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `embeddings` | General content embeddings | content_type, content_id, embedding[1536] |
| `code_chunks` | Indexed code for search | file_path, language, content, embedding[1536] |
| `chat_history` | Chat messages with embeddings | session_id, role, content, embedding[1536] |
| `mission_embeddings` | Mission context | mission_id, chunk_type, embedding[1536] |

### API Usage Examples

```bash
# Check search status
curl http://localhost:3000/api/search/status

# Search all content
curl "http://localhost:3000/api/search?q=authentication%20system&limit=10"

# Search code specifically
curl "http://localhost:3000/api/search/code?q=error%20handling&language=rust"

# Index a file
curl -X POST http://localhost:3000/api/search/index \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "src/main.rs",
    "content": "fn main() { ... }",
    "language": "rust"
  }'

# Store chat for context retrieval
curl -X POST http://localhost:3000/api/search/chat \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-123",
    "role": "user",
    "content": "How do I implement authentication?",
    "tool_calls": []
  }'

# Get relevant context for RAG
curl "http://localhost:3000/api/search/context?q=implement%20login"
```

### Embedding Model

Uses OpenRouter API with `openai/text-embedding-3-small`:
- **Dimensions**: 1536
- **Cost**: ~$0.02 per 1M tokens
- **Performance**: Fast, good quality for code search

### Fallback (No PostgreSQL)

When `POSTGRES_URL` is not set:
- SQLite is used for missions/logs (no vector search)
- Search endpoints return empty results
- System remains fully functional, just without semantic search

---

## Quick Start

### 1. Build All Crates
```bash
cargo build --workspace
```

### 2. Start All Services

**Option A: Single Command (Recommended)**
```bash
./start.sh           # Full build + start all services
./start.sh --no-build  # Fast start (skip build)
```

**Option B: Manual (Separate Terminals)**
```bash
# Terminal 1: Main API (port 3000)
cargo run -p spawn-api

# Terminal 2: Terminal Server (port 3001)
cargo run -p terminal-app

# Terminal 3: Sandbox Server (port 3080)
cd sandbox-server && npm start
```

### 3. Access UIs
- **Control Panel**: http://localhost:3000/admin
- **Sandbox Chat**: http://localhost:3080
- **Terminal API**: http://localhost:3001/health

---

## Key Source File References

### spawn-api
| File | Line | Description |
|------|------|-------------|
| `src/main.rs` | 82 | Router configuration |
| `src/admin.rs` | 33 | Admin status endpoint |
| `src/files.rs` | 1 | File operations |
| `src/terminal.rs` | 1 | Terminal WebSocket |

### terminal-app
| File | Line | Description |
|------|------|-------------|
| `src/main.rs` | 1 | Server entry point |
| `src/routes.rs` | 6 | All route definitions |
| `src/handlers/terminal.rs` | 14 | Terminal handlers |
| `src/handlers/files.rs` | 1 | File handlers |
| `src/handlers/editor.rs` | 1 | Editor handlers |
| `src/state.rs` | 8 | App state definition |

### terminal-core
| File | Line | Description |
|------|------|-------------|
| `src/session.rs` | 40 | SessionManager struct |
| `src/session.rs` | 68 | create_session() |
| `src/session.rs` | 124 | exec() |
| `src/pty.rs` | 36 | spawn_pty() |
| `src/buffer.rs` | 6 | TerminalBuffer |

### sandbox-server
| File | Line | Description |
|------|------|-------------|
| `server.js` | 87 | Tool definitions |
| `server.js` | 167 | Tool execution |
| `server.js` | 258 | Chat endpoint |

---

## Security Rules

### MUST Rules
- Always confirm before deleting files
- Log all command executions
- Use relative paths within workspace
- Report errors immediately

### MUST NOT Rules
- `rm -rf /` - Recursive delete from root
- `sudo` commands - Privilege escalation
- `chmod 777` - Overly permissive permissions
- Access outside workspace
- Download from untrusted sources
- Execute base64 encoded commands

---

## Testing

### API Health Checks
```bash
# spawn-api
curl http://localhost:3000/health

# terminal-app
curl http://localhost:3001/health

# sandbox-server
curl http://localhost:3080/health
```

### Terminal API Examples
```bash
# Create terminal
curl -X POST http://localhost:3001/api/terminals \
  -H "Content-Type: application/json" \
  -d '{"name": "dev"}'

# Execute command
curl -X POST http://localhost:3001/api/terminals/by-name/dev/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'

# Get buffer
curl http://localhost:3001/api/terminals/by-name/dev/buffer
```

### File API Examples
```bash
# List files
curl "http://localhost:3001/api/files?path=."

# Read file
curl -X POST http://localhost:3001/api/files/read \
  -H "Content-Type: application/json" \
  -d '{"path": "Cargo.toml"}'

# File tree
curl "http://localhost:3001/api/files/tree?depth=2"
```

---

## Changelog

### 2024-12-09 (Session 2)
- Added ARCHITECT API to spawn-api (`/api/architect/*`)
- Added PostgreSQL + pgvector for semantic search
- Created vector memory module (`spawn-agents/src/vector_memory.rs`)
- Added semantic search API endpoints (`/api/search/*`)
- Updated ARCHITECT prompt with full tool documentation
- Added terminal/editor/mission tools to sandbox server
- Created `start.sh` for single-command service startup
- Deep integration between sandbox and Rust backend

### 2024-12-09 (Session 1)
- Created terminal suite (terminal-core, terminal-app, etc.)
- Added Control Panel UI at `/admin`
- Added admin API endpoints
- Created configuration system (`config/`)
- Implemented PTY session management
- Added file operations API
- Added code editor buffer management

---

## Contributors

- **Primary Development**: Claude Code (Anthropic)
- **Architecture**: spawn.new team
- **AI Integration**: Grok (xAI) + Claude (Anthropic)

---

## License

MIT License - See LICENSE file for details.
