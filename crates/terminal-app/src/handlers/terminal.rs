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
    let terminals = state.sessions.list_sessions().await;
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
    state.sessions.get_session(id).await
        .map(Json)
        .ok_or(ApiError::NotFound(format!("Terminal {}", id)))
}

pub async fn get_by_name(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<TerminalSession>, ApiError> {
    state.sessions.get_session_by_name(&name).await
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
pub struct ExecRequest {
    pub command: String,
}

#[derive(Serialize)]
pub struct ExecResponse {
    pub success: bool,
}

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
    let id = state.sessions.resolve_name(&name).await
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

fn default_timeout() -> u64 {
    30000
}

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
pub struct WriteRequest {
    pub data: String,
}

pub async fn write(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<WriteRequest>,
) -> Result<Json<()>, ApiError> {
    state.sessions.write(id, req.data.as_bytes()).await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct ResizeRequest {
    pub cols: u16,
    pub rows: u16,
}

pub async fn resize(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ResizeRequest>,
) -> Result<Json<()>, ApiError> {
    state.sessions.resize(id, req.cols, req.rows).await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct BufferQuery {
    pub lines: Option<usize>,
}

#[derive(Serialize)]
pub struct BufferResponse {
    pub lines: Vec<String>,
    pub total: usize,
}

pub async fn get_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<BufferQuery>,
) -> Result<Json<BufferResponse>, ApiError> {
    let lines = state.sessions.get_buffer(id, query.lines).await?;
    Ok(Json(BufferResponse { total: lines.len(), lines }))
}

pub async fn flush_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, ApiError> {
    state.sessions.flush_buffer(id).await?;
    Ok(Json(()))
}
