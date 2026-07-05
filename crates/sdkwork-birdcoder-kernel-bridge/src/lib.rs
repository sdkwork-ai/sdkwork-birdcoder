//! BirdCoder integration boundary for `sdkwork-agents` runtime facade.
//!
//! Agent runtime SPI is owned by `sdkwork-kernel` and exposed to products only
//! through `sdkwork-agents-runtime-facade`. BirdCoder keeps programming-tool
//! concerns: `coding_session` projection, coding-server API, workspace shells,
//! and dialect normalization for UI.

mod agent_projection;
mod boundaries;
mod chat_assistant;
mod engine_registry;
mod host;
mod turn_executor;

pub use agent_projection::{
    kernel_model_descriptor_to_catalog_entry, KernelModelCatalogEntryProjection,
};
pub use boundaries::{
    AGENTS_OWNED_CAPABILITIES, BIRDCODER_OWNED_CAPABILITIES, KERNEL_OWNED_CAPABILITIES,
    LEGACY_CODEENGINE_SURFACES,
};
pub use engine_registry::{
    bootstrap_codex_kernel_slot, bootstrap_kernel_slot, canonical_engine_keys,
    is_canonical_engine_key, kernel_agent_id_for_engine, kernel_binding_id_for_engine,
    KernelBootstrapError, KernelEngineSlot,
};
pub use host::{
    submit_approval_decision, submit_user_question_answer, BirdcoderKernelHost,
};
pub use sdkwork_agents_runtime_facade::{
    AgentsCodeEngineHost, ApprovalDecision, CodeEngineCatalog, CodeEngineModelCatalogEntry,
    CodeEngineTurnInput, CodeEngineTurnOutput, EngineLiveInteraction, LiveInteractionRegistry,
    UserQuestionAnswer,
};
pub use chat_assistant::generate_mobile_chat_assistant_reply;
pub use turn_executor::execute_kernel_turn;
