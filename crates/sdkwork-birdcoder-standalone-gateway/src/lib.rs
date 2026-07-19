pub mod server;

pub use sdkwork_birdcoder_gateway_assembly::{
    bootstrap, business_metrics, health, observability, openapi,
};

pub fn enable_process_shared_database_pool() {
    sdkwork_database_sqlx::enable_process_shared_database_pool();
}
