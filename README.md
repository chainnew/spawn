# 🧠 Spawn

Minimal AI agent orchestration in Rust. 4 crates, no bullshit.

## Architecture

```
crates/
├── spawn-core/     # Types, traits, errors (the nervous system)
├── spawn-ai/       # LLM providers (the speech center)
├── spawn-agents/   # Orchestrator + Memory + Tools (the brain & hands)
└── spawn-api/      # Axum server (the interface)
```

## Quick Start

```bash
# Setup
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY

# Build
cargo build

# Run
cargo run

# Test
curl http://localhost:3000/health
```

## API

```bash
# Create a mission
curl -X POST http://localhost:3000/api/missions \
  -H "Content-Type: application/json" \
  -d '{"goal": "List all files in the current directory"}'

# List missions
curl http://localhost:3000/api/missions
```

## Development

```bash
# Watch mode
cargo watch -x run

# Check
cargo check --all

# Test
cargo test --all

# Format
cargo fmt --all

# Lint
cargo clippy --all
```

## Models

Default: `anthropic/claude-sonnet-4-20250514` via OpenRouter

Supports any model available on OpenRouter.
