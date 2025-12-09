//! Vector memory for semantic search using pgvector
//!
//! Provides embedding-based search over code, chat history, and mission context.

use serde::{Deserialize, Serialize};
use spawn_core::Result;
use tracing::warn;

#[cfg(feature = "postgres")]
use sha2::{Sha256, Digest};

#[cfg(feature = "postgres")]
use tracing::info;

#[cfg(feature = "postgres")]
use sqlx::PgPool;

/// Embedding dimensions (OpenAI text-embedding-3-small)
pub const EMBEDDING_DIMENSIONS: usize = 1536;

/// Content types that can be embedded
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    Code,
    Chat,
    Mission,
    File,
}

impl std::fmt::Display for ContentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContentType::Code => write!(f, "code"),
            ContentType::Chat => write!(f, "chat"),
            ContentType::Mission => write!(f, "mission"),
            ContentType::File => write!(f, "file"),
        }
    }
}

/// A chunk of code for semantic search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    pub file_path: String,
    pub language: String,
    pub chunk_type: String,  // function, class, module, block
    pub name: Option<String>,
    pub start_line: i32,
    pub end_line: i32,
    pub content: String,
}

/// Search result with similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub content_type: String,
    pub content_preview: String,
    pub similarity: f32,
    pub metadata: serde_json::Value,
}

/// Vector memory store backed by PostgreSQL + pgvector
#[cfg(feature = "postgres")]
pub struct VectorMemory {
    pool: PgPool,
    embedding_api_key: String,
    embedding_model: String,
}

#[cfg(feature = "postgres")]
impl VectorMemory {
    /// Create a new vector memory store
    pub async fn connect(database_url: &str, api_key: &str) -> Result<Self> {
        info!("Connecting to PostgreSQL with pgvector");
        let pool = PgPool::connect(database_url).await?;

        // Verify pgvector extension
        let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'")
            .fetch_one(&pool)
            .await?;

        if result.0 == 0 {
            warn!("pgvector extension not installed! Run: CREATE EXTENSION vector;");
        }

        Ok(Self {
            pool,
            embedding_api_key: api_key.to_string(),
            embedding_model: "openai/text-embedding-3-small".to_string(),
        })
    }

    /// Generate embedding for text using OpenRouter
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let client = reqwest::Client::new();

