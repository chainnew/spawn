use crate::{state::AppState, error::ApiError};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct OfferRequest {
    pub peer_id: Option<Uuid>,
    pub sdp: String,
}

#[derive(Serialize)]
pub struct OfferResponse {
    pub peer_id: Uuid,
    pub sdp: String,
}

pub async fn handle_offer(
    State(state): State<AppState>,
    Json(req): Json<OfferRequest>,
) -> Result<Json<OfferResponse>, ApiError> {
    let peer_id = req.peer_id.unwrap_or_else(|| {
        // Create new peer synchronously for now
        Uuid::new_v4()
    });

    let answer_sdp = state.webrtc.handle_offer(peer_id, &req.sdp).await
        .map_err(|e| ApiError::Internal(e))?;

    Ok(Json(OfferResponse {
        peer_id,
        sdp: answer_sdp,
    }))
}

#[derive(Deserialize)]
pub struct AnswerRequest {
    pub peer_id: Uuid,
    pub sdp: String,
}

#[derive(Serialize)]
pub struct AnswerResponse {
    pub success: bool,
}

pub async fn handle_answer(
    State(state): State<AppState>,
    Json(req): Json<AnswerRequest>,
) -> Result<Json<AnswerResponse>, ApiError> {
    state.webrtc.handle_answer(req.peer_id, &req.sdp).await
        .map_err(|e| ApiError::Internal(e))?;

    Ok(Json(AnswerResponse { success: true }))
}
