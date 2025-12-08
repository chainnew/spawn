//! spawn-agents: The brain & hands
//! 
//! Contains the Orchestrator (agent loop), Memory (database), and Tools.

pub mod memory;
pub mod orchestrator;
pub mod tools;

pub use memory::Database;
pub use orchestrator::Orchestrator;
