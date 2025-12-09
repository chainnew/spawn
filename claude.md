# SCOPE: Rust Terminal Suite for spawn.new

## Overview

Build a modular Rust terminal application with integrated code editor, file explorer, and WebRTC support. The system exposes API endpoints for AI agents to programmatically interact with terminals, edit files, and manage workspace.

---

## Crate Architecture

```
/crates/
├── terminal-core/        # Core PTY handling, session management
├── terminal-app/         # Main application, HTTP/WS server
├── terminal-code-editor/ # Code editing, syntax highlighting, LSP
├── terminal-file/        # File system operations, tree, watcher
└── terminal-webrtc/      # WebRTC signaling and peer connections
```

---

## Crate 1: terminal-core

**Purpose:** Core terminal emulation, PTY management, session handling

### Cargo.toml
```toml
[package]
name = "terminal-core"
version = "0.1.0"
edition = "2021"

[dependencies]
portable-pty = "0.8"
vte = "0.13"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
thiserror = "1"
parking_lot = "0.12"
```

### src/lib.rs
```rust
pub mod pty;
pub mod session;
pub mod buffer;
pub mod error;

pub use session::{SessionManager, TerminalSession, SessionConfig, SessionStatus};
pub use buffer::TerminalBuffer;
pub use error::TerminalError;
```

### src/error.rs
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TerminalError {
    #[error("PTY error: {0}")]
    Pty(String),
    
    #[error("Session not found: {0}")]
    SessionNotFound(uuid::Uuid),
    
    #[error("Session name not found: {0}")]
    SessionNameNotFound(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Session already exists: {0}")]
    SessionExists(String),
    
    #[error("Max sessions reached")]
    MaxSessions,
    
    #[error("Timeout waiting for output")]
    Timeout,
}
```

### src/session.rs
```rust
use crate::{pty::PtyHandle, buffer::TerminalBuffer, TerminalError};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: Uuid,
    pub name: String,
    pub cwd: PathBuf,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub created_at: DateTime<Utc>,
    pub status: SessionStatus,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionStatus {
    Starting,
    Running,
    Idle,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub name: String,
    pub cwd: Option<PathBuf>,
    pub shell: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub env: Option<HashMap<String, String>>,
}

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, SessionInner>>>,
    name_index: Arc<RwLock<HashMap<String, Uuid>>>,
    max_sessions: usize,
    default_shell: String,
    workspace_root: PathBuf,
}

struct SessionInner {
    pub info: TerminalSession,
    pub handle: PtyHandle,
    pub buffer: TerminalBuffer,
}

