pub mod error;
pub mod handlers;
pub mod mapper;
pub mod paths;
pub mod routes;

pub use handlers::DocumentAppState;
pub use routes::build_document_app_router;
