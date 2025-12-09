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