impl SessionManager {
    pub fn new(workspace_root: PathBuf, max_sessions: usize) -> Self {
        let default_shell = std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/bash".to_string());
        
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            name_index: Arc::new(RwLock::new(HashMap::new())),
            max_sessions,
            default_shell,
            workspace_root,
        }
    }

    pub async fn create_session(&self, config: SessionConfig) -> Result<TerminalSession, TerminalError> {
        if self.sessions.read().len() >= self.max_sessions {
            return Err(TerminalError::MaxSessions);
        }
        
        if self.name_index.read().contains_key(&config.name) {
            return Err(TerminalError::SessionExists(config.name));
        }

        let id = Uuid::new_v4();
        let shell = config.shell.unwrap_or_else(|| self.default_shell.clone());
        let cwd = config.cwd.unwrap_or_else(|| self.workspace_root.clone());
        let cols = config.cols.unwrap_or(120);
        let rows = config.rows.unwrap_or(40);
        let env = config.env.unwrap_or_default();

        let handle = crate::pty::spawn_pty(&shell, &cwd, cols, rows, env).await?;
        let pid = handle.child_pid();

        let session = TerminalSession {
            id,
            name: config.name.clone(),
            cwd,
            shell,
            cols,
            rows,
            created_at: Utc::now(),
            status: SessionStatus::Running,
            pid,
        };

        let inner = SessionInner {
            info: session.clone(),
            handle,
            buffer: TerminalBuffer::new(10000),
        };

        self.sessions.write().insert(id, inner);
        self.name_index.write().insert(config.name, id);

        Ok(session)
    }

    pub fn get_session(&self, id: Uuid) -> Option<TerminalSession> {
        self.sessions.read().get(&id).map(|s| s.info.clone())
    }

    pub fn get_session_by_name(&self, name: &str) -> Option<TerminalSession> {
        let id = self.name_index.read().get(name).copied()?;
        self.get_session(id)
    }

    pub fn resolve_name(&self, name: &str) -> Option<Uuid> {
        self.name_index.read().get(name).copied()
    }

    pub async fn exec(&self, id: Uuid, command: &str) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        
        let cmd = format!("{}\n", command);
        session.handle.write(cmd.as_bytes()).await?;
        Ok(())
    }

    pub async fn exec_wait(&self, id: Uuid, command: &str, timeout: Duration) -> Result<String, TerminalError> {
        self.exec(id, command).await?;
        
        let start = std::time::Instant::now();
        let mut output = String::new();
        
        while start.elapsed() < timeout {
            tokio::time::sleep(Duration::from_millis(50)).await;
            
            let sessions = self.sessions.read();
            if let Some(session) = sessions.get(&id) {
                let new_output = session.buffer.get_recent(100);
                if !new_output.is_empty() {
                    output = new_output.join("\n");
                }
            }
        }
        
        Ok(output)
    }

    pub async fn write(&self, id: Uuid, data: &[u8]) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        session.handle.write(data).await?;
        Ok(())
    }

    pub async fn resize(&self, id: Uuid, cols: u16, rows: u16) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        session.handle.resize(cols, rows)?;
        session.info.cols = cols;
        session.info.rows = rows;
        Ok(())
    }

    pub async fn kill(&self, id: Uuid) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write();
        let session = sessions.remove(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        
        self.name_index.write().remove(&session.info.name);
        drop(session.handle);
        Ok(())
    }

    pub fn list_sessions(&self) -> Vec<TerminalSession> {
        self.sessions.read().values().map(|s| s.info.clone()).collect()
    }

    pub fn flush_buffer(&self, id: Uuid) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        session.buffer.clear();
        Ok(())
    }

    pub fn get_buffer(&self, id: Uuid, lines: Option<usize>) -> Result<Vec<String>, TerminalError> {
        let sessions = self.sessions.read();
        let session = sessions.get(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        
        Ok(match lines {
            Some(n) => session.buffer.get_recent(n),
            None => session.buffer.get_all(),
        })
    }
}
```

### src/pty.rs
```rust
use crate::TerminalError;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{collections::HashMap, io::{Read, Write}, path::Path, sync::Arc};
use tokio::sync::Mutex;

pub struct PtyHandle {
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl PtyHandle {
    pub fn child_pid(&self) -> Option<u32> {
        self.child.process_id()
    }

    pub async fn write(&mut self, data: &[u8]) -> Result<usize, TerminalError> {
        let mut writer = self.writer.lock().await;
        writer.write(data).map_err(TerminalError::Io)
    }

    pub async fn read(&mut self, buf: &mut [u8]) -> Result<usize, TerminalError> {
        let mut reader = self.reader.lock().await;
        reader.read(buf).map_err(TerminalError::Io)
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), TerminalError> {
        self.master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| TerminalError::Pty(e.to_string()))
    }

    pub fn try_clone_reader(&self) -> Arc<Mutex<Box<dyn Read + Send>>> {
        Arc::clone(&self.reader)
    }
}

pub async fn spawn_pty(
    shell: &str,
    cwd: &Path,
    cols: u16,
    rows: u16,
    env: HashMap<String, String>,
) -> Result<PtyHandle, TerminalError> {
    let pty_system = native_pty_system();
    
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(cwd);
    
    for (key, value) in env {
        cmd.env(key, value);
    }

    let child = pair.slave
        .spawn_command(cmd)
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let reader = pair.master
        .try_clone_reader()
        .map_err(|e| TerminalError::Pty(e.to_string()))?;
    
    let writer = pair.master
        .take_writer()
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    Ok(PtyHandle {
        master: pair.master,
        child,
        reader: Arc::new(Mutex::new(reader)),
        writer: Arc::new(Mutex::new(writer)),
    })
}
```

### src/buffer.rs
```rust
use std::collections::VecDeque;

