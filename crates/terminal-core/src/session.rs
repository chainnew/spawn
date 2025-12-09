use crate::{pty::PtyHandle, buffer::TerminalBuffer, TerminalError};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};
use tokio::sync::RwLock;
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
        if self.sessions.read().await.len() >= self.max_sessions {
            return Err(TerminalError::MaxSessions);
        }

        if self.name_index.read().await.contains_key(&config.name) {
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

        self.sessions.write().await.insert(id, inner);
        self.name_index.write().await.insert(config.name, id);

        Ok(session)
    }

    pub async fn get_session(&self, id: Uuid) -> Option<TerminalSession> {
        self.sessions.read().await.get(&id).map(|s| s.info.clone())
    }

    pub async fn get_session_by_name(&self, name: &str) -> Option<TerminalSession> {
        let id = self.name_index.read().await.get(name).copied()?;
        self.get_session(id).await
    }

    pub async fn resolve_name(&self, name: &str) -> Option<Uuid> {
        self.name_index.read().await.get(name).copied()
    }

    pub async fn exec(&self, id: Uuid, command: &str) -> Result<(), TerminalError> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(&id)
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

            let sessions = self.sessions.read().await;
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
        let sessions = self.sessions.read().await;
        let session = sessions.get(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        session.handle.write(data).await?;
        Ok(())
    }

    pub async fn resize(&self, id: Uuid, cols: u16, rows: u16) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        // Note: PTY resize requires keeping the master handle which complicates Send+Sync
        // For now we just update the stored dimensions
        session.info.cols = cols;
        session.info.rows = rows;
        Ok(())
    }

    pub async fn kill(&self, id: Uuid) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions.remove(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;

        self.name_index.write().await.remove(&session.info.name);
        drop(session.handle);
        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<TerminalSession> {
        self.sessions.read().await.values().map(|s| s.info.clone()).collect()
    }

    pub async fn flush_buffer(&self, id: Uuid) -> Result<(), TerminalError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions.get_mut(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;
        session.buffer.clear();
        Ok(())
    }

    pub async fn get_buffer(&self, id: Uuid, lines: Option<usize>) -> Result<Vec<String>, TerminalError> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(&id)
            .ok_or(TerminalError::SessionNotFound(id))?;

        Ok(match lines {
            Some(n) => session.buffer.get_recent(n),
            None => session.buffer.get_all(),
        })
    }
}
