//! Responsibility split between BirdCoder, sdkwork-agents, and sdkwork-kernel.

/// Capabilities owned by sdkwork-kernel (agent SPI — not consumed directly by BirdCoder).
pub const KERNEL_OWNED_CAPABILITIES: &[&str] = &[
    "agent.manifest",
    "agent.runtime",
    "agent.session",
    "agent.model",
    "agent.tool",
    "agent.policy",
    "agent.event",
    "agent.adapter",
    "agent.sdk.binding",
    "code.workspace",
    "code.vcs",
    "code.patch",
    "code.terminal",
    "code.verification",
    "code.review",
    "code.artifact",
    "code.safety",
];

/// Capabilities owned by sdkwork-agents application layer.
pub const AGENTS_OWNED_CAPABILITIES: &[&str] = &[
    "agents-runtime-facade",
    "agents-engine-catalog-api",
    "agents-domain-service",
    "agents-http-routes",
    "agents-managed-agents",
    "agents-provider-bindings",
    "agents-runtime-executions",
];

/// Capabilities that remain BirdCoder product/tooling concerns.
pub const BIRDCODER_OWNED_CAPABILITIES: &[&str] = &[
    "coding_session",
    "coding_session_turn",
    "coding_session_message",
    "coding_session_event",
    "coding_session_artifact",
    "coding_session_checkpoint",
    "coding-server.app-api",
    "coding-server.backend-api",
    "workbench.ui",
    "workbench.terminal-launch",
    "workbench.model-config",
    "codeengine.dialect",
    "native-session.catalog",
];

/// Legacy BirdCoder surfaces retired after agents runtime facade rollout.
pub const LEGACY_CODEENGINE_SURFACES: &[&str] = &[];
