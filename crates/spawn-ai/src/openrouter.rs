//! OpenRouter API client

use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;
use spawn_core::{ChatMessage, LlmClient, Result, SpawnError};
use tracing::{debug, error};

pub struct OpenRouterClient {
    api_key: String,
    client: Client,
    site_url: String,
    site_name: String,
}

impl OpenRouterClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            client: Client::new(),
            site_url: "https://spawn.new".to_string(),
            site_name: "Spawn".to_string(),
        }
    }
    
    pub fn with_site_info(mut self, url: impl Into<String>, name: impl Into<String>) -> Self {
        self.site_url = url.into();
        self.site_name = name.into();
        self
    }
}

#[async_trait]
impl LlmClient for OpenRouterClient {
    async fn chat(&self, model: &str, messages: &[ChatMessage]) -> Result<String> {
        debug!(model = model, message_count = messages.len(), "Sending chat request");
        
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": 0.7,
        });

        let res = self.client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", &self.site_url)
            .header("X-Title", &self.site_name)
            .json(&body)
            .send()
            .await
            .map_err(|e| SpawnError::ProviderError(format!("Request failed: {}", e)))?;

        let status = res.status();
        if !status.is_success() {
            let err_text = res.text().await.unwrap_or_default();
            error!(status = %status, error = %err_text, "OpenRouter API error");
            return Err(SpawnError::ProviderError(format!(
                "API error {}: {}", status, err_text
            )));
        }

        let json: serde_json::Value = res.json().await
            .map_err(|e| SpawnError::ProviderError(format!("Parse error: {}", e)))?;

        json["choices"][0]["message"]["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| SpawnError::ProviderError("No content in response".into()))
    }
    
    fn provider_name(&self) -> &str {
        "openrouter"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_client_creation() {
        let client = OpenRouterClient::new("test-key")
            .with_site_info("https://test.com", "Test");
        assert_eq!(client.provider_name(), "openrouter");
    }
}
