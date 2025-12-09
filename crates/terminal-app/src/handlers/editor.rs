use crate::{state::AppState, error::ApiError};
use axum::{extract::{Path, State}, Json};
use serde::{Deserialize, Serialize};
use terminal_code_editor::EditorBuffer;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct OpenRequest {
    pub path: String,
}

pub async fn open(
    State(state): State<AppState>,
    Json(req): Json<OpenRequest>,
) -> Result<Json<EditorBuffer>, ApiError> {
    let buffer = state.editor.open(std::path::Path::new(&req.path)).await?;
    Ok(Json(buffer))
}

#[derive(Deserialize)]
pub struct SaveRequest {
    pub id: Uuid,
}

#[derive(Serialize)]
pub struct SaveResponse {
    pub success: bool,
}

pub async fn save(
    State(state): State<AppState>,
    Json(req): Json<SaveRequest>,
) -> Result<Json<SaveResponse>, ApiError> {
    state.editor.save(req.id).await?;
    Ok(Json(SaveResponse { success: true }))
}

pub async fn list_buffers(State(state): State<AppState>) -> Json<Vec<EditorBuffer>> {
    Json(state.editor.list_buffers())
}

#[derive(Serialize)]
pub struct BufferContentResponse {
    pub buffer: EditorBuffer,
    pub content: String,
}

pub async fn get_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BufferContentResponse>, ApiError> {
    let buffer = state.editor.get_buffer(id)
        .ok_or(ApiError::NotFound(format!("Buffer {}", id)))?;
    let content = state.editor.get_content(id)
        .ok_or(ApiError::NotFound(format!("Buffer content {}", id)))?;
    Ok(Json(BufferContentResponse { buffer, content }))
}

#[derive(Deserialize)]
pub struct UpdateBufferRequest {
    pub content: String,
}

#[derive(Serialize)]
pub struct UpdateBufferResponse {
    pub success: bool,
}

pub async fn update_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateBufferRequest>,
) -> Result<Json<UpdateBufferResponse>, ApiError> {
    if state.editor.set_content(id, &req.content) {
        Ok(Json(UpdateBufferResponse { success: true }))
    } else {
        Err(ApiError::NotFound(format!("Buffer {}", id)))
    }
}

#[derive(Serialize)]
pub struct CloseBufferResponse {
    pub success: bool,
}

pub async fn close_buffer(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CloseBufferResponse>, ApiError> {
    if state.editor.close(id) {
        Ok(Json(CloseBufferResponse { success: true }))
    } else {
        Err(ApiError::NotFound(format!("Buffer {}", id)))
    }
}
