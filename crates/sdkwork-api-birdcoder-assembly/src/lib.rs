//! Gateway assembly for sdkwork-birdcoder.
//! Application bootstrap lives in `bootstrap.rs`; route inventory is in `assembly-manifest.json`.
// SDKWORK-ASSEMBLY-LIB-CUSTOM: preserve Birdcoder service and route composition modules.

#[path = "bootstrap.rs"]
mod assembly_entry;
#[path = "application_bootstrap/mod.rs"]
pub mod bootstrap;
pub mod business_metrics;
mod generated;
pub mod observability;
pub mod openapi;

pub use assembly_entry::{
    assemble_api_router, assemble_api_router_with_readiness, web_module, web_module_with_config,
    ApiAssembly,
};

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
