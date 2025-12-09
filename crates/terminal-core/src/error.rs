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
