//! Tools - capabilities the agent can use

use async_trait::async_trait;
use spawn_core::{Result, SpawnError, Tool};
use std::collections::HashMap;
use std::process::Command;
use tracing::{info, warn};

/// Registry of available tools
pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
        };
        
        // Register default tools
        registry.register(Box::new(EchoTool));
        registry.register(Box::new(ShellTool::default()));
        
        registry
    }
    
    pub fn register(&mut self, tool: Box<dyn Tool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }
    
    pub fn describe(&self) -> String {
        self.tools.values()
            .map(|t| format!("- {}: {}", t.name(), t.description()))
            .collect::<Vec<_>>()
            .join("\n")
    }
    
    pub async fn execute(&self, name: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        let tool = self.tools.get(name)
            .ok_or_else(|| SpawnError::ToolError(format!("Unknown tool: {}", name)))?;
        
        tool.execute(args).await
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================
// Built-in Tools
// ============================================

/// Simple echo tool for testing
pub struct EchoTool;

#[async_trait]
impl Tool for EchoTool {
    fn name(&self) -> &str { "echo" }
    
    fn description(&self) -> &str { "Echo back the input message" }
    
    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "message": { "type": "string", "description": "Message to echo" }
            },
            "required": ["message"]
        })
    }
    
    async fn execute(&self, args: serde_json::Value) -> Result<serde_json::Value> {
        let message = args["message"].as_str().unwrap_or("(empty)");
        Ok(serde_json::json!({ "echo": message }))
    }
}

/// Shell command execution (sandboxed)
pub struct ShellTool {
    allowed_commands: Vec<String>,
}

impl Default for ShellTool {
    fn default() -> Self {
        Self {
            allowed_commands: vec![
                "ls".into(),
                "cat".into(),
                "head".into(),
                "tail".into(),
                "grep".into(),
                "find".into(),
                "wc".into(),
                "echo".into(),
                "pwd".into(),
                "date".into(),
            ],
        }
    }
}

#[async_trait]
impl Tool for ShellTool {
    fn name(&self) -> &str { "shell" }
    
    fn description(&self) -> &str { "Execute safe shell commands (ls, cat, grep, etc.)" }
    
    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "Command to execute" },
                "args": { 
                    "type": "array", 
                    "items": { "type": "string" },
                    "description": "Command arguments"
                }
            },
            "required": ["command"]
        })
    }
    
    async fn execute(&self, args: serde_json::Value) -> Result<serde_json::Value> {
        let cmd = args["command"].as_str()
            .ok_or_else(|| SpawnError::ToolError("Missing command".into()))?;
        
        // Security check
        if !self.allowed_commands.contains(&cmd.to_string()) {
            warn!(command = cmd, "Blocked command");
            return Err(SpawnError::ToolError(format!(
                "Command '{}' not allowed. Allowed: {:?}", cmd, self.allowed_commands
            )));
        }
        
        let cmd_args: Vec<String> = args["args"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        
        info!(command = cmd, args = ?cmd_args, "Executing shell command");
        
        let output = Command::new(cmd)
            .args(&cmd_args)
            .output()
            .map_err(|e| SpawnError::ToolError(format!("Exec failed: {}", e)))?;
        
        Ok(serde_json::json!({
            "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
            "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
            "exit_code": output.status.code()
        }))
    }
}
