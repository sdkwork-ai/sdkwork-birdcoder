use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamUpdateCurrentSessionRequest {
    #[serde(rename = "deviceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,

    #[serde(rename = "deviceName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trusted: Option<bool>,
}
