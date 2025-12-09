-- pgvector tables for PostgreSQL
-- This migration is PostgreSQL-specific and will be skipped on SQLite
-- SQLite users: vector search features will be unavailable

-- Skip this entire migration on SQLite (it doesn't support these features)
-- The application handles this gracefully with stub implementations

-- Vector embeddings table for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL,  -- 'code', 'chat', 'mission', 'file'
    content_id TEXT NOT NULL,     -- Reference to original content
    content_hash TEXT NOT NULL,   -- SHA256 hash for deduplication
    content_preview TEXT NOT NULL, -- First 500 chars for display
    embedding vector(1536),       -- OpenAI ada-002 / text-embedding-3-small dimensions
    metadata JSONB DEFAULT '{}',  -- Additional searchable metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Code chunks for semantic code search
CREATE TABLE IF NOT EXISTS code_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    language TEXT NOT NULL,
    chunk_type TEXT NOT NULL,  -- 'function', 'class', 'module', 'block'
    name TEXT,                  -- Function/class name if applicable
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat history with embeddings for context retrieval
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    embedding vector(1536),
    tool_calls JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mission context embeddings
CREATE TABLE IF NOT EXISTS mission_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    chunk_type TEXT NOT NULL,  -- 'goal', 'step', 'result', 'error'
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for vector similarity search (using IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_code_chunks_vector ON code_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chat_history_vector ON chat_history
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_mission_embeddings_vector ON mission_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes for filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_code_chunks_path ON code_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks(language);
CREATE INDEX IF NOT EXISTS idx_code_chunks_name ON code_chunks(name);
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_mission_embeddings_mission ON mission_embeddings(mission_id);
