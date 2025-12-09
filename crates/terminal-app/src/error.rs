use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
    Terminal(terminal_core::TerminalError),
    Io(std::io::Error),
}

impl From<terminal_core::TerminalError> for ApiError {
    fn from(err: terminal_core::TerminalError) -> Self {
        ApiError::Terminal(err)
    }
}

impl From<std::io::Error> for ApiError {
    fn from(err: std::io::Error) -> Self {
        ApiError::Io(err)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            ApiError::Terminal(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            ApiError::Io(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
