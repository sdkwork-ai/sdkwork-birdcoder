use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpsertProjectSandboxBindingRequest {
    /// Opaque Drive sandbox identifier.
    #[serde(rename = "sandboxId")]
    pub sandbox_id: String,

    /// Opaque Drive directory-entry identifier.
    #[serde(rename = "rootEntryId")]
    pub root_entry_id: String,

    /// Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root.
    #[serde(rename = "logicalPath")]
    pub logical_path: String,
}
