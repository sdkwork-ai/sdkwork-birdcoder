use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiProblemDetails {
    pub code: String,

    pub message: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,

    pub retryable: bool,

    #[serde(rename = "fieldErrors")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field_errors: Option<std::collections::HashMap<String, String>>,
}
