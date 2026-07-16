use serde::{Deserialize, Serialize};

/// BirdCoder-owned binding to a Drive sandbox directory. Physical paths, provider roots, browser handles, and Tauri paths are never stored or returned. Every filesystem operation must authorize against Drive again.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectWorkspaceBinding {
    /// Opaque BirdCoder workspace-binding identifier.
    pub id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    /// Opaque Drive sandbox identifier. This reference does not grant Drive access.
    #[serde(rename = "sandboxId")]
    pub sandbox_id: String,

    /// Opaque Drive entry identifier selected as the project root.
    #[serde(rename = "rootEntryId")]
    pub root_entry_id: String,

    /// Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root.
    #[serde(rename = "logicalPath")]
    pub logical_path: String,

    #[serde(rename = "lifecycleStatus")]
    pub lifecycle_status: String,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
