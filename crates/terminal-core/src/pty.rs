use crate::TerminalError;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{collections::HashMap, io::{Read, Write}, path::Path, sync::Arc};
use tokio::sync::Mutex;

pub struct PtyHandle {
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pid: Option<u32>,
}

// The reader and writer are protected by Mutex, so this is safe
unsafe impl Send for PtyHandle {}
unsafe impl Sync for PtyHandle {}

impl PtyHandle {
    pub fn child_pid(&self) -> Option<u32> {
        self.pid
    }

    pub async fn write(&self, data: &[u8]) -> Result<usize, TerminalError> {
        let mut writer = self.writer.lock().await;
        writer.write(data).map_err(TerminalError::Io)
    }

    pub async fn read(&self, buf: &mut [u8]) -> Result<usize, TerminalError> {
        let mut reader = self.reader.lock().await;
        reader.read(buf).map_err(TerminalError::Io)
    }

    pub fn try_clone_reader(&self) -> Arc<Mutex<Box<dyn Read + Send>>> {
        Arc::clone(&self.reader)
    }
}

pub async fn spawn_pty(
    shell: &str,
    cwd: &Path,
    cols: u16,
    rows: u16,
    env: HashMap<String, String>,
) -> Result<PtyHandle, TerminalError> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(cwd);

    for (key, value) in env {
        cmd.env(key, value);
    }

    let child = pair.slave
        .spawn_command(cmd)
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let pid = child.process_id();

    let reader = pair.master
        .try_clone_reader()
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    let writer = pair.master
        .take_writer()
        .map_err(|e| TerminalError::Pty(e.to_string()))?;

    // Drop master and child - we only need reader/writer
    // The child process will continue running
    drop(pair.master);
    drop(child);

    Ok(PtyHandle {
        reader: Arc::new(Mutex::new(reader)),
        writer: Arc::new(Mutex::new(writer)),
        pid,
    })
}
