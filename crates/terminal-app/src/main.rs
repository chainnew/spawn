mod state;
mod routes;
mod handlers;
mod error;

use state::AppState;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "terminal_app=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState::from_env();
    let app = routes::create_router(state);

    let host = std::env::var("TERMINAL_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = std::env::var("TERMINAL_PORT")
        .unwrap_or_else(|_| "3001".into())
        .parse()
        .expect("Invalid port");

    let addr = SocketAddr::new(host.parse().unwrap(), port);
    tracing::info!("Terminal server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
