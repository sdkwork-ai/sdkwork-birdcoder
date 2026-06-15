use serde::Deserialize;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishProjectRequest {
    pub endpoint_url: Option<String>,
    pub environment_key: Option<String>,
    pub release_kind: Option<String>,
    pub release_version: Option<String>,
    pub rollout_stage: Option<String>,
    pub runtime: Option<String>,
    pub target_id: Option<String>,
    pub target_name: Option<String>,
}

#[derive(Clone)]
pub struct PublishProjectCommand {
    pub project_id: String,
    pub project_name: String,
    pub project_tenant_id: String,
    pub project_organization_id: Option<String>,
    pub project_owner_id: Option<String>,
    pub project_created_by_user_id: Option<String>,
    pub current_user_id: Option<String>,
    pub request: PublishProjectRequest,
}
