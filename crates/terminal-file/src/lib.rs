use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub entry: FileEntry,
    pub children: Vec<FileTreeNode>,
}

pub struct FileManager {
    root: PathBuf,
}

impl FileManager {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn resolve(&self, path: &Path) -> PathBuf {
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            self.root.join(path)
        }
    }

    pub async fn list(&self, path: &Path) -> Result<Vec<FileEntry>, std::io::Error> {
        let full = self.resolve(path);
        let mut entries = Vec::new();
        let mut dir = tokio::fs::read_dir(&full).await?;
        while let Some(e) = dir.next_entry().await? {
            let m = e.metadata().await?;
            entries.push(FileEntry {
                path: e.path(),
                name: e.file_name().to_string_lossy().to_string(),
                is_dir: m.is_dir(),
                is_file: m.is_file(),
                size: m.len(),
                modified: m.modified().ok().map(DateTime::<Utc>::from),
            });
        }
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        });
        Ok(entries)
    }

    pub fn tree(&self, path: &Path, depth: usize) -> Result<FileTreeNode, std::io::Error> {
        self.build_tree(&self.resolve(path), 0, depth)
    }

    fn build_tree(&self, path: &Path, d: usize, max: usize) -> Result<FileTreeNode, std::io::Error> {
        let m = std::fs::metadata(path)?;
        let entry = FileEntry {
            path: path.to_path_buf(),
            name: path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "/".into()),
            is_dir: m.is_dir(),
            is_file: m.is_file(),
            size: m.len(),
            modified: m.modified().ok().map(DateTime::<Utc>::from),
        };
        let children = if m.is_dir() && d < max {
            std::fs::read_dir(path)?
                .flatten()
                .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .filter(|e| e.file_name() != "node_modules" && e.file_name() != "target")
                .filter_map(|e| self.build_tree(&e.path(), d + 1, max).ok())
                .collect()
        } else {
            Vec::new()
        };
        Ok(FileTreeNode { entry, children })
    }

    pub async fn read(&self, path: &Path) -> Result<Vec<u8>, std::io::Error> {
        tokio::fs::read(self.resolve(path)).await
    }

    pub async fn read_string(&self, path: &Path) -> Result<String, std::io::Error> {
        tokio::fs::read_to_string(self.resolve(path)).await
    }

    pub async fn write(&self, path: &Path, content: &[u8]) -> Result<(), std::io::Error> {
        tokio::fs::write(self.resolve(path), content).await
    }

    pub async fn create(&self, path: &Path, content: Option<&[u8]>) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if let Some(p) = full.parent() {
            tokio::fs::create_dir_all(p).await?;
        }
        tokio::fs::write(&full, content.unwrap_or(&[])).await
    }

    pub async fn delete(&self, path: &Path, recursive: bool) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if full.is_dir() {
            if recursive {
                tokio::fs::remove_dir_all(&full).await
            } else {
                tokio::fs::remove_dir(&full).await
            }
        } else {
            tokio::fs::remove_file(&full).await
        }
    }

    pub async fn rename(&self, from: &Path, to: &Path) -> Result<(), std::io::Error> {
        tokio::fs::rename(self.resolve(from), self.resolve(to)).await
    }

    pub async fn mkdir(&self, path: &Path, recursive: bool) -> Result<(), std::io::Error> {
        let full = self.resolve(path);
        if recursive {
            tokio::fs::create_dir_all(&full).await
        } else {
            tokio::fs::create_dir(&full).await
        }
    }

    pub fn search(&self, pattern: &str, path: &Path) -> Vec<FileEntry> {
        let pat = pattern.to_lowercase();
        WalkDir::new(self.resolve(path))
            .into_iter()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().to_lowercase().contains(&pat))
            .take(100)
            .filter_map(|e| {
                let m = e.metadata().ok()?;
                Some(FileEntry {
                    path: e.path().to_path_buf(),
                    name: e.file_name().to_string_lossy().to_string(),
                    is_dir: m.is_dir(),
                    is_file: m.is_file(),
                    size: m.len(),
                    modified: m.modified().ok().map(DateTime::<Utc>::from),
                })
            })
            .collect()
    }
}
