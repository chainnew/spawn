use parking_lot::RwLock;
use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::{Path, PathBuf}, sync::Arc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorBuffer {
    pub id: Uuid,
    pub path: Option<PathBuf>,
    pub name: String,
    pub language: Language,
    pub modified: bool,
    pub line_count: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum Language {
    Rust,
    JavaScript,
    TypeScript,
    Python,
    Json,
    Toml,
    Markdown,
    Html,
    Css,
    Shell,
    Unknown,
}

impl Language {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => Language::Rust,
            "js" | "mjs" => Language::JavaScript,
            "ts" | "tsx" => Language::TypeScript,
            "py" => Language::Python,
            "json" => Language::Json,
            "toml" => Language::Toml,
            "md" => Language::Markdown,
            "html" => Language::Html,
            "css" => Language::Css,
            "sh" | "bash" => Language::Shell,
            _ => Language::Unknown,
        }
    }
}

struct BufferInner {
    pub info: EditorBuffer,
    pub rope: Rope,
}

pub struct EditorManager {
    buffers: Arc<RwLock<HashMap<Uuid, BufferInner>>>,
    path_index: Arc<RwLock<HashMap<PathBuf, Uuid>>>,
}

impl EditorManager {
    pub fn new() -> Self {
        Self {
            buffers: Arc::new(RwLock::new(HashMap::new())),
            path_index: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn open(&self, path: &Path) -> Result<EditorBuffer, std::io::Error> {
        if let Some(&id) = self.path_index.read().get(path) {
            if let Some(b) = self.buffers.read().get(&id) {
                return Ok(b.info.clone());
            }
        }

        let content = tokio::fs::read_to_string(path).await?;
        let id = Uuid::new_v4();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "untitled".into());
        let language = path
            .extension()
            .map(|e| Language::from_extension(&e.to_string_lossy()))
            .unwrap_or(Language::Unknown);
        let rope = Rope::from_str(&content);

        let info = EditorBuffer {
            id,
            path: Some(path.to_path_buf()),
            name,
            language,
            modified: false,
            line_count: rope.len_lines(),
        };

        self.buffers
            .write()
            .insert(id, BufferInner { info: info.clone(), rope });
        self.path_index.write().insert(path.to_path_buf(), id);
        Ok(info)
    }

    pub fn get_content(&self, id: Uuid) -> Option<String> {
        self.buffers.read().get(&id).map(|b| b.rope.to_string())
    }

    pub fn set_content(&self, id: Uuid, content: &str) -> bool {
        if let Some(b) = self.buffers.write().get_mut(&id) {
            b.rope = Rope::from_str(content);
            b.info.modified = true;
            b.info.line_count = b.rope.len_lines();
            true
        } else {
            false
        }
    }

    pub async fn save(&self, id: Uuid) -> Result<(), std::io::Error> {
        let (path, content) = {
            let buffers = self.buffers.read();
            let b = buffers.get(&id).ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "Buffer not found")
            })?;
            (
                b.info.path.clone().ok_or_else(|| {
                    std::io::Error::new(std::io::ErrorKind::InvalidInput, "No path")
                })?,
                b.rope.to_string(),
            )
        };
        tokio::fs::write(&path, content).await?;
        if let Some(b) = self.buffers.write().get_mut(&id) {
            b.info.modified = false;
        }
        Ok(())
    }

    pub fn close(&self, id: Uuid) -> bool {
        if let Some(b) = self.buffers.write().remove(&id) {
            if let Some(p) = &b.info.path {
                self.path_index.write().remove(p);
            }
            true
        } else {
            false
        }
    }

    pub fn list_buffers(&self) -> Vec<EditorBuffer> {
        self.buffers.read().values().map(|b| b.info.clone()).collect()
    }

    pub fn get_buffer(&self, id: Uuid) -> Option<EditorBuffer> {
        self.buffers.read().get(&id).map(|b| b.info.clone())
    }
}

impl Default for EditorManager {
    fn default() -> Self {
        Self::new()
    }
}