pub struct TerminalBuffer {
    lines: VecDeque<String>,
    max_lines: usize,
    current_line: String,
}

impl TerminalBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            lines: VecDeque::with_capacity(max_lines),
            max_lines,
            current_line: String::new(),
        }
    }

    pub fn push(&mut self, data: &[u8]) {
        for byte in data {
            if *byte == b'\n' {
                self.lines.push_back(std::mem::take(&mut self.current_line));
                if self.lines.len() > self.max_lines {
                    self.lines.pop_front();
                }
            } else if *byte != b'\r' {
                self.current_line.push(*byte as char);
            }
        }
    }

    pub fn get_all(&self) -> Vec<String> {
        self.lines.iter().cloned().collect()
    }

    pub fn get_recent(&self, n: usize) -> Vec<String> {
        self.lines.iter().rev().take(n).rev().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.lines.clear();
        self.current_line.clear();
    }

    pub fn len(&self) -> usize {
        self.lines.len()
    }
}
```

---

## Crate 2: terminal-app

**Purpose:** HTTP/WebSocket server exposing terminal functionality

### Cargo.toml
```toml
[package]
name = "terminal-app"
version = "0.1.0"
edition = "2021"

[dependencies]
terminal-core = { path = "../terminal-core" }
terminal-code-editor = { path = "../terminal-code-editor" }
terminal-file = { path = "../terminal-file" }
terminal-webrtc = { path = "../terminal-webrtc" }

axum = { version = "0.7", features = ["ws", "macros"] }
axum-extra = "0.9"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"
futures = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1", features = ["v4", "serde"] }
dotenvy = "0.15"
```

### src/main.rs
```rust
mod state;
mod routes;
mod handlers;
mod error;

