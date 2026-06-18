use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderIamRuntimeSettingsSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamRuntimeSettingsEnvelope {
    pub data: BirdCoderIamRuntimeSettingsSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
