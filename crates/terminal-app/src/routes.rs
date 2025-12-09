use crate::{state::AppState, handlers};
use axum::{routing::{get, post, put, delete}, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health))

        // TERMINAL API
        .route("/api/terminals", get(handlers::terminal::list))
        .route("/api/terminals", post(handlers::terminal::create))
        .route("/api/terminals/:id", get(handlers::terminal::get))
        .route("/api/terminals/:id", delete(handlers::terminal::kill))
        .route("/api/terminals/:id/exec", post(handlers::terminal::exec))
        .route("/api/terminals/:id/exec/wait", post(handlers::terminal::exec_wait))
        .route("/api/terminals/:id/write", post(handlers::terminal::write))
        .route("/api/terminals/:id/resize", post(handlers::terminal::resize))
        .route("/api/terminals/:id/buffer", get(handlers::terminal::get_buffer))
        .route("/api/terminals/:id/buffer", delete(handlers::terminal::flush_buffer))
        .route("/api/terminals/by-name/:name", get(handlers::terminal::get_by_name))
        .route("/api/terminals/by-name/:name/exec", post(handlers::terminal::exec_by_name))

        // EDITOR API
        .route("/api/editor/open", post(handlers::editor::open))
        .route("/api/editor/save", post(handlers::editor::save))
        .route("/api/editor/buffers", get(handlers::editor::list_buffers))
        .route("/api/editor/buffers/:id", get(handlers::editor::get_buffer))
        .route("/api/editor/buffers/:id", put(handlers::editor::update_buffer))
        .route("/api/editor/buffers/:id", delete(handlers::editor::close_buffer))

        // FILE API
        .route("/api/files", get(handlers::files::list))
        .route("/api/files/tree", get(handlers::files::tree))
        .route("/api/files/read", post(handlers::files::read))
        .route("/api/files/write", post(handlers::files::write_file))
        .route("/api/files/create", post(handlers::files::create))
        .route("/api/files/delete", post(handlers::files::delete_file))
        .route("/api/files/rename", post(handlers::files::rename))
        .route("/api/files/mkdir", post(handlers::files::mkdir))
        .route("/api/files/search", post(handlers::files::search))

        // WEBRTC
        .route("/api/webrtc/offer", post(handlers::webrtc::handle_offer))
        .route("/api/webrtc/answer", post(handlers::webrtc::handle_answer))

        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