use state::AppState;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "terminal_app=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState::from_env();
    let app = routes::create_router(state);

    let host = std::env::var("TERMINAL_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = std::env::var("TERMINAL_PORT")
        .unwrap_or_else(|_| "3001".into())
        .parse()
        .expect("Invalid port");
    
    let addr = SocketAddr::new(host.parse().unwrap(), port);
    tracing::info!("Terminal server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

### src/state.rs
```rust
use std::{path::PathBuf, sync::Arc};
use terminal_core::SessionManager;
use terminal_code_editor::EditorManager;
use terminal_file::FileManager;
use terminal_webrtc::WebRtcManager;

#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<SessionManager>,
    pub editor: Arc<EditorManager>,
    pub files: Arc<FileManager>,
    pub webrtc: Arc<WebRtcManager>,
}

impl AppState {
    pub fn from_env() -> Self {
        let workspace = std::env::var("TERMINAL_WORKSPACE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/home/spawn/spawn"));
        
        let max_sessions: usize = std::env::var("TERMINAL_MAX_SESSIONS")
            .unwrap_or_else(|_| "10".into())
            .parse()
            .unwrap_or(10);

        Self {
            sessions: Arc::new(SessionManager::new(workspace.clone(), max_sessions)),
            editor: Arc::new(EditorManager::new()),
            files: Arc::new(FileManager::new(workspace)),
            webrtc: Arc::new(WebRtcManager::new()),
        }
    }
}
```

### src/routes.rs
```rust
use crate::{state::AppState, handlers};
use axum::{routing::{get, post, put, delete}, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health))
        
        // TERMINAL API
        .route("/api/terminals", get(handlers::terminal::list))
        .route("/api/terminals", post(handlers::terminal::create))
        .route("/api/terminals/:id", get(handlers::terminal::get))
        .route("/api/terminals/:id", delete(handlers::terminal::kill))
        .route("/api/terminals/:id/exec", post(handlers::terminal::exec))
        .route("/api/terminals/:id/exec/wait", post(handlers::terminal::exec_wait))
        .route("/api/terminals/:id/write", post(handlers::terminal::write))
        .route("/api/terminals/:id/resize", post(handlers::terminal::resize))
        .route("/api/terminals/:id/buffer", get(handlers::terminal::get_buffer))
        .route("/api/terminals/:id/buffer", delete(handlers::terminal::flush_buffer))
        .route("/api/terminals/by-name/:name", get(handlers::terminal::get_by_name))
        .route("/api/terminals/by-name/:name/exec", post(handlers::terminal::exec_by_name))
        
        // EDITOR API
        .route("/api/editor/open", post(handlers::editor::open))
        .route("/api/editor/save", post(handlers::editor::save))
        .route("/api/editor/buffers", get(handlers::editor::list_buffers))
        .route("/api/editor/buffers/:id", get(handlers::editor::get_buffer))
        .route("/api/editor/buffers/:id", put(handlers::editor::update_buffer))
        .route("/api/editor/buffers/:id", delete(handlers::editor::close_buffer))
        
        // FILE API
        .route("/api/files", get(handlers::files::list))
        .route("/api/files/tree", get(handlers::files::tree))
        .route("/api/files/read", post(handlers::files::read))
        .route("/api/files/write", post(handlers::files::write))
        .route("/api/files/create", post(handlers::files::create))
        .route("/api/files/delete", post(handlers::files::delete_file))
        .route("/api/files/rename", post(handlers::files::rename))
        .route("/api/files/mkdir", post(handlers::files::mkdir))
        .route("/api/files/search", post(handlers::files::search))
        
        // WEBSOCKET
        .route("/ws/terminal/:id", get(handlers::ws::terminal_handler))
        .route("/ws/files", get(handlers::ws::file_watcher_handler))
        
        // WEBRTC
        .route("/api/webrtc/offer", post(handlers::webrtc::handle_offer))
        .route("/api/webrtc/answer", post(handlers::webrtc::handle_answer))
        .route("/ws/webrtc/:peer_id", get(handlers::ws::webrtc_signaling))
        
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
```

### src/handlers/mod.rs
```rust
pub mod terminal;
pub mod editor;
pub mod files;
pub mod ws;
pub mod webrtc;

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}
```

### src/handlers/terminal.rs
```rust
use crate::{state::AppState, error::ApiError};
use axum::{extract::{Path, Query, State}, Json};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use terminal_core::{SessionConfig, TerminalSession};
use uuid::Uuid;

#[derive(Serialize)]
pub struct ListResponse {
    pub terminals: Vec<TerminalSession>,
    pub count: usize,
}

pub async fn list(State(state): State<AppState>) -> Json<ListResponse> {
    let terminals = state.sessions.list_sessions();
    Json(ListResponse { count: terminals.len(), terminals })
}

#[derive(Deserialize)]
pub struct CreateRequest {
    pub name: String,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

pub async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateRequest>,
) -> Result<Json<TerminalSession>, ApiError> {
    let config = SessionConfig {
        name: req.name,
        cwd: req.cwd.map(Into::into),
        shell: req.shell,
        cols: req.cols,
        rows: req.rows,
        env: Some(req.env),
    };
    let session = state.sessions.create_session(config).await?;
    Ok(Json(session))
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TerminalSession>, ApiError> {
    state.sessions.get_session(id)
        .map(Json)
        .ok_or(ApiError::NotFound(format!("Terminal {}", id)))
}

pub async fn get_by_name(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<TerminalSession>, ApiError> {
    state.sessions.get_session_by_name(&name)
        .map(Json)
        .ok_or(ApiError::NotFound(format!("Terminal '{}'", name)))
}

pub async fn kill(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, ApiError> {
    state.sessions.kill(id).await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct ExecRequest { pub command: String }

#[derive(Serialize)]
pub struct ExecResponse { pub success: bool }

pub async fn exec(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    state.sessions.exec(id, &req.command).await?;
    Ok(Json(ExecResponse { success: true }))
}

pub async fn exec_by_name(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResponse>, ApiError> {
    let id = state.sessions.resolve_name(&name)
        .ok_or(ApiError::NotFound(format!("Terminal '{}'", name)))?;
    state.sessions.exec(id, &req.command).await?;
    Ok(Json(ExecResponse { success: true }))
}

#[derive(Deserialize)]
pub struct ExecWaitRequest {
    pub command: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}
fn default_timeout() -> u64 { 30000 }

#[derive(Serialize)]
pub struct ExecWaitResponse {
    pub output: String,
    pub duration_ms: u64,
}

pub async fn exec_wait(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ExecWaitRequest>,
) -> Result<Json<ExecWaitResponse>, ApiError> {
    let start = std::time::Instant::now();
    let output = state.sessions.exec_wait(id, &req.command, Duration::from_millis(req.timeout_ms)).await?;
    Ok(Json(ExecWaitResponse {
        output,
        duration_ms: start.elapsed().as_millis() as u64,
    }))
}

#[derive(Deserialize)]
pub struct WriteRequest { pub data: String }

pub async fn write(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<WriteRequest>,
) -> Result<Json<()>, ApiError> {
    state.sessions.write(id, req.data.as_bytes()).await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct ResizeRequest { pub cols: u16, pub rows: u16 }

pub async fn resize(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ResizeRequest>,
) -> Result<Json<()>, ApiError> {
    state.sessions.resize(id, req.cols, req.rows).await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct BufferQuery { pub lines: Option<usize> }

#[derive(Serialize)]
pub struct BufferResponse { pub lines: Vec<String>, pub total: usize }

pub async fn get_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<BufferQuery>,
) -> Result<Json<BufferResponse>, ApiError> {
    let lines = state.sessions.get_buffer(id, query.lines)?;
    Ok(Json(BufferResponse { total: lines.len(), lines }))
}

pub async fn flush_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, ApiError> {
    state.sessions.flush_buffer(id)?;
    Ok(Json(()))
}
```

### src/error.rs
```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
    Terminal(terminal_core::TerminalError),
}

impl From<terminal_core::TerminalError> for ApiError {
    fn from(err: terminal_core::TerminalError) -> Self {
        ApiError::Terminal(err)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            ApiError::Terminal(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

---

## Crate 3: terminal-code-editor

### Cargo.toml
```toml
[package]
name = "terminal-code-editor"
version = "0.1.0"
edition = "2021"

[dependencies]
ropey = "1"
tokio = { version = "1", features = ["fs"] }
serde = { version = "1", features = ["derive"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
parking_lot = "0.12"
```

### src/lib.rs
```rust
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::{Path, PathBuf}, sync::Arc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorBuffer {
    pub id: Uuid,
    pub path: Option<PathBuf>,
    pub name: String,
    pub language: Language,
    pub modified: bool,
    pub line_count: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum Language {
    Rust, JavaScript, TypeScript, Python, Json, Toml, Markdown, Html, Css, Shell, Unknown,
}

impl Language {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => Language::Rust,
            "js" | "mjs" => Language::JavaScript,
            "ts" | "tsx" => Language::TypeScript,
            "py" => Language::Python,
            "json" => Language::Json,
            "toml" => Language::Toml,
            "md" => Language::Markdown,
            "html" => Language::Html,
            "css" => Language::Css,
            "sh" | "bash" => Language::Shell,
            _ => Language::Unknown,
        }
    }
}

struct BufferInner {
    pub info: EditorBuffer,
    pub rope: Rope,
}

pub struct EditorManager {
    buffers: Arc<RwLock<HashMap<Uuid, BufferInner>>>,
    path_index: Arc<RwLock<HashMap<PathBuf, Uuid>>>,
}

impl EditorManager {
    pub fn new() -> Self {
        Self {
            buffers: Arc::new(RwLock::new(HashMap::new())),
            path_index: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn open(&self, path: &Path) -> Result<EditorBuffer, std::io::Error> {
        if let Some(&id) = self.path_index.read().get(path) {
            if let Some(b) = self.buffers.read().get(&id) {
                return Ok(b.info.clone());
            }
        }

        let content = tokio::fs::read_to_string(path).await?;
        let id = Uuid::new_v4();
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or("untitled".into());
        let language = path.extension().map(|e| Language::from_extension(&e.to_string_lossy())).unwrap_or(Language::Unknown);
        let rope = Rope::from_str(&content);

        let info = EditorBuffer {
            id, path: Some(path.to_path_buf()), name, language,
            modified: false, line_count: rope.len_lines(),
        };

        self.buffers.write().insert(id, BufferInner { info: info.clone(), rope });
        self.path_index.write().insert(path.to_path_buf(), id);
        Ok(info)
    }

    pub fn get_content(&self, id: Uuid) -> Option<String> {
        self.buffers.read().get(&id).map(|b| b.rope.to_string())
    }

    pub fn set_content(&self, id: Uuid, content: &str) -> bool {
        if let Some(b) = self.buffers.write().get_mut(&id) {
            b.rope = Rope::from_str(content);
            b.info.modified = true;
            b.info.line_count = b.rope.len_lines();
            true
        } else { false }
    }

    pub async fn save(&self, id: Uuid) -> Result<(), std::io::Error> {
        let (path, content) = {
            let buffers = self.buffers.read();
            let b = buffers.get(&id).ok_or(std::io::Error::new(std::io::ErrorKind::NotFound, "Buffer not found"))?;
            (b.info.path.clone().ok_or(std::io::Error::new(std::io::ErrorKind::InvalidInput, "No path"))?, b.rope.to_string())
        };
        tokio::fs::write(&path, content).await?;
        if let Some(b) = self.buffers.write().get_mut(&id) { b.info.modified = false; }
        Ok(())
    }

    pub fn close(&self, id: Uuid) -> bool {
        if let Some(b) = self.buffers.write().remove(&id) {
            if let Some(p) = &b.info.path { self.path_index.write().remove(p); }
            true
        } else { false }
    }

    pub fn list_buffers(&self) -> Vec<EditorBuffer> {
        self.buffers.read().values().map(|b| b.info.clone()).collect()
    }
}

impl Default for EditorManager { fn default() -> Self { Self::new() } }
```

---

## Crate 4: terminal-file

### Cargo.toml
```toml
[package]
name = "terminal-file"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full", "fs"] }
walkdir = "2"
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
```

### src/lib.rs
```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub entry: FileEntry,
    pub children: Vec<FileTreeNode>,
}

pub struct FileManager {
    root: PathBuf,
}

impl FileManager {
    pub fn new(root: PathBuf) -> Self { Self { root } }

    fn resolve(&self, path: &Path) -> PathBuf {
        if path.is_absolute() { path.to_path_buf() } else { self.root.join(path) }
    }

    pub async fn list(&self, path: &Path) -> Result<Vec<FileEntry>, std::io::Error> {
        let full = self.resolve(path);
        let mut entries = Vec::new();
        let mut dir = tokio::fs::read_dir(&full).await?;
        while let Some(e) = dir.next_entry().await? {
            let m = e.metadata().await?;
            entries.push(FileEntry {
                path: e.path(),
                name: e.file_name().to_string_lossy().to_string(),
                is_dir: m.is_dir(),
                is_file: m.is_file(),
                size: m.len(),
                modified: m.modified().ok().map(DateTime::<Utc>::from),
            });
        }
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        });
        Ok(entries)
    }

    pub fn tree(&self, path: &Path, depth: usize) -> Result<FileTreeNode, std::io::Error> {
        self.build_tree(&self.resolve(path), 0, depth)
    }

    fn build_tree(&self, path: &Path, d: usize, max: usize) -> Result<FileTreeNode, std::io::Error> {
        let m = std::fs::metadata(path)?;
        let entry = FileEntry {
            path: path.to_path_buf(),
            name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or("/".into()),
            is_dir: m.is_dir(), is_file: m.is_file(), size: m.len(),
            modified: m.modified().ok().map(DateTime::<Utc>::from),
        };
        let children = if m.is_dir() && d < max {
            std::fs::read_dir(path)?.flatten()
                .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .filter(|e| e.file_name() != "node_modules" && e.file_name() != "target")
                .filter_map(|e| self.build_tree(&e.path(), d + 1, max).ok())
                .collect()
        } else { Vec::new() };
        Ok(FileTreeNode { entry, children })
    }

    pub async fn read(&self, path: &Path) -> Result<Vec<u8>, std::io::Error> {
        tokio::fs::read(self.resolve(path)).await
    }

    pub async fn read_string(&self, path: &Path) -> Result<String, std::io::Error> {
        tokio::fs::read_to_string(self.resolve(path)).await
    }

    pub async fn write(&self, path: &Path, content: &[u8]) -> Result<(), std::io::Error> {
        tokio::fs::write(self.resolve(path), content).await
    }

    pub async fn create(&self, path: &Path, content: Option<&[u8]>) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if let Some(p) = full.parent() { tokio::fs::create_dir_all(p).await?; }
        tokio::fs::write(&full, content.unwrap_or(&[])).await
    }

    pub async fn delete(&self, path: &Path, recursive: bool) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if full.is_dir() {
            if recursive { tokio::fs::remove_dir_all(&full).await }
            else { tokio::fs::remove_dir(&full).await }
        } else { tokio::fs::remove_file(&full).await }
    }

    pub async fn rename(&self, from: &Path, to: &Path) -> Result<(), std::io::Error> {
        tokio::fs::rename(self.resolve(from), self.resolve(to)).await
    }

    pub async fn mkdir(&self, path: &Path, recursive: bool) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if recursive { tokio::fs::create_dir_all(&full).await }
        else { tokio::fs::create_dir(&full).await }
    }

    pub fn search(&self, pattern: &str, path: &Path) -> Vec<FileEntry> {
        let pat = pattern.to_lowercase();
        WalkDir::new(self.resolve(path)).into_iter().flatten()
            .filter(|e| e.file_name().to_string_lossy().to_lowercase().contains(&pat))
            .take(100)
            .filter_map(|e| {
                let m = e.metadata().ok()?;
                Some(FileEntry {
                    path: e.path().to_path_buf(),
                    name: e.file_name().to_string_lossy().to_string(),
                    is_dir: m.is_dir(), is_file: m.is_file(), size: m.len(),
                    modified: m.modified().ok().map(DateTime::<Utc>::from),
                })
            }).collect()
    }
}
```

---

## Crate 5: terminal-webrtc (Stub)

### Cargo.toml
```toml
[package]
name = "terminal-webrtc"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

