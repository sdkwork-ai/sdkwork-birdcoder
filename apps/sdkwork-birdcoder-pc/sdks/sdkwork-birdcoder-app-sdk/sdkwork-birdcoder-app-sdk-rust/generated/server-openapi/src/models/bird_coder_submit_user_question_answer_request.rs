use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSubmitUserQuestionAnswerRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,

    #[serde(rename = "optionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_id: Option<String>,

    #[serde(rename = "optionLabel")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_label: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rejected: Option<bool>,
}
