//! Admin API endpoints for the control panel
//!
//! Provides system status, prompt management, and configuration APIs.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::AppState;

// ============================================
// Status Endpoint
// ============================================

#[derive(Debug, Serialize)]
pub struct ServiceStatus {
    pub name: String,
    pub status: String,
    pub latency_ms: Option<u64>,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SystemStatus {
    pub rust_api: ServiceStatus,
    pub sandbox: ServiceStatus,
    pub openrouter: ServiceStatus,
    pub database: ServiceStatus,
}

pub async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    // Check sandbox health
    let sandbox_status = check_sandbox_health().await;

    // Database is healthy if we got here (connection works)
    let db_status = ServiceStatus {
        name: "database".to_string(),
        status: "online".to_string(),
        latency_ms: None,
        details: None,
    };

    let status = SystemStatus {
        rust_api: ServiceStatus {
            name: "rust_api".to_string(),
            status: "online".to_string(),
            latency_ms: Some(0),
            details: Some(serde_json::json!({
                "version": "0.1.0",
                "workspace": state.workspace_root.display().to_string(),
            })),
        },
        sandbox: sandbox_status,
        openrouter: ServiceStatus {
            name: "openrouter".to_string(),
            status: if std::env::var("OPENROUTER_API_KEY").is_ok() { "configured" } else { "not_configured" }.to_string(),
            latency_ms: None,
            details: None,
        },
        database: db_status,
    };

    (StatusCode::OK, Json(status))
}

async fn check_sandbox_health() -> ServiceStatus {
    let sandbox_url = std::env::var("SANDBOX_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:3080".to_string());

    let start = std::time::Instant::now();
    match reqwest::get(format!("{}/health", sandbox_url)).await {
        Ok(res) if res.status().is_success() => {
            let latency = start.elapsed().as_millis() as u64;
            let details = res.json::<serde_json::Value>().await.ok();
            ServiceStatus {
                name: "sandbox".to_string(),
                status: "online".to_string(),
                latency_ms: Some(latency),
                details,
            }
        }
        _ => ServiceStatus {
            name: "sandbox".to_string(),
            status: "offline".to_string(),
            latency_ms: None,
            details: None,
        },
    }
}

// ============================================
// Prompts Endpoints
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPrompts {
    pub chat: String,
    pub agent: String,
}

const PROMPTS_FILE: &str = "config/prompts.json";

pub async fn get_prompts() -> impl IntoResponse {
    let prompts = load_prompts();
    (StatusCode::OK, Json(prompts))
}

pub async fn save_prompts(Json(prompts): Json<SystemPrompts>) -> impl IntoResponse {
    // Ensure config directory exists
    if let Some(parent) = Path::new(PROMPTS_FILE).parent() {
        let _ = fs::create_dir_all(parent);
    }

    match fs::write(PROMPTS_FILE, serde_json::to_string_pretty(&prompts).unwrap()) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"success": false, "error": e.to_string()})),
        ),
    }
}

fn load_prompts() -> SystemPrompts {
    fs::read_to_string(PROMPTS_FILE)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| SystemPrompts {
            chat: "You are Grok, a helpful and slightly witty AI assistant for spawn.new. Help users build software, write code, and debug issues. Be concise but thorough.".to_string(),
            agent: r#"You are an autonomous AI agent. You can execute shell commands, read/write files, and complete complex tasks.

Available tools:
- shell: Execute safe shell commands
- read_file: Read file contents
- write_file: Write content to files
- list_files: List directory contents

Guidelines:
- Be proactive and complete tasks autonomously
- Test your work by running commands
- Report progress and results clearly"#.to_string(),
        })
}

// ============================================
// Config Endpoints
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SpawnConfig {
    pub sandbox_enabled: bool,
    pub sandbox_endpoint: String,
    pub sandbox_max_iterations: u32,
    pub must_rules: Vec<String>,
    pub must_not_rules: Vec<String>,
}

const CONFIG_FILE: &str = "config/spawn.json";

pub async fn get_config() -> impl IntoResponse {
    let config = load_config();
    (StatusCode::OK, Json(config))
}

pub async fn save_config(Json(config): Json<SpawnConfig>) -> impl IntoResponse {
    // Ensure config directory exists
    if let Some(parent) = Path::new(CONFIG_FILE).parent() {
        let _ = fs::create_dir_all(parent);
    }

    match fs::write(CONFIG_FILE, serde_json::to_string_pretty(&config).unwrap()) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"success": false, "error": e.to_string()})),
        ),
    }
}

fn load_config() -> SpawnConfig {
    fs::read_to_string(CONFIG_FILE)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| SpawnConfig {
            sandbox_enabled: true,
            sandbox_endpoint: "http://localhost:3080".to_string(),
            sandbox_max_iterations: 10,
            must_rules: vec![
                "Always confirm before deleting files".to_string(),
                "Log all command executions".to_string(),
                "Use relative paths within workspace".to_string(),
            ],
            must_not_rules: vec![
                "rm -rf /".to_string(),
                "sudo commands".to_string(),
                "chmod 777".to_string(),
                "Access outside workspace".to_string(),
            ],
        })
}
