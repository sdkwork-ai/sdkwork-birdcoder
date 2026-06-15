use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationScanRequest {
    #[serde(rename = "scanSource")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scan_source: Option<String>,
}
