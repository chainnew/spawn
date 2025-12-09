use uuid::Uuid;

pub struct WebRtcManager;

impl WebRtcManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn create_peer(&self) -> Uuid {
        Uuid::new_v4()
    }

    pub async fn create_offer(&self, _peer_id: Uuid) -> Result<String, String> {
        Ok("{}".into())
    }

    pub async fn handle_offer(&self, _peer_id: Uuid, _sdp: &str) -> Result<String, String> {
        Ok("{}".into())
    }

    pub async fn handle_answer(&self, _peer_id: Uuid, _sdp: &str) -> Result<(), String> {
        Ok(())
    }
}

impl Default for WebRtcManager {
    fn default() -> Self {
        Self::new()
    }
}
