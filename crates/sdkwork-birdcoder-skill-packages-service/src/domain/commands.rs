use serde::Deserialize;

// ── Install skill package ────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillPackageRequest {
    pub scope_id: String,
    pub scope_type: String,
}

pub struct InstallSkillPackageInput {
    pub scope_id: String,
    pub scope_type: String,
}
