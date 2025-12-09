//! Semantic Search API endpoints
//!
//! Provides vector-based search over code, chat history, and missions.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use spawn_agents::{ContentType, SearchResult, VectorMemory};
use std::sync::Arc;

use crate::AppState;

// ============================================
// Search API Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    10
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
    pub total: usize,
}

#[derive(Debug, Deserialize)]
pub struct CodeSearchQuery {
    pub q: String,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

#[derive(Debug, Deserialize)]
pub struct IndexFileRequest {
    pub file_path: String,
    pub content: String,
    pub language: String,
}

#[derive(Debug, Serialize)]
pub struct IndexFileResponse {
    pub success: bool,
    pub chunks_indexed: usize,
    pub file_path: String,
}

#[derive(Debug, Deserialize)]
pub struct StoreChatRequest {
    pub session_id: String,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub tool_calls: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct StoreChatResponse {
    pub success: bool,
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatContextQuery {
    pub q: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default = "default_context_limit")]
    pub limit: i32,
}

fn default_context_limit() -> i32 {
    5
}

// ============================================
// Search Handlers
// ============================================

/// General semantic search across all content types
pub async fn search(
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let pg_url = std::env::var("POSTGRES_URL").ok();

    // Check if PostgreSQL is configured
    let Some(pg_url) = pg_url else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
            "error": "Vector search requires PostgreSQL with pgvector. Set POSTGRES_URL env var."
        }))).into_response();
    };

    let vector_memory = match VectorMemory::connect(&pg_url, &api_key).await {
        Ok(vm) => vm,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to connect to vector store: {}", e)
            }))).into_response();
        }
    };

    let content_type = query.content_type.as_deref().and_then(|t| match t {
        "code" => Some(ContentType::Code),
        "chat" => Some(ContentType::Chat),
        "mission" => Some(ContentType::Mission),
        "file" => Some(ContentType::File),
        _ => None,
    });

    match vector_memory.search(&query.q, content_type, query.limit).await {
        Ok(results) => {
            let total = results.len();
            (StatusCode::OK, Json(SearchResponse {
                query: query.q,
                results,
                total,
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Search failed: {}", e)
            }))).into_response()
        }
    }
}

/// Search code specifically with language filtering
pub async fn search_code(
    Query(query): Query<CodeSearchQuery>,
) -> impl IntoResponse {
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let pg_url = std::env::var("POSTGRES_URL").ok();

    let Some(pg_url) = pg_url else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
            "error": "Vector search requires PostgreSQL with pgvector. Set POSTGRES_URL env var."
        }))).into_response();
    };

    let vector_memory = match VectorMemory::connect(&pg_url, &api_key).await {
        Ok(vm) => vm,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to connect to vector store: {}", e)
            }))).into_response();
        }
    };

    match vector_memory.search_code(&query.q, query.language.as_deref(), query.limit).await {
        Ok(results) => {
            let total = results.len();
            (StatusCode::OK, Json(SearchResponse {
                query: query.q,
                results,
                total,
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Code search failed: {}", e)
            }))).into_response()
        }
    }
}

/// Index a file for semantic search
pub async fn index_file(
    State(state): State<AppState>,
    Json(req): Json<IndexFileRequest>,
) -> impl IntoResponse {
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let pg_url = std::env::var("POSTGRES_URL").ok();

    let Some(pg_url) = pg_url else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(IndexFileResponse {
            success: false,
            chunks_indexed: 0,
            file_path: req.file_path,
        })).into_response();
    };

    let vector_memory = match VectorMemory::connect(&pg_url, &api_key).await {
        Ok(vm) => vm,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(IndexFileResponse {
                success: false,
                chunks_indexed: 0,
                file_path: req.file_path,
            })).into_response();
        }
    };

    match vector_memory.index_file(&req.file_path, &req.content, &req.language).await {
        Ok(chunks) => {
            (StatusCode::OK, Json(IndexFileResponse {
                success: true,
                chunks_indexed: chunks,
                file_path: req.file_path,
            })).into_response()
        }
        Err(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(IndexFileResponse {
                success: false,
                chunks_indexed: 0,
                file_path: req.file_path,
            })).into_response()
        }
    }
}

/// Store chat message with embedding for context retrieval
pub async fn store_chat(
    Json(req): Json<StoreChatRequest>,
) -> impl IntoResponse {
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let pg_url = std::env::var("POSTGRES_URL").ok();

    let Some(pg_url) = pg_url else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(StoreChatResponse {
            success: false,
            id: String::new(),
        })).into_response();
    };

    let vector_memory = match VectorMemory::connect(&pg_url, &api_key).await {
        Ok(vm) => vm,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(StoreChatResponse {
                success: false,
                id: String::new(),
            })).into_response();
        }
    };

    match vector_memory.store_chat(&req.session_id, &req.role, &req.content, req.tool_calls).await {
        Ok(id) => {
            (StatusCode::OK, Json(StoreChatResponse {
                success: true,
                id,
            })).into_response()
        }
        Err(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(StoreChatResponse {
                success: false,
                id: String::new(),
            })).into_response()
        }
    }
}

/// Get relevant chat context for a query (RAG-style retrieval)
pub async fn get_chat_context(
    Query(query): Query<ChatContextQuery>,
) -> impl IntoResponse {
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let pg_url = std::env::var("POSTGRES_URL").ok();

    let Some(pg_url) = pg_url else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
            "error": "Vector search requires PostgreSQL with pgvector. Set POSTGRES_URL env var."
        }))).into_response();
    };

    let vector_memory = match VectorMemory::connect(&pg_url, &api_key).await {
        Ok(vm) => vm,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to connect to vector store: {}", e)
            }))).into_response();
        }
    };

    match vector_memory.get_chat_context(&query.q, query.session_id.as_deref(), query.limit).await {
        Ok(results) => {
            let total = results.len();
            (StatusCode::OK, Json(SearchResponse {
                query: query.q,
                results,
                total,
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Context retrieval failed: {}", e)
            }))).into_response()
        }
    }
}

/// Get search system status
pub async fn search_status() -> impl IntoResponse {
    let pg_url = std::env::var("POSTGRES_URL").ok();
    let api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();

    let pg_available = if let Some(ref url) = pg_url {
        VectorMemory::connect(url, &api_key).await.is_ok()
    } else {
        false
    };

    (StatusCode::OK, Json(serde_json::json!({
        "vector_search_available": pg_available,
        "postgres_configured": pg_url.is_some(),
        "embedding_model": "openai/text-embedding-3-small",
        "embedding_dimensions": 1536,
    }))).into_response()
}
