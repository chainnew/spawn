//! spawn-agents: The brain & hands
//!
//! Contains the Orchestrator (agent loop), Memory (database), Tools,
//! and Vector Memory for semantic search.

pub mod memory;
pub mod orchestrator;
pub mod tools;
pub mod vector_memory;

pub use memory::Database;
pub use orchestrator::Orchestrator;
pub use vector_memory::{VectorMemory, SearchResult, CodeChunk, ContentType};