### src/lib.rs
```rust
use uuid::Uuid;

pub struct WebRtcManager;

impl WebRtcManager {
    pub fn new() -> Self { Self }
    pub async fn create_peer(&self) -> Uuid { Uuid::new_v4() }
    pub async fn create_offer(&self, _: Uuid) -> Result<String, String> { Ok("{}".into()) }
    pub async fn handle_offer(&self, _: Uuid, _: &str) -> Result<String, String> { Ok("{}".into()) }
    pub async fn handle_answer(&self, _: Uuid, _: &str) -> Result<(), String> { Ok(()) }
}

impl Default for WebRtcManager { fn default() -> Self { Self::new() } }
```

---

## API Summary for Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/terminals` | List all terminals |
| `POST` | `/api/terminals` | Create terminal |
| `GET` | `/api/terminals/:id` | Get terminal info |
| `DELETE` | `/api/terminals/:id` | Kill terminal |
| `POST` | `/api/terminals/:id/exec` | Execute command |
| `POST` | `/api/terminals/:id/exec/wait` | Execute & wait |
| `POST` | `/api/terminals/:id/write` | Write raw input |
| `POST` | `/api/terminals/:id/resize` | Resize |
| `GET` | `/api/terminals/:id/buffer` | Get output |
| `DELETE` | `/api/terminals/:id/buffer` | Flush buffer |
| `GET` | `/api/terminals/by-name/:name` | Get by name |
| `POST` | `/api/terminals/by-name/:name/exec` | Exec by name |
| `POST` | `/api/editor/open` | Open file |
| `POST` | `/api/editor/save` | Save buffer |
| `GET` | `/api/editor/buffers` | List buffers |
| `GET` | `/api/files` | List directory |
| `GET` | `/api/files/tree` | File tree |
| `POST` | `/api/files/read` | Read file |
| `POST` | `/api/files/write` | Write file |
| `WS` | `/ws/terminal/:id` | Terminal stream |

---

## Environment Variables

```bash
TERMINAL_HOST=0.0.0.0
TERMINAL_PORT=3001
TERMINAL_WORKSPACE=/home/spawn/spawn
TERMINAL_MAX_SESSIONS=10
RUST_LOG=terminal_app=debug
```

---

## Build & Run

```bash
cd /home/spawn/spawn
cargo build -p terminal-app
cargo run -p terminal-app
# Listening on http://0.0.0.0:3001
```