        let response = client
            .post("https://openrouter.ai/api/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.embedding_api_key))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "model": self.embedding_model,
                "input": text
            }))
            .send()
            .await?;

        let data: serde_json::Value = response.json().await?;

        let embedding = data["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| spawn_core::SpawnError::Other("Invalid embedding response".to_string()))?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();

        Ok(embedding)
    }

    /// Compute content hash for deduplication
    fn content_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Store a general embedding
    pub async fn store_embedding(
        &self,
        content_type: ContentType,
        content_id: &str,
        content: &str,
        metadata: serde_json::Value,
    ) -> Result<String> {
        let hash = Self::content_hash(content);
        let preview = content.chars().take(500).collect::<String>();
        let embedding = self.embed(content).await?;

        // Convert embedding to pgvector format
        let embedding_str = format!("[{}]",
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let id: (uuid::Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO embeddings (content_type, content_id, content_hash, content_preview, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5::vector, $6)
            ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
            RETURNING id
            "#
        )
        .bind(content_type.to_string())
        .bind(content_id)
        .bind(&hash)
        .bind(&preview)
        .bind(&embedding_str)
        .bind(&metadata)
        .fetch_one(&self.pool)
        .await?;

        Ok(id.0.to_string())
    }

    /// Store a code chunk with embedding
    pub async fn store_code_chunk(&self, chunk: &CodeChunk) -> Result<String> {
        let embedding = self.embed(&chunk.content).await?;
        let embedding_str = format!("[{}]",
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let metadata = serde_json::json!({
            "file_path": chunk.file_path,
            "language": chunk.language,
            "chunk_type": chunk.chunk_type,
            "name": chunk.name,
            "lines": format!("{}:{}", chunk.start_line, chunk.end_line),
        });

        let id: (uuid::Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO code_chunks (file_path, language, chunk_type, name, start_line, end_line, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
            RETURNING id
            "#
        )
        .bind(&chunk.file_path)
        .bind(&chunk.language)
        .bind(&chunk.chunk_type)
        .bind(&chunk.name)
        .bind(chunk.start_line)
        .bind(chunk.end_line)
        .bind(&chunk.content)
        .bind(&embedding_str)
        .bind(&metadata)
        .fetch_one(&self.pool)
        .await?;

        Ok(id.0.to_string())
    }

    /// Store chat message with embedding
    pub async fn store_chat(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
        tool_calls: Vec<serde_json::Value>,
    ) -> Result<String> {
        let embedding = self.embed(content).await?;
        let embedding_str = format!("[{}]",
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let id: (uuid::Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO chat_history (session_id, role, content, embedding, tool_calls)
            VALUES ($1, $2, $3, $4::vector, $5)
            RETURNING id
            "#
        )
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(&embedding_str)
        .bind(serde_json::json!(tool_calls))
        .fetch_one(&self.pool)
        .await?;

        Ok(id.0.to_string())
    }

    /// Semantic search across all embeddings
    pub async fn search(
        &self,
        query: &str,
        content_type: Option<ContentType>,
        limit: i32,
    ) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embed(query).await?;
        let embedding_str = format!("[{}]",
            query_embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let type_filter = content_type.map(|t| t.to_string());

        let rows: Vec<(uuid::Uuid, String, String, f32, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT id, content_type, content_preview,
                   1 - (embedding <=> $1::vector) as similarity,
                   metadata
            FROM embeddings
            WHERE ($2::text IS NULL OR content_type = $2)
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            "#
        )
        .bind(&embedding_str)
        .bind(&type_filter)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|(id, ct, preview, sim, meta)| SearchResult {
            id: id.to_string(),
            content_type: ct,
            content_preview: preview,
            similarity: sim,
            metadata: meta,
        }).collect())
    }

    /// Search code specifically
    pub async fn search_code(
        &self,
        query: &str,
        language: Option<&str>,
        limit: i32,
    ) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embed(query).await?;
        let embedding_str = format!("[{}]",
            query_embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let rows: Vec<(uuid::Uuid, String, String, i32, i32, f32, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT id, file_path, content, start_line, end_line,
                   1 - (embedding <=> $1::vector) as similarity,
                   metadata
            FROM code_chunks
            WHERE ($2::text IS NULL OR language = $2)
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            "#
        )
        .bind(&embedding_str)
        .bind(language)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|(id, path, content, start, end, sim, meta)| SearchResult {
            id: id.to_string(),
            content_type: "code".to_string(),
            content_preview: format!("{}:{}-{}\n{}", path, start, end,
                content.chars().take(200).collect::<String>()),
            similarity: sim,
            metadata: meta,
        }).collect())
    }

    /// Get relevant chat context for a query
    pub async fn get_chat_context(
        &self,
        query: &str,
        session_id: Option<&str>,
        limit: i32,
    ) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embed(query).await?;
        let embedding_str = format!("[{}]",
            query_embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(","));

        let rows: Vec<(uuid::Uuid, String, String, f32, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT id, role, content,
                   1 - (embedding <=> $1::vector) as similarity,
                   tool_calls as metadata
            FROM chat_history
            WHERE ($2::text IS NULL OR session_id = $2)
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            "#
        )
        .bind(&embedding_str)
        .bind(session_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|(id, role, content, sim, meta)| SearchResult {
            id: id.to_string(),
            content_type: format!("chat:{}", role),
            content_preview: content.chars().take(300).collect(),
            similarity: sim,
            metadata: meta,
        }).collect())
    }

    /// Index an entire file by chunking it intelligently
    pub async fn index_file(&self, file_path: &str, content: &str, language: &str) -> Result<usize> {
        // Simple line-based chunking for now
        // TODO: Use tree-sitter for AST-based chunking
        let lines: Vec<&str> = content.lines().collect();
        let chunk_size = 50;  // lines per chunk
        let overlap = 10;     // overlap between chunks

        let mut chunks_indexed = 0;
        let mut i = 0;

        while i < lines.len() {
            let end = (i + chunk_size).min(lines.len());
            let chunk_content = lines[i..end].join("\n");

            if !chunk_content.trim().is_empty() {
                let chunk = CodeChunk {
                    file_path: file_path.to_string(),
                    language: language.to_string(),
                    chunk_type: "block".to_string(),
                    name: None,
                    start_line: (i + 1) as i32,
                    end_line: end as i32,
                    content: chunk_content,
                };

                self.store_code_chunk(&chunk).await?;
                chunks_indexed += 1;
            }

            i += chunk_size - overlap;
        }

        info!(file = file_path, chunks = chunks_indexed, "Indexed file");
        Ok(chunks_indexed)
    }
}

// Stub implementation when postgres feature is not enabled
#[cfg(not(feature = "postgres"))]
pub struct VectorMemory;

#[cfg(not(feature = "postgres"))]
impl VectorMemory {
    pub async fn connect(_database_url: &str, _api_key: &str) -> Result<Self> {
        warn!("Vector memory requires 'postgres' feature. Using stub implementation.");
        Ok(Self)
    }

    pub async fn search(&self, _query: &str, _content_type: Option<ContentType>, _limit: i32) -> Result<Vec<SearchResult>> {
        Ok(vec![])
    }

    pub async fn search_code(&self, _query: &str, _language: Option<&str>, _limit: i32) -> Result<Vec<SearchResult>> {
        Ok(vec![])
    }

    pub async fn index_file(&self, _file_path: &str, _content: &str, _language: &str) -> Result<usize> {
        warn!("index_file requires 'postgres' feature");
        Ok(0)
    }

    pub async fn store_chat(
        &self,
        _session_id: &str,
        _role: &str,
        _content: &str,
        _tool_calls: Vec<serde_json::Value>,
    ) -> Result<String> {
        warn!("store_chat requires 'postgres' feature");
        Ok(String::new())
    }

    pub async fn get_chat_context(
        &self,
        _query: &str,
        _session_id: Option<&str>,
        _limit: i32,
    ) -> Result<Vec<SearchResult>> {
        Ok(vec![])
    }
}

#[cfg(all(test, feature = "postgres"))]
mod tests {
    use super::*;

    #[test]
    fn test_content_hash() {
        let hash = VectorMemory::content_hash("hello world");
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex chars
    }
}
