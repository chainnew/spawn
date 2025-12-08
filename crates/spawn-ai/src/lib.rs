//! spawn-ai: The speech center
//! 
//! LLM provider adapters, routing, and cost tracking.
//! Currently supports OpenRouter (which proxies to everything).

mod openrouter;

pub use openrouter::OpenRouterClient;

use spawn_core::{LlmClient, Result};
use std::sync::Arc;

/// Provider manager for load balancing / fallback
pub struct ProviderManager {
    primary: Arc<dyn LlmClient>,
    // TODO: Add fallback providers, cost tracking, rate limiting
}

impl ProviderManager {
    pub fn new(primary: Arc<dyn LlmClient>) -> Self {
        Self { primary }
    }
    
    pub fn client(&self) -> &Arc<dyn LlmClient> {
        &self.primary
    }
}
