use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationSummary {
    #[serde(rename = "deviceAuthorizationId")]
    pub device_authorization_id: String,

    #[serde(rename = "expiresAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,

    #[serde(rename = "pollSecret")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poll_secret: Option<String>,

    #[serde(rename = "qrContent")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_content: Option<String>,

    #[serde(rename = "qrUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_url: Option<String>,

    #[serde(rename = "sessionReady")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_ready: Option<bool>,

    pub status: String,
}
