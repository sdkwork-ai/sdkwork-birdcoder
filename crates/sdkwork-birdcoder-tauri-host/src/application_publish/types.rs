use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishDiagnostic {
    pub exit_code: Option<i32>,
    pub stderr: String,
    pub stdout: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<ApplicationPublishDiagnostic>,
}

impl ApplicationPublishError {
    pub(crate) fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            diagnostic: None,
        }
    }

    pub(crate) fn with_diagnostic(
        code: &str,
        message: impl Into<String>,
        diagnostic: ApplicationPublishDiagnostic,
    ) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            diagnostic: Some(diagnostic),
        }
    }
}

impl std::fmt::Display for ApplicationPublishError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApplicationPublishError {}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishOutputSnapshot {
    pub path: String,
    pub output_type: String,
    pub archive: Option<String>,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishTargetSnapshot {
    pub id: String,
    pub label: String,
    pub command: Option<String>,
    pub cwd: Option<String>,
    pub package_id: Option<String>,
    pub platform: Option<String>,
    pub runtime_target: Option<String>,
    pub outputs: Vec<ApplicationPublishOutputSnapshot>,
    pub ready: bool,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishApplicationSnapshot {
    pub application_id: String,
    pub app_key: Option<String>,
    pub name: String,
    pub relative_path: String,
    pub kind: String,
    pub framework: Option<String>,
    pub manifest_status: String,
    pub publish_status: String,
    pub targets: Vec<ApplicationPublishTargetSnapshot>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishDiscoverySnapshot {
    pub applications: Vec<ApplicationPublishApplicationSnapshot>,
    pub scan_limit_reached: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishPreflightSnapshot {
    pub plan_id: String,
    pub application_id: String,
    pub app_key: Option<String>,
    pub application_name: String,
    pub application_relative_path: String,
    pub application_kind: String,
    pub framework: Option<String>,
    pub manifest_digest: String,
    pub target: ApplicationPublishTargetSnapshot,
    pub expires_in_seconds: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishArtifactSnapshot {
    pub artifact_id: String,
    pub package_id: String,
    pub output_type: String,
    pub file_name: String,
    pub content_type: String,
    pub byte_length: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishBuildSnapshot {
    pub plan_id: String,
    pub artifacts: Vec<ApplicationPublishArtifactSnapshot>,
    pub diagnostic: ApplicationPublishDiagnostic,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPublishArtifactDiscardSnapshot {
    pub artifact_id: String,
    pub discarded: bool,
}
