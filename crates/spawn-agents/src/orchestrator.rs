//! The Orchestrator - the brain that runs the think → act → reflect loop

use crate::memory::Database;
use crate::tools::ToolRegistry;
use spawn_core::{ChatMessage, LlmClient, Mission, MissionStatus, Result, SpawnError};
use std::sync::Arc;
use tracing::{info, warn, error};

const MAX_STEPS: usize = 10;
const DEFAULT_MODEL: &str = "anthropic/claude-sonnet-4-20250514";

pub struct Orchestrator {
    db: Arc<Database>,
    llm: Arc<dyn LlmClient>,
    tools: ToolRegistry,
    model: String,
}

impl Orchestrator {
    pub fn new(db: Arc<Database>, llm: Arc<dyn LlmClient>) -> Self {
        Self {
            db,
            llm,
            tools: ToolRegistry::new(),
            model: DEFAULT_MODEL.to_string(),
        }
    }
    
    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    
    pub fn with_tools(mut self, tools: ToolRegistry) -> Self {
        self.tools = tools;
        self
    }
    
    /// Run a mission through the agent loop
    pub async fn run_mission(&self, mission: Mission) -> Result<()> {
        info!(mission_id = %mission.id, goal = %mission.goal, "Starting mission");
        
        // Save mission to DB
        self.db.create_mission(&mission).await?;
        self.db.update_mission_status(&mission.id, MissionStatus::Running).await?;
        
        // Build initial context
        let system_prompt = self.build_system_prompt();
        let mut messages = vec![
            ChatMessage::system(system_prompt),
            ChatMessage::user(format!("Goal: {}", mission.goal)),
        ];
        
        // The Loop: Think → Act → Reflect
        for step in 0..MAX_STEPS {
            info!(mission_id = %mission.id, step = step, "Executing step");
            
            // 1. Think - ask LLM what to do
            let response = match self.llm.chat(&self.model, &messages).await {
                Ok(r) => r,
                Err(e) => {
                    error!(error = %e, "LLM call failed");
                    self.db.update_mission_status(&mission.id, MissionStatus::Failed).await?;
                    return Err(e);
                }
            };
            
            // Log the response
            self.db.log_step(&mission.id, "assistant", &response).await?;
            messages.push(ChatMessage::assistant(&response));
            
            // 2. Check for completion
            if self.is_complete(&response) {
                info!(mission_id = %mission.id, "Mission completed");
                self.db.update_mission_status(&mission.id, MissionStatus::Completed).await?;
                return Ok(());
            }
            
            // 3. Act - parse and execute any tool calls
            if let Some(tool_result) = self.execute_tools(&response).await? {
                self.db.log_step(&mission.id, "tool", &tool_result).await?;
                messages.push(ChatMessage::user(format!("Tool result: {}", tool_result)));
            }
        }
        
        // Hit max steps
        warn!(mission_id = %mission.id, "Mission hit max steps");
        self.db.update_mission_status(&mission.id, MissionStatus::Failed).await?;
        Err(SpawnError::OrchestrationError("Max steps exceeded".into()))
    }
    
    fn build_system_prompt(&self) -> String {
        let tool_descriptions = self.tools.describe();
        
        format!(r#"You are an autonomous AI agent. Your job is to accomplish the user's goal.

Available tools:
{tool_descriptions}

To use a tool, respond with:
TOOL: <tool_name>
ARGS: <json_arguments>

When the goal is complete, respond with:
DONE: <summary of what was accomplished>

Think step by step. Be concise."#)
    }
    
    fn is_complete(&self, response: &str) -> bool {
        response.contains("DONE:")
    }
    
    async fn execute_tools(&self, response: &str) -> Result<Option<String>> {
        // Simple parsing - look for TOOL: and ARGS:
        if !response.contains("TOOL:") {
            return Ok(None);
        }
        
        // Extract tool name
        let tool_line = response.lines()
            .find(|l| l.starts_with("TOOL:"))
            .map(|l| l.trim_start_matches("TOOL:").trim());
        
        let Some(tool_name) = tool_line else {
            return Ok(None);
        };
        
        // Extract args
        let args_line = response.lines()
            .find(|l| l.starts_with("ARGS:"))
            .map(|l| l.trim_start_matches("ARGS:").trim())
            .unwrap_or("{}");
        
        let args: serde_json::Value = serde_json::from_str(args_line)
            .unwrap_or(serde_json::json!({}));
        
        // Execute
        info!(tool = tool_name, "Executing tool");
        let result = self.tools.execute(tool_name, args).await?;
        
        Ok(Some(serde_json::to_string_pretty(&result)?))
    }
}
