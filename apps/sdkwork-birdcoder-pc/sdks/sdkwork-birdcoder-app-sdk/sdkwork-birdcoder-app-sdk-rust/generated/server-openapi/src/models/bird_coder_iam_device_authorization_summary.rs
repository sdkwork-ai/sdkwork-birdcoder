use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationSummary {
    #[serde(rename = "expiresAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,

    #[serde(rename = "qrContent")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_content: Option<String>,

    #[serde(rename = "qrUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_url: Option<String>,

    #[serde(rename = "deviceAuthorizationId")]
    pub device_authorization_id: String,

    pub status: String,
}
