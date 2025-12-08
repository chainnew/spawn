//! spawn-core: The nervous system
//! 
//! Shared types, traits, and error handling for the spawn ecosystem.
//! Zero business logic - just contracts everyone speaks.

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use thiserror::Error;

// ============================================
// ID Types
// ============================================

pub type MissionId = String;
pub type TaskId = String;
pub type AgentId = String;

// ============================================
// Errors
// ============================================

#[derive(Error, Debug)]
pub enum SpawnError {
    #[error("LLM Provider Error: {0}")]
    ProviderError(String),
    
    #[error("Tool Execution Error: {0}")]
    ToolError(String),
    
    #[error("Orchestrator Error: {0}")]
    OrchestrationError(String),
    
    #[error("Database Error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    #[error("Migration Error: {0}")]
    MigrationError(#[from] sqlx::migrate::MigrateError),
    
    #[error("Serialization Error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Internal Error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, SpawnError>;

// ============================================
// Core Primitives
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: MissionId,
    pub goal: String,
    pub status: MissionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub context: serde_json::Value,
}

impl Mission {
    pub fn new(goal: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            goal: goal.into(),
            status: MissionStatus::Pending,
            created_at: now,
            updated_at: now,
            context: serde_json::json!({}),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MissionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: Role::System, content: content.into(), name: None }
    }
    
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: Role::User, content: content.into(), name: None }
    }
    
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: Role::Assistant, content: content.into(), name: None }
    }
}

// ============================================
// Traits (The Contracts)
// ============================================

/// LLM Client trait - implement for each provider
#[async_trait::async_trait]
pub trait LlmClient: Send + Sync {
    /// Send a chat completion request
    async fn chat(&self, model: &str, messages: &[ChatMessage]) -> Result<String>;
    
    /// Provider name for logging/routing
    fn provider_name(&self) -> &str;
}

/// Tool trait - implement for each capability
#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    /// Tool name (used in function calling)
    fn name(&self) -> &str;
    
    /// Human-readable description
    fn description(&self) -> &str;
    
    /// JSON Schema for parameters
    fn parameters(&self) -> serde_json::Value;
    
    /// Execute the tool with given arguments
    async fn execute(&self, args: serde_json::Value) -> Result<serde_json::Value>;
}

// ============================================
// Config
// ============================================

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub openrouter_api_key: String,
    pub server_host: String,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:spawn.db".to_string()),
            openrouter_api_key: std::env::var("OPENROUTER_API_KEY")
                .map_err(|_| SpawnError::Internal("OPENROUTER_API_KEY not set".into()))?,
            server_host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
        })
    }
}
