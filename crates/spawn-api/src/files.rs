//! File operations handler
//!
//! REST endpoints for file explorer functionality

use axum::{
    body::Body,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tracing::{debug, error, info};

use crate::AppState;

// ============================================
// Types
// ============================================

#[derive(Debug, Serialize)]
pub struct FileNode {
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String, // "file" or "directory"
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub content: String,
}

// ============================================
// Handlers
// ============================================

/// List files in workspace root
pub async fn list_files(State(state): State<AppState>) -> impl IntoResponse {
    info!("📂 Listing files in workspace");

    match build_file_tree(&state.workspace_root, 0, 3).await {
        Ok(tree) => (StatusCode::OK, Json(tree)).into_response(),
        Err(e) => {
            error!("Failed to list files: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

/// Read a file
pub async fn read_file(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> impl IntoResponse {
    let file_path = state.workspace_root.join(&path);

    debug!("📄 Reading file: {:?}", file_path);

    // Security: ensure path is within workspace
    if !file_path.starts_with(&state.workspace_root) {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    if !file_path.exists() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    if file_path.is_dir() {
        // Return directory listing as JSON
        match build_file_tree(&file_path, 0, 2).await {
            Ok(tree) => return (StatusCode::OK, Json(tree)).into_response(),
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        }
    }

    // Read file content
    match fs::read_to_string(&file_path).await {
        Ok(content) => (StatusCode::OK, content).into_response(),
        Err(e) => {
            // Try reading as binary
            match fs::read(&file_path).await {
                Ok(bytes) => {
                    // Return base64 for binary files
                    use base64::{engine::general_purpose::STANDARD, Engine};
                    let encoded = STANDARD.encode(&bytes);
                    (
                        StatusCode::OK,
                        Json(serde_json::json!({
                            "binary": true,
                            "content": encoded
                        })),
                    )
                        .into_response()
                }
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
            }
        }
    }
}

/// Write a file
pub async fn write_file(
    State(state): State<AppState>,
    Path(path): Path<String>,
    Json(payload): Json<WriteFileRequest>,
) -> impl IntoResponse {
    let file_path = state.workspace_root.join(&path);

    debug!("💾 Writing file: {:?}", file_path);

    // Security: ensure path is within workspace
    if !file_path.starts_with(&state.workspace_root) {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        if let Err(e) = fs::create_dir_all(parent).await {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }

    // Write file
    match fs::write(&file_path, &payload.content).await {
        Ok(_) => {
            info!("✅ File written: {:?}", file_path);
            (
                StatusCode::OK,
                Json(serde_json::json!({ "success": true, "path": path })),
            )
                .into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

// ============================================
// Helpers
// ============================================

/// Build file tree recursively
async fn build_file_tree(
    path: &PathBuf,
    depth: usize,
    max_depth: usize,
) -> anyhow::Result<Vec<FileNode>> {
    let mut nodes = Vec::new();

    let mut entries = fs::read_dir(path).await?;

    while let Some(entry) = entries.next_entry().await? {
        let entry_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and common ignored directories
        if file_name.starts_with('.') 
            || file_name == "node_modules"
            || file_name == "target"
            || file_name == "__pycache__"
            || file_name == ".git"
        {
            continue;
        }

        let metadata = entry.metadata().await?;
        let is_dir = metadata.is_dir();

        let relative_path = entry_path
            .strip_prefix(path.ancestors().last().unwrap_or(path))
            .unwrap_or(&entry_path)
            .to_string_lossy()
            .to_string();

        let children = if is_dir && depth < max_depth {
            Some(Box::pin(build_file_tree(&entry_path, depth + 1, max_depth)).await?)
        } else if is_dir {
            Some(vec![]) // Indicate it has children but don't load them
        } else {
            None
        };

        nodes.push(FileNode {
            name: file_name,
            file_type: if is_dir { "directory" } else { "file" }.to_string(),
            path: relative_path,
            children,
            size: if !is_dir { Some(metadata.len()) } else { None },
        });
    }

    // Sort: directories first, then files, alphabetically
    nodes.sort_by(|a, b| {
        match (&a.file_type[..], &b.file_type[..]) {
            ("directory", "file") => std::cmp::Ordering::Less,
            ("file", "directory") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}
