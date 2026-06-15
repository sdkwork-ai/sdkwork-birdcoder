use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUserQuestionAnswerResult {
    #[serde(rename = "questionId")]
    pub question_id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,

    #[serde(rename = "answeredAt")]
    pub answered_at: String,

    #[serde(rename = "optionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_id: Option<String>,

    #[serde(rename = "optionLabel")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_label: Option<String>,

    pub rejected: bool,

    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    #[serde(rename = "runtimeStatus")]
    pub runtime_status: String,

    #[serde(rename = "turnId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
}
