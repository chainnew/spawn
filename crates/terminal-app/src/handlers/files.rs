use crate::{state::AppState, error::ApiError};
use axum::{extract::{Query, State}, Json};
use serde::{Deserialize, Serialize};
use terminal_file::{FileEntry, FileTreeNode};

#[derive(Deserialize)]
pub struct ListQuery {
    pub path: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<FileEntry>>, ApiError> {
    let path = query.path.unwrap_or_else(|| ".".to_string());
    let entries = state.files.list(std::path::Path::new(&path)).await?;
    Ok(Json(entries))
}

#[derive(Deserialize)]
pub struct TreeQuery {
    pub path: Option<String>,
    pub depth: Option<usize>,
}

pub async fn tree(
    State(state): State<AppState>,
    Query(query): Query<TreeQuery>,
) -> Result<Json<FileTreeNode>, ApiError> {
    let path = query.path.unwrap_or_else(|| ".".to_string());
    let depth = query.depth.unwrap_or(3);
    let tree = state.files.tree(std::path::Path::new(&path), depth)?;
    Ok(Json(tree))
}

#[derive(Deserialize)]
pub struct ReadRequest {
    pub path: String,
}

#[derive(Serialize)]
pub struct ReadResponse {
    pub content: String,
    pub size: usize,
}

pub async fn read(
    State(state): State<AppState>,
    Json(req): Json<ReadRequest>,
) -> Result<Json<ReadResponse>, ApiError> {
    let content = state.files.read_string(std::path::Path::new(&req.path)).await?;
    let size = content.len();
    Ok(Json(ReadResponse { content, size }))
}

#[derive(Deserialize)]
pub struct WriteRequest {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct WriteResponse {
    pub success: bool,
    pub bytes_written: usize,
}

pub async fn write_file(
    State(state): State<AppState>,
    Json(req): Json<WriteRequest>,
) -> Result<Json<WriteResponse>, ApiError> {
    let bytes = req.content.as_bytes();
    state.files.write(std::path::Path::new(&req.path), bytes).await?;
    Ok(Json(WriteResponse { success: true, bytes_written: bytes.len() }))
}

#[derive(Deserialize)]
pub struct CreateRequest {
    pub path: String,
    pub content: Option<String>,
}

#[derive(Serialize)]
pub struct CreateResponse {
    pub success: bool,
}

pub async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateRequest>,
) -> Result<Json<CreateResponse>, ApiError> {
    let content = req.content.as_ref().map(|s| s.as_bytes());
    state.files.create(std::path::Path::new(&req.path), content).await?;
    Ok(Json(CreateResponse { success: true }))
}

#[derive(Deserialize)]
pub struct DeleteRequest {
    pub path: String,
    #[serde(default)]
    pub recursive: bool,
}

#[derive(Serialize)]
pub struct DeleteResponse {
    pub success: bool,
}

pub async fn delete_file(
    State(state): State<AppState>,
    Json(req): Json<DeleteRequest>,
) -> Result<Json<DeleteResponse>, ApiError> {
    state.files.delete(std::path::Path::new(&req.path), req.recursive).await?;
    Ok(Json(DeleteResponse { success: true }))
}

#[derive(Deserialize)]
pub struct RenameRequest {
    pub from: String,
    pub to: String,
}

#[derive(Serialize)]
pub struct RenameResponse {
    pub success: bool,
}

pub async fn rename(
    State(state): State<AppState>,
    Json(req): Json<RenameRequest>,
) -> Result<Json<RenameResponse>, ApiError> {
    state.files.rename(std::path::Path::new(&req.from), std::path::Path::new(&req.to)).await?;
    Ok(Json(RenameResponse { success: true }))
}

#[derive(Deserialize)]
pub struct MkdirRequest {
    pub path: String,
    #[serde(default)]
    pub recursive: bool,
}

#[derive(Serialize)]
pub struct MkdirResponse {
    pub success: bool,
}

pub async fn mkdir(
    State(state): State<AppState>,
    Json(req): Json<MkdirRequest>,
) -> Result<Json<MkdirResponse>, ApiError> {
    state.files.mkdir(std::path::Path::new(&req.path), req.recursive).await?;
    Ok(Json(MkdirResponse { success: true }))
}

#[derive(Deserialize)]
pub struct SearchRequest {
    pub pattern: String,
    pub path: Option<String>,
}

pub async fn search(
    State(state): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Json<Vec<FileEntry>> {
    let path = req.path.unwrap_or_else(|| ".".to_string());
    let results = state.files.search(&req.pattern, std::path::Path::new(&path));
    Json(results)
}
