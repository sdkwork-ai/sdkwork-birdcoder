//! BirdCoder integration boundary for `sdkwork-kernel`.
//!
//! Agent runtime SPI (sessions, models, tools, policy, adapters) is owned by
//! `sdkwork-agent-kernel` and `sdkwork-kernel-plugins`. BirdCoder keeps
//! programming-tool concerns: `coding_session` projection, coding-server API,
//! workspace/terminal/git shells, and dialect normalization for UI.

mod agent_projection;
mod boundaries;
mod engine_registry;
mod host;
mod turn_executor;

pub use agent_projection::{
    kernel_model_descriptor_to_catalog_entry, KernelModelCatalogEntryProjection,
};
pub use boundaries::{
    BIRDCODER_OWNED_CAPABILITIES, KERNEL_OWNED_CAPABILITIES, LEGACY_CODEENGINE_SURFACES,
};
pub use engine_registry::{
    bootstrap_codex_kernel_slot, bootstrap_kernel_slot, canonical_engine_keys,
    is_canonical_engine_key, kernel_agent_id_for_engine, kernel_binding_id_for_engine,
    KernelBootstrapError, KernelEngineSlot,
};
pub use host::BirdcoderKernelHost;
pub use turn_executor::execute_kernel_turn;
