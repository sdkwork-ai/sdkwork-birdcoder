use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionProviderSummary {
    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "displayName")]
    pub display_name: String,

    #[serde(rename = "nativeSessionIdPrefix")]
    pub native_session_id_prefix: String,

    #[serde(rename = "transportKinds")]
    pub transport_kinds: Vec<String>,

    /// Discovery mode for native engine session inventory.
    #[serde(rename = "discoveryMode")]
    pub discovery_mode: String,
}
