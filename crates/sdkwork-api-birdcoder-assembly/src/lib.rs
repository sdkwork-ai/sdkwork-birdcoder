//! Gateway assembly for sdkwork-birdcoder.
//! Application bootstrap lives in `bootstrap.rs`; route inventory is in `assembly-manifest.json`.
// SDKWORK-ASSEMBLY-LIB-CUSTOM: preserve Birdcoder service and route composition modules.

#[path = "bootstrap.rs"]
mod assembly_entry;
#[path = "application_bootstrap/mod.rs"]
pub mod bootstrap;
pub mod business_metrics;
mod generated;
pub mod health;
pub mod observability;
pub mod openapi;

pub use assembly_entry::{assemble_api_router, ApiAssembly};

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
