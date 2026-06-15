use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineOfficialEntry {
    #[serde(rename = "packageName")]
    pub package_name: String,

    #[serde(rename = "packageVersion")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_version: Option<String>,

    #[serde(rename = "sdkPath")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sdk_path: Option<String>,

    #[serde(rename = "cliPackageName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cli_package_name: Option<String>,

    #[serde(rename = "sourceMirrorPath")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_mirror_path: Option<String>,

    #[serde(rename = "supplementalLanes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supplemental_lanes: Option<Vec<String>>,
}
