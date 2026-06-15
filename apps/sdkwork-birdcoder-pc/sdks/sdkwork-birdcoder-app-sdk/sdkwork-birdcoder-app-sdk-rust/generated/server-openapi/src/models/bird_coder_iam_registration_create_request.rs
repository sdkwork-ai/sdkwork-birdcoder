use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamRegistrationCreateRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,

    #[serde(rename = "confirmPassword")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirm_password: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,

    #[serde(rename = "verificationCode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_code: Option<String>,
}
