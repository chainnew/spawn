//! Terminal WebSocket handler
//!
//! Pipes PTY stdin/stdout over WebSocket to xterm.js frontend

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tracing::{debug, error, info};

use crate::AppState;

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(_state): State<AppState>,
) -> impl IntoResponse {
    info!("🖥️ Terminal WebSocket connection request");
    ws.on_upgrade(handle_socket)
}

/// Handle the WebSocket connection
async fn handle_socket(socket: WebSocket) {
    info!("🖥️ Terminal WebSocket connected");

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Get user's shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    
    info!("🐚 Spawning shell: {}", shell);

    // Spawn shell process
    let mut child = match Command::new(&shell)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor")
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            error!("Failed to spawn shell: {}", e);
            let _ = ws_sender
                .send(Message::Text(format!("Error: Failed to spawn shell: {}\r\n", e)))
                .await;
            return;
        }
    };

    let mut stdin = child.stdin.take().expect("Failed to get stdin");
    let stdout = child.stdout.take().expect("Failed to get stdout");
    let stderr = child.stderr.take().expect("Failed to get stderr");

    // Channel for PTY output -> WebSocket
    let (tx, mut rx) = mpsc::channel::<String>(100);
    let tx2 = tx.clone();

    // Task: Read stdout and send to channel
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut buf = vec![0u8; 4096];
        
        loop {
            match tokio::io::AsyncReadExt::read(&mut reader, &mut buf).await {
                Ok(0) => {
                    debug!("stdout EOF");
                    break;
                }
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx.send(output).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    error!("stdout read error: {}", e);
                    break;
                }
            }
        }
    });

    // Task: Read stderr and send to channel
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut buf = vec![0u8; 1024];
        
        loop {
            match tokio::io::AsyncReadExt::read(&mut reader, &mut buf).await {
                Ok(0) => {
                    debug!("stderr EOF");
                    break;
                }
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx2.send(output).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    error!("stderr read error: {}", e);
                    break;
                }
            }
        }
    });

    // Task: Send PTY output to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(output) = rx.recv().await {
            if ws_sender.send(Message::Text(output)).await.is_err() {
                break;
            }
        }
    });

    // Main loop: Receive from WebSocket and write to PTY stdin
    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Parse message - could be raw input or JSON command
                let input = if text.starts_with('{') {
                    // Try to parse as JSON
                    if let Ok(cmd) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(data) = cmd.get("data").and_then(|d| d.as_str()) {
                            data.to_string()
                        } else if let Some(input) = cmd.get("input").and_then(|i| i.as_str()) {
                            input.to_string()
                        } else {
                            text
                        }
                    } else {
                        text
                    }
                } else {
                    text
                };

                if let Err(e) = stdin.write_all(input.as_bytes()).await {
                    error!("Failed to write to stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    error!("Failed to flush stdin: {}", e);
                    break;
                }
            }
            Ok(Message::Binary(data)) => {
                // Raw binary input
                if let Err(e) = stdin.write_all(&data).await {
                    error!("Failed to write binary to stdin: {}", e);
                    break;
                }
                let _ = stdin.flush().await;
            }
            Ok(Message::Close(_)) => {
                info!("🖥️ Terminal WebSocket closed by client");
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    info!("🖥️ Cleaning up terminal session");
    let _ = child.kill().await;
    stdout_task.abort();
    stderr_task.abort();
    send_task.abort();
}
