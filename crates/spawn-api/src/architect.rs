//! ARCHITECT - AI Development Agent Integration
//!
//! Provides Rust-native tool execution for the ARCHITECT agent,
//! integrating with terminal-app, file system, and mission orchestration.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

const TERMINAL_API: &str = "http://localhost:3001";

// ============================================
// Tool Execution API
// ============================================

#[derive(Debug, Deserialize)]
pub struct ExecCommandRequest {
    pub command: String,
    pub cwd: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ExecCommandResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

/// Execute a command in the workspace (Rust-native, no sandbox needed)
pub async fn exec_command(
    State(state): State<AppState>,
    Json(req): Json<ExecCommandRequest>,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    let cwd = req.cwd
        .map(|p| state.workspace_root.join(p))
        .unwrap_or_else(|| state.workspace_root.clone());

    let timeout = std::time::Duration::from_millis(req.timeout_ms.unwrap_or(30000));

    let result = tokio::time::timeout(timeout, async {
        tokio::process::Command::new("bash")
            .arg("-c")
            .arg(&req.command)
            .current_dir(&cwd)
            .output()
            .await
    }).await;

    match result {
        Ok(Ok(output)) => {
            let response = ExecCommandResponse {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                exit_code: output.status.code(),
                duration_ms: start.elapsed().as_millis() as u64,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Ok(Err(e)) => {
            let response = ExecCommandResponse {
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to execute: {}", e),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(_) => {
            let response = ExecCommandResponse {
                success: false,
                stdout: String::new(),
                stderr: "Command timed out".to_string(),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
    }
}

// ============================================
// Terminal Session Management (via terminal-app)
// ============================================

#[derive(Debug, Deserialize)]
pub struct CreateTerminalRequest {
    pub name: String,
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub status: String,
}

/// Create a named terminal session via terminal-app
pub async fn create_terminal(
    State(state): State<AppState>,
    Json(req): Json<CreateTerminalRequest>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();
    let cwd = req.cwd
        .map(|p| state.workspace_root.join(p))
        .unwrap_or_else(|| state.workspace_root.clone());

    match client
        .post(format!("{}/api/terminals", TERMINAL_API))
        .json(&serde_json::json!({
            "name": req.name,
            "cwd": cwd.to_string_lossy(),
        }))
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            (StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK), Json(body)).into_response()
        }
        Err(e) => {
            (StatusCode::BAD_GATEWAY, Json(serde_json::json!({
                "error": format!("Terminal API unavailable: {}", e)
            }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct TerminalExecRequest {
    pub name: String,
    pub command: String,
}

/// Execute command in a named terminal
pub async fn terminal_exec(
    Json(req): Json<TerminalExecRequest>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();

    match client
        .post(format!("{}/api/terminals/by-name/{}/exec", TERMINAL_API, req.name))
        .json(&serde_json::json!({ "command": req.command }))
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            (StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK), Json(body)).into_response()
        }
        Err(e) => {
            (StatusCode::BAD_GATEWAY, Json(serde_json::json!({
                "error": format!("Terminal API unavailable: {}", e)
            }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct TerminalBufferQuery {
    pub name: String,
    pub lines: Option<usize>,
}

/// Get terminal output buffer
pub async fn terminal_buffer(
    Query(query): Query<TerminalBufferQuery>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();

    // First get terminal by name
    let term_resp = match client
        .get(format!("{}/api/terminals/by-name/{}", TERMINAL_API, query.name))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({
                "error": format!("Terminal API unavailable: {}", e)
            }))).into_response();
        }
    };

    if !term_resp.status().is_success() {
        return (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("Terminal '{}' not found", query.name)
        }))).into_response();
    }

    let term_info: serde_json::Value = term_resp.json().await.unwrap_or_default();
    let term_id = term_info["id"].as_str().unwrap_or("");

    // Get buffer
    let lines = query.lines.unwrap_or(50);
    match client
        .get(format!("{}/api/terminals/{}/buffer?lines={}", TERMINAL_API, term_id, lines))
        .send()
        .await
    {
        Ok(resp) => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(e) => {
            (StatusCode::BAD_GATEWAY, Json(serde_json::json!({
                "error": format!("Terminal API unavailable: {}", e)
            }))).into_response()
        }
    }
}

/// List all terminal sessions
pub async fn list_terminals() -> impl IntoResponse {
    let client = reqwest::Client::new();

    match client.get(format!("{}/api/terminals", TERMINAL_API)).send().await {
        Ok(resp) => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(e) => {
            (StatusCode::BAD_GATEWAY, Json(serde_json::json!({
                "error": format!("Terminal API unavailable: {}", e)
            }))).into_response()
        }
    }
}

// ============================================
// File Operations (Rust-native)
// ============================================

#[derive(Debug, Deserialize)]
pub struct ReadFileRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ReadFileResponse {
    pub success: bool,
    pub content: Option<String>,
    pub error: Option<String>,
    pub size: Option<u64>,
}

/// Read file contents
pub async fn read_file(
    State(state): State<AppState>,
    Json(req): Json<ReadFileRequest>,
) -> impl IntoResponse {
    let path = state.workspace_root.join(&req.path);

    match tokio::fs::read_to_string(&path).await {
        Ok(content) => {
            let size = content.len() as u64;
            (StatusCode::OK, Json(ReadFileResponse {
                success: true,
                content: Some(content),
                error: None,
                size: Some(size),
            })).into_response()
        }
        Err(e) => {
            (StatusCode::OK, Json(ReadFileResponse {
                success: false,
                content: None,
                error: Some(e.to_string()),
                size: None,
            })).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct WriteFileResponse {
    pub success: bool,
    pub path: String,
    pub error: Option<String>,
}

/// Write file contents
pub async fn write_file(
    State(state): State<AppState>,
    Json(req): Json<WriteFileRequest>,
) -> impl IntoResponse {
    let path = state.workspace_root.join(&req.path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return (StatusCode::OK, Json(WriteFileResponse {
                success: false,
                path: req.path,
                error: Some(format!("Failed to create directory: {}", e)),
            })).into_response();
        }
    }

    match tokio::fs::write(&path, &req.content).await {
        Ok(_) => {
            (StatusCode::OK, Json(WriteFileResponse {
                success: true,
                path: req.path,
                error: None,
            })).into_response()
        }
        Err(e) => {
            (StatusCode::OK, Json(WriteFileResponse {
                success: false,
                path: req.path,
                error: Some(e.to_string()),
            })).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListFilesRequest {
    pub path: Option<String>,
    pub recursive: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ListFilesResponse {
    pub success: bool,
    pub files: Vec<FileEntry>,
    pub error: Option<String>,
}

/// List directory contents
pub async fn list_files(
    State(state): State<AppState>,
    Json(req): Json<ListFilesRequest>,
) -> impl IntoResponse {
    let path = req.path
        .map(|p| state.workspace_root.join(p))
        .unwrap_or_else(|| state.workspace_root.clone());

    let mut files = Vec::new();

    match tokio::fs::read_dir(&path).await {
        Ok(mut entries) => {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let metadata = entry.metadata().await.ok();
                files.push(FileEntry {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().strip_prefix(&state.workspace_root)
                        .unwrap_or(&entry.path())
                        .to_string_lossy()
                        .to_string(),
                    is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                    size: metadata.and_then(|m| if m.is_file() { Some(m.len()) } else { None }),
                });
            }
            (StatusCode::OK, Json(ListFilesResponse {
                success: true,
                files,
                error: None,
            })).into_response()
        }
        Err(e) => {
            (StatusCode::OK, Json(ListFilesResponse {
                success: false,
                files: vec![],
                error: Some(e.to_string()),
            })).into_response()
        }
    }
}

// ============================================
// Mission Integration
// ============================================

#[derive(Debug, Deserialize)]
pub struct ChatToMissionRequest {
    pub message: String,
    pub create_mission: bool,
}

#[derive(Debug, Serialize)]
pub struct ChatToMissionResponse {
    pub mission_id: Option<String>,
    pub analysis: String,
    pub suggested_steps: Vec<String>,
}

/// Analyze a chat message and optionally create a mission from it
pub async fn chat_to_mission(
    State(state): State<AppState>,
    Json(req): Json<ChatToMissionRequest>,
) -> impl IntoResponse {
    use spawn_core::Mission;

    // Simple extraction - use the message as the goal directly
    // For more sophisticated analysis, could call sandbox's Grok via API
    let goal = req.message.clone();
    let steps = vec![
        "Analyze requirements".to_string(),
        "Implement solution".to_string(),
        "Test and validate".to_string(),
    ];

    let mission_id = if req.create_mission {
        let mut mission = Mission::new(&goal);
        mission.context = serde_json::json!({
            "original_message": req.message,
            "steps": steps,
        });
        let id = mission.id.clone();

        // Start the mission
        let orchestrator = state.orchestrator.clone();
        tokio::spawn(async move {
            if let Err(e) = orchestrator.run_mission(mission).await {
                tracing::error!(error = %e, "Mission failed");
            }
        });

        Some(id)
    } else {
        None
    };

    (StatusCode::OK, Json(ChatToMissionResponse {
        mission_id,
        analysis: goal,
        suggested_steps: steps,
    })).into_response()
}

// ============================================
// Git Operations (Rust-native)
// ============================================

#[derive(Debug, Deserialize)]
pub struct GitStatusRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct GitStatusResponse {
    pub branch: String,
    pub remote: Option<String>,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
    pub recent_commits: Vec<String>,
}

/// Get git status for a repository
pub async fn git_status(
    State(state): State<AppState>,
    Json(req): Json<GitStatusRequest>,
) -> impl IntoResponse {
    let repo_path = state.workspace_root.join(&req.path);

    // Check if .git exists
    if !repo_path.join(".git").exists() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Not a git repository"
        }))).into_response();
    }

    async fn run_git(args: &[&str], cwd: &std::path::Path) -> (String, String, bool) {
        match tokio::process::Command::new("git")
            .args(args)
            .current_dir(cwd)
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .await
        {
            Ok(output) => (
                String::from_utf8_lossy(&output.stdout).trim().to_string(),
                String::from_utf8_lossy(&output.stderr).trim().to_string(),
                output.status.success(),
            ),
            Err(e) => (String::new(), e.to_string(), false),
        }
    }

    let (branch, _, _) = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], &repo_path).await;
    let (remote, _, _) = run_git(&["remote", "get-url", "origin"], &repo_path).await;
    let (status_out, _, _) = run_git(&["status", "--porcelain"], &repo_path).await;
    let (log_out, _, _) = run_git(&["log", "--oneline", "-5"], &repo_path).await;

    let lines: Vec<&str> = status_out.lines().filter(|l| !l.is_empty()).collect();

    let staged: Vec<String> = lines.iter()
        .filter(|l| l.starts_with(|c: char| c.is_ascii_uppercase() && c != '?'))
        .map(|l| l.get(3..).unwrap_or("").to_string())
        .collect();

    let unstaged: Vec<String> = lines.iter()
        .filter(|l| l.chars().nth(1).map(|c| c.is_ascii_uppercase() && c != '?').unwrap_or(false))
        .map(|l| l.get(3..).unwrap_or("").to_string())
        .collect();

    let untracked: Vec<String> = lines.iter()
        .filter(|l| l.starts_with("??"))
        .map(|l| l.get(3..).unwrap_or("").to_string())
        .collect();

    let recent_commits: Vec<String> = log_out.lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect();

    (StatusCode::OK, Json(GitStatusResponse {
        branch,
        remote: if remote.is_empty() { None } else { Some(remote) },
        staged,
        unstaged,
        untracked,
        recent_commits,
    })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct GitCloneRequest {
    pub repo: String,
    pub target: Option<String>,
    pub depth: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct GitCloneResponse {
    pub success: bool,
    pub path: String,
    pub message: String,
}

/// Clone a git repository
pub async fn git_clone(
    State(state): State<AppState>,
    Json(req): Json<GitCloneRequest>,
) -> impl IntoResponse {
    let mut repo_url = req.repo.clone();

    // Convert shorthand to full URL
    if !repo_url.contains("://") && !repo_url.starts_with("git@") {
        repo_url = format!("https://github.com/{}.git", repo_url);
    }

    // Inject token for private repos
    if let Ok(token) = std::env::var("GITHUB_TOKEN") {
        if repo_url.contains("github.com") && repo_url.starts_with("https://") {
            repo_url = repo_url.replace("https://github.com", &format!("https://{}@github.com", token));
        }
    }

    let target_dir = req.target.unwrap_or_else(|| {
        req.repo.split('/').last().unwrap_or("repo").replace(".git", "")
    });

    let mut args = vec!["clone".to_string()];
    if let Some(depth) = req.depth {
        args.push("--depth".to_string());
        args.push(depth.to_string());
    }
    args.push(repo_url);
    args.push(target_dir.clone());

    let output = tokio::process::Command::new("git")
        .args(&args)
        .current_dir(&state.workspace_root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            (StatusCode::OK, Json(GitCloneResponse {
                success: true,
                path: target_dir,
                message: String::from_utf8_lossy(&out.stderr).to_string(),
            })).into_response()
        }
        Ok(out) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": e.to_string()
            }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GitCommitRequest {
    pub path: String,
    pub message: String,
    pub files: Option<Vec<String>>,
}

/// Create a git commit
pub async fn git_commit(
    State(state): State<AppState>,
    Json(req): Json<GitCommitRequest>,
) -> impl IntoResponse {
    let repo_path = state.workspace_root.join(&req.path);

    // Stage files
    let add_args: Vec<&str> = if let Some(ref files) = req.files {
        let mut args = vec!["add"];
        args.extend(files.iter().map(|s| s.as_str()));
        args
    } else {
        vec!["add", "-A"]
    };

    let add_output = tokio::process::Command::new("git")
        .args(&add_args)
        .current_dir(&repo_path)
        .output()
        .await;

    if let Ok(out) = &add_output {
        if !out.status.success() {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response();
        }
    }

    // Commit
    let commit_output = tokio::process::Command::new("git")
        .args(["commit", "-m", &req.message])
        .current_dir(&repo_path)
        .output()
        .await;

    match commit_output {
        Ok(out) if out.status.success() => {
            // Get commit hash
            let hash_out = tokio::process::Command::new("git")
                .args(["rev-parse", "--short", "HEAD"])
                .current_dir(&repo_path)
                .output()
                .await
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();

            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "commit": hash_out,
                "message": String::from_utf8_lossy(&out.stdout).to_string()
            }))).into_response()
        }
        Ok(out) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": e.to_string()
            }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GitPushRequest {
    pub path: String,
    pub branch: Option<String>,
    pub force: Option<bool>,
}

/// Push to remote
pub async fn git_push(
    State(state): State<AppState>,
    Json(req): Json<GitPushRequest>,
) -> impl IntoResponse {
    let repo_path = state.workspace_root.join(&req.path);

    let token = match std::env::var("GITHUB_TOKEN") {
        Ok(t) => t,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "GITHUB_TOKEN not configured"
        }))).into_response(),
    };

    let mut args = vec!["push".to_string()];
    if let Some(ref branch) = req.branch {
        args.push("origin".to_string());
        args.push(branch.clone());
    }
    if req.force.unwrap_or(false) {
        args.push("--force".to_string());
    }

    let output = tokio::process::Command::new("git")
        .args(&args)
        .current_dir(&repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "echo")
        .env("GIT_USERNAME", "oauth2")
        .env("GIT_PASSWORD", &token)
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "message": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response()
        }
        Ok(out) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": e.to_string()
            }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GitPullRequest {
    pub path: String,
    pub branch: Option<String>,
}

