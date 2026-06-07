use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamCreateSessionRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account: Option<String>,

    #[serde(rename = "appVersion")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_version: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    #[serde(rename = "deviceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,

    #[serde(rename = "deviceName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_name: Option<String>,

    #[serde(rename = "deviceType")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_type: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    #[serde(rename = "grantType")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grant_type: Option<String>,

    #[serde(rename = "loginMethod")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub login_method: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}
