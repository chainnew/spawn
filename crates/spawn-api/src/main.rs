//! spawn-api: The interface
//!
//! Axum server exposing REST and WebSocket endpoints.

mod terminal;
mod files;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use spawn_agents::{Database, Orchestrator};
use spawn_ai::OpenRouterClient;
use spawn_core::{ChatMessage, Config, LlmClient, Mission};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tower_http::services::ServeDir;
use tracing::{info, Level};

// ============================================
// App State
// ============================================

#[derive(Clone)]
pub struct AppState {
    pub orchestrator: Arc<Orchestrator>,
    pub db: Arc<Database>,
    pub workspace_root: std::path::PathBuf,
}

// ============================================
// Main
// ============================================

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env
    dotenvy::dotenv().ok();

    // Setup tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::DEBUG)
        .init();

    info!("🚀 Starting Spawn API");

    // Load config
    let config = Config::from_env()?;

    // Init database
    let db = Arc::new(Database::connect(&config.database_url).await?);
    info!("📦 Database connected");

    // Init LLM client
    let llm = Arc::new(OpenRouterClient::new(&config.openrouter_api_key));
    info!("🤖 LLM client initialized");

    // Init orchestrator
    let orchestrator = Arc::new(Orchestrator::new(db.clone(), llm));

    // Workspace root for file operations
    let workspace_root = std::env::var("WORKSPACE_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
    
    info!("📂 Workspace: {:?}", workspace_root);

    // Build state
    let state = AppState {
        orchestrator,
        db,
        workspace_root,
    };

    // Build router
    let app = Router::new()
        // Health & Info
        .route("/", get(root))
        .route("/health", get(health))
        // Terminal WebSocket
        .route("/ws/terminal", get(terminal::ws_handler))
        // File operations
        .route("/api/files", get(files::list_files))
        .route("/api/files/*path", get(files::read_file))
        .route("/api/files/*path", post(files::write_file))
        // Missions (agent orchestration)
        .route("/api/missions", post(create_mission))
        .route("/api/missions", get(list_missions))
        // Chat (for AI assistant)
        .route("/api/chat", post(chat))
        // Serve static frontend (in production)
        .fallback_service(ServeDir::new("web/dist"))
        // Middleware
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Run server
    let addr = format!("{}:{}", config.server_host, config.server_port);
    info!("🌐 Listening on {}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ============================================
// Handlers
// ============================================

async fn root() -> &'static str {
    "🧠 Spawn API v0.1.0"
}

async fn health() -> &'static str {
    "OK"
}

// --- Missions ---

#[derive(Debug, Deserialize)]
struct CreateMissionRequest {
    goal: String,
    #[serde(default)]
    context: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct CreateMissionResponse {
    mission_id: String,
    status: String,
}

async fn create_mission(
    State(state): State<AppState>,
    Json(payload): Json<CreateMissionRequest>,
) -> impl IntoResponse {
    let mut mission = Mission::new(&payload.goal);
    mission.context = payload.context;

    let mission_id = mission.id.clone();

    // Spawn background task to run the mission
    let orchestrator = state.orchestrator.clone();
    tokio::spawn(async move {
        if let Err(e) = orchestrator.run_mission(mission).await {
            tracing::error!(error = %e, "Mission failed");
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(CreateMissionResponse {
            mission_id,
            status: "started".to_string(),
        }),
    )
}

#[derive(Debug, Serialize)]
struct MissionSummary {
    id: String,
    goal: String,
    status: String,
    created_at: String,
}

async fn list_missions(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.list_missions().await {
        Ok(missions) => {
            let summaries: Vec<MissionSummary> = missions
                .into_iter()
                .map(|m| MissionSummary {
                    id: m.id,
                    goal: m.goal,
                    status: format!("{:?}", m.status).to_lowercase(),
                    created_at: m.created_at.to_rfc3339(),
                })
                .collect();
            (StatusCode::OK, Json(summaries)).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

// --- Chat ---

#[derive(Debug, Deserialize)]
struct ChatRequest {
    message: String,
}

#[derive(Debug, Serialize)]
struct ChatResponse {
    response: String,
}

async fn chat(
    State(state): State<AppState>,
    Json(payload): Json<ChatRequest>,
) -> impl IntoResponse {
    use spawn_core::ChatMessage;

    // Simple single-turn chat
    let messages = vec![
        ChatMessage::system("You are a helpful coding assistant for spawn.new. Help users build software."),
        ChatMessage::user(&payload.message),
    ];

    // Get LLM from orchestrator (TODO: expose this better)
    let llm = spawn_ai::OpenRouterClient::new(
        std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
    );

    match llm.chat("anthropic/claude-sonnet-4-20250514", &messages).await {
        Ok(response) => (StatusCode::OK, Json(ChatResponse { response })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ChatResponse {
                response: format!("Error: {}", e),
            }),
        )
            .into_response(),
    }
}
