use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamPasswordResetCreateRequest {
    pub account: String,

    pub code: String,

    #[serde(rename = "confirmPassword")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirm_password: Option<String>,

    #[serde(rename = "newPassword")]
    pub new_password: String,
}
