//! Responsibility split between BirdCoder and sdkwork-kernel.

/// Capabilities that must stay in sdkwork-kernel (agent SPI).
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

/// Legacy BirdCoder surfaces retired after kernel bridge rollout.
pub const LEGACY_CODEENGINE_SURFACES: &[&str] = &[];