/// Pull from remote
pub async fn git_pull(
    State(state): State<AppState>,
    Json(req): Json<GitPullRequest>,
) -> impl IntoResponse {
    let repo_path = state.workspace_root.join(&req.path);

    let mut args = vec!["pull".to_string()];
    if let Some(ref branch) = req.branch {
        args.push("origin".to_string());
        args.push(branch.clone());
    }

    let output = tokio::process::Command::new("git")
        .args(&args)
        .current_dir(&repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "message": String::from_utf8_lossy(&out.stdout).to_string()
            }))).into_response()
        }
        Ok(out) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": String::from_utf8_lossy(&out.stderr).to_string()
            }))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": e.to_string()
            }))).into_response()
        }
    }
}

// ============================================
// ARCHITECT Status
// ============================================

#[derive(Debug, Serialize)]
pub struct ArchitectStatus {
    pub version: &'static str,
    pub workspace: String,
    pub terminal_api: &'static str,
    pub terminal_connected: bool,
    pub tools: Vec<&'static str>,
    pub active_terminals: usize,
    pub active_missions: usize,
}

/// Get ARCHITECT agent status
pub async fn status(State(state): State<AppState>) -> impl IntoResponse {
    let client = reqwest::Client::new();

    // Check terminal-app connection
    let terminal_connected = client
        .get(format!("{}/health", TERMINAL_API))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .is_ok();

    // Get terminal count
    let active_terminals = if terminal_connected {
        match client.get(format!("{}/api/terminals", TERMINAL_API)).send().await {
            Ok(resp) => {
                resp.json::<serde_json::Value>().await
                    .ok()
                    .and_then(|v| v["count"].as_u64())
                    .unwrap_or(0) as usize
            }
            Err(_) => 0,
        }
    } else {
        0
    };

    // Get mission count
    let active_missions = state.db.list_missions().await
        .map(|m| m.iter().filter(|m| format!("{:?}", m.status) == "Running").count())
        .unwrap_or(0);

    (StatusCode::OK, Json(ArchitectStatus {
        version: "2.0",
        workspace: state.workspace_root.to_string_lossy().to_string(),
        terminal_api: TERMINAL_API,
        terminal_connected,
        tools: vec![
            "exec_command",
            "read_file",
            "write_file",
            "list_files",
            "terminal_create",
            "terminal_exec",
            "terminal_buffer",
            "terminal_list",
            "chat_to_mission",
            "git_status",
            "git_clone",
            "git_commit",
            "git_push",
            "git_pull",
        ],
        active_terminals,
        active_missions,
    })).into_response()
}
