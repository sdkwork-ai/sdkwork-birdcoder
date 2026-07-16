use std::sync::Arc;

use crate::api::base::{RequestHeaders};
use crate::api::paths::app_path;
use crate::api::paths::append_query_string;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderCommitProjectGitChangesRequest, BirdCoderCreateProjectGitBranchRequest, BirdCoderCreateProjectGitWorktreeRequest, BirdCoderCreateProjectRequest, BirdCoderCreateProjectRuntimeLocationRequest, BirdCoderCreateWorkspaceRequest, BirdCoderDeploymentRecordSummaryListEnvelope, BirdCoderDeploymentTargetSummaryListEnvelope, BirdCoderProjectCollaboratorSummaryEnvelope, BirdCoderProjectCollaboratorSummaryListEnvelope, BirdCoderProjectGitDiffEnvelope, BirdCoderProjectGitOverviewEnvelope, BirdCoderProjectPublishResultEnvelope, BirdCoderProjectRuntimeLocationCommandEnvelope, BirdCoderProjectRuntimeLocationEnvelope, BirdCoderProjectRuntimeLocationListEnvelope, BirdCoderProjectRuntimeLocationPreferenceEnvelope, BirdCoderProjectRuntimeLocationPreferenceListEnvelope, BirdCoderProjectSummaryEnvelope, BirdCoderProjectSummaryListEnvelope, BirdCoderProjectWorkspaceBindingEnvelope, BirdCoderPruneProjectGitWorktreesRequest, BirdCoderPublishProjectRequest, BirdCoderPushProjectGitBranchRequest, BirdCoderRebindProjectRuntimeLocationRequest, BirdCoderRemoveProjectGitWorktreeRequest, BirdCoderSetProjectRuntimeLocationPreferenceRequest, BirdCoderSwitchProjectGitBranchRequest, BirdCoderUpdateProjectRequest, BirdCoderUpdateProjectRuntimeLocationRequest, BirdCoderUpdateWorkspaceRequest, BirdCoderUpsertProjectCollaboratorRequest, BirdCoderUpsertProjectWorkspaceBindingRequest, BirdCoderWorkspaceSummaryEnvelope, BirdCoderWorkspaceSummaryListEnvelope};

#[derive(Clone)]
pub struct PlatformApi {
    client: Arc<SdkworkHttpClient>,
}

impl PlatformApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Create project
    pub async fn projects_create(&self, body: &BirdCoderCreateProjectRequest) -> Result<BirdCoderProjectSummaryEnvelope, SdkworkError> {
        let path = app_path(&"/projects".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List projects
    pub async fn projects_list(&self, user_id: Option<&str>, workspace_id: Option<&str>, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderProjectSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("userId", user_id, "form", true, false, None),
            QueryParameterSpec::new("workspaceId", workspace_id, "form", true, false, None),
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/projects".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// Upsert project collaborator
    pub async fn projects_collaborators_create(&self, project_id: &str, body: &BirdCoderUpsertProjectCollaboratorRequest) -> Result<BirdCoderProjectCollaboratorSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/collaborators", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List project collaborators
    pub async fn projects_collaborators_list(&self, project_id: &str, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderProjectCollaboratorSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/collaborators", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Create workspace
    pub async fn workspaces_create(&self, body: &BirdCoderCreateWorkspaceRequest) -> Result<BirdCoderWorkspaceSummaryEnvelope, SdkworkError> {
        let path = app_path(&"/workspaces".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List workspaces
    pub async fn workspaces_list(&self, user_id: Option<&str>, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderWorkspaceSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("userId", user_id, "form", true, false, None),
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/workspaces".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// Delete project
    pub async fn projects_delete(&self, project_id: &str) -> Result<(), SdkworkError> {
        let path = app_path(&format!("/projects/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// Get project
    pub async fn projects_retrieve(&self, project_id: &str) -> Result<BirdCoderProjectSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update project
    pub async fn projects_update(&self, project_id: &str, body: &BirdCoderUpdateProjectRequest) -> Result<BirdCoderProjectSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete workspace
    pub async fn workspaces_delete(&self, workspace_id: &str) -> Result<(), SdkworkError> {
        let path = app_path(&format!("/workspaces/{}", serialize_path_parameter(workspace_id, PathParameterSpec::new("workspaceId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// Get workspace
    pub async fn workspaces_retrieve(&self, workspace_id: &str) -> Result<BirdCoderWorkspaceSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/workspaces/{}", serialize_path_parameter(workspace_id, PathParameterSpec::new("workspaceId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update workspace
    pub async fn workspaces_update(&self, workspace_id: &str, body: &BirdCoderUpdateWorkspaceRequest) -> Result<BirdCoderWorkspaceSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/workspaces/{}", serialize_path_parameter(workspace_id, PathParameterSpec::new("workspaceId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List deployments
    pub async fn deployments_list(&self, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderDeploymentRecordSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/deployments".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// List project deployment targets
    pub async fn projects_deployment_targets_list(&self, project_id: &str, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderDeploymentTargetSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/deployment_targets", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Get project workspace binding
    pub async fn projects_workspace_binding_retrieve(&self, project_id: &str) -> Result<BirdCoderProjectWorkspaceBindingEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/workspace_binding", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Create or update project workspace binding
    pub async fn projects_workspace_binding_update(&self, project_id: &str, body: &BirdCoderUpsertProjectWorkspaceBindingRequest, idempotency_key: &str, if_match: Option<&str>) -> Result<BirdCoderProjectWorkspaceBindingEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/workspace_binding", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.put(&path, Some(body), None, headers.as_ref(), Some("application/json")).await
    }

    /// Delete project workspace binding
    pub async fn projects_workspace_binding_delete(&self, project_id: &str, if_match: &str) -> Result<(), SdkworkError> {
        let path = app_path(&format!("/projects/{}/workspace_binding", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
            ],
            &[],
        );
        self.client.delete(&path, None, headers.as_ref()).await
    }

    /// List project runtime locations
    pub async fn projects_runtime_locations_list(&self, project_id: &str, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderProjectRuntimeLocationListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/runtime_locations", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Register project runtime location
    pub async fn projects_runtime_locations_create(&self, project_id: &str, body: &BirdCoderCreateProjectRuntimeLocationRequest, idempotency_key: &str) -> Result<BirdCoderProjectRuntimeLocationEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.post(&path, Some(body), None, headers.as_ref(), Some("application/json")).await
    }

    /// Get project runtime location
    pub async fn projects_runtime_locations_retrieve(&self, project_id: &str, runtime_location_id: &str) -> Result<BirdCoderProjectRuntimeLocationEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(runtime_location_id, PathParameterSpec::new("runtimeLocationId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update project runtime location
    pub async fn projects_runtime_locations_update(&self, project_id: &str, runtime_location_id: &str, body: &BirdCoderUpdateProjectRuntimeLocationRequest, if_match: &str, idempotency_key: &str) -> Result<BirdCoderProjectRuntimeLocationEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(runtime_location_id, PathParameterSpec::new("runtimeLocationId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.patch(&path, Some(body), None, headers.as_ref(), Some("application/json")).await
    }

    /// Delete project runtime location
    pub async fn projects_runtime_locations_delete(&self, project_id: &str, runtime_location_id: &str, if_match: &str) -> Result<(), SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(runtime_location_id, PathParameterSpec::new("runtimeLocationId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
            ],
            &[],
        );
        self.client.delete(&path, None, headers.as_ref()).await
    }

    /// Rebind project runtime location
    pub async fn projects_runtime_locations_rebind(&self, project_id: &str, runtime_location_id: &str, body: &BirdCoderRebindProjectRuntimeLocationRequest, if_match: &str, idempotency_key: &str) -> Result<BirdCoderProjectRuntimeLocationCommandEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations/{}/rebind", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(runtime_location_id, PathParameterSpec::new("runtimeLocationId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.post(&path, Some(body), None, headers.as_ref(), Some("application/json")).await
    }

    /// Request project runtime-location verification
    pub async fn projects_runtime_locations_request_verification(&self, project_id: &str, runtime_location_id: &str, if_match: &str, idempotency_key: &str) -> Result<BirdCoderProjectRuntimeLocationCommandEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_locations/{}/request_verification", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(runtime_location_id, PathParameterSpec::new("runtimeLocationId", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.post(&path, Option::<&serde_json::Value>::None, None, headers.as_ref(), None).await
    }

    /// List project runtime-location preferences
    pub async fn projects_runtime_locations_preferences_list(&self, project_id: &str, page: Option<i64>, page_size: Option<i64>) -> Result<BirdCoderProjectRuntimeLocationPreferenceListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("page", page, "form", true, false, None),
            QueryParameterSpec::new("page_size", page_size, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/runtime_location_preferences", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Update project runtime-location preference
    pub async fn projects_runtime_locations_preferences_update(&self, project_id: &str, capability: &str, body: &BirdCoderSetProjectRuntimeLocationPreferenceRequest, idempotency_key: &str, if_match: Option<&str>) -> Result<BirdCoderProjectRuntimeLocationPreferenceEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/runtime_location_preferences/{}", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)), serialize_path_parameter(capability, PathParameterSpec::new("capability", "simple", false))));
        let headers = build_request_headers(
            &[
                ("If-Match", HeaderParameterSpec::new(if_match, "simple", false, None)),
                ("Idempotency-Key", HeaderParameterSpec::new(idempotency_key, "simple", false, None)),
            ],
            &[],
        );
        self.client.put(&path, Some(body), None, headers.as_ref(), Some("application/json")).await
    }

    /// Get project Git overview
    pub async fn projects_git_overview_retrieve(&self, project_id: &str, runtime_location_id: &str) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("runtime_location_id", runtime_location_id, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/git/overview", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Get project Git diff
    pub async fn projects_git_diff_retrieve(&self, project_id: &str, runtime_location_id: &str) -> Result<BirdCoderProjectGitDiffEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("runtime_location_id", runtime_location_id, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/git/diff", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Create project Git branch
    pub async fn projects_git_branches_create(&self, project_id: &str, body: &BirdCoderCreateProjectGitBranchRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/branches", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Switch project Git branch
    pub async fn projects_git_branch_switch_create(&self, project_id: &str, body: &BirdCoderSwitchProjectGitBranchRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/branch_switch", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Commit project Git changes
    pub async fn projects_git_commits_create(&self, project_id: &str, body: &BirdCoderCommitProjectGitChangesRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/commits", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Push project Git branch
    pub async fn projects_git_pushes_create(&self, project_id: &str, body: &BirdCoderPushProjectGitBranchRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/pushes", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Create project Git worktree
    pub async fn projects_git_worktrees_create(&self, project_id: &str, body: &BirdCoderCreateProjectGitWorktreeRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/worktrees", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Remove project Git worktree
    pub async fn projects_git_worktree_removals_create(&self, project_id: &str, body: &BirdCoderRemoveProjectGitWorktreeRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/worktree_removals", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Prune project Git worktrees
    pub async fn projects_git_worktree_prune_create(&self, project_id: &str, body: &BirdCoderPruneProjectGitWorktreesRequest) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/worktree_prune", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Publish project release flow
    pub async fn projects_publish(&self, project_id: &str, body: &BirdCoderPublishProjectRequest) -> Result<BirdCoderProjectPublishResultEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/publish", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

}

struct PathParameterSpec<'a> {
    name: &'a str,
    style: &'a str,
    explode: bool,
}

impl<'a> PathParameterSpec<'a> {
    fn new(name: &'a str, style: &'a str, explode: bool) -> Self {
        Self { name, style, explode }
    }
}

fn serialize_path_parameter<T: serde::Serialize>(value: T, spec: PathParameterSpec<'_>) -> String {
    let value = serde_json::to_value(value).unwrap_or(serde_json::Value::Null);
    if value.is_null() {
        return String::new();
    }
    let style = if spec.style.is_empty() { "simple" } else { spec.style };
    match value {
        serde_json::Value::Array(values) => serialize_path_array(spec.name, &values, style, spec.explode),
        serde_json::Value::Object(values) => serialize_path_object(spec.name, &values, style, spec.explode),
        value => format!("{}{}", path_primitive_prefix(spec.name, style), percent_encode(&primitive_to_string(&value))),
    }
}

fn serialize_path_array(name: &str, values: &[serde_json::Value], style: &str, explode: bool) -> String {
    let serialized = values
        .iter()
        .filter(|value| !value.is_null())
        .map(|value| percent_encode(&primitive_to_string(value)))
        .collect::<Vec<_>>();
    if serialized.is_empty() {
        return path_prefix(name, style);
    }
    if style == "matrix" {
        if explode {
            return serialized.iter().map(|item| format!(";{}={}", name, item)).collect::<Vec<_>>().join("");
        }
        return format!(";{}={}", name, serialized.join(","));
    }
    let separator = if explode { "." } else { "," };
    format!("{}{}", path_prefix(name, style), serialized.join(separator))
}

fn serialize_path_object(
    name: &str,
    values: &serde_json::Map<String, serde_json::Value>,
    style: &str,
    explode: bool,
) -> String {
    let mut entries = Vec::new();
    let mut exploded = Vec::new();
    for (key, value) in values {
        if value.is_null() {
            continue;
        }
        let escaped_key = percent_encode(key);
        let escaped_value = percent_encode(&primitive_to_string(value));
        if explode {
            if style == "matrix" {
                exploded.push(format!(";{}={}", escaped_key, escaped_value));
            } else {
                exploded.push(format!("{}={}", escaped_key, escaped_value));
            }
        } else {
            entries.push(escaped_key);
            entries.push(escaped_value);
        }
    }
    if style == "matrix" {
        if explode {
            return exploded.join("");
        }
        return format!(";{}={}", name, entries.join(","));
    }
    if explode {
        let separator = if style == "label" { "." } else { "," };
        return format!("{}{}", path_prefix(name, style), exploded.join(separator));
    }
    format!("{}{}", path_prefix(name, style), entries.join(","))
}

fn path_prefix(name: &str, style: &str) -> String {
    match style {
        "label" => ".".to_string(),
        "matrix" => format!(";{}", name),
        _ => String::new(),
    }
}

fn path_primitive_prefix(name: &str, style: &str) -> String {
    if style == "matrix" {
        format!(";{}=", name)
    } else {
        path_prefix(name, style)
    }
}

struct HeaderParameterSpec {
    value: serde_json::Value,
    explode: bool,
    content_type: Option<&'static str>,
}

impl HeaderParameterSpec {
    fn new<T: serde::Serialize>(
        value: T,
        _style: &'static str,
        explode: bool,
        content_type: Option<&'static str>,
    ) -> Self {
        Self {
            value: serde_json::to_value(value).unwrap_or(serde_json::Value::Null),
            explode,
            content_type,
        }
    }
}

fn build_request_headers(headers: &[(&str, HeaderParameterSpec)], cookies: &[(&str, HeaderParameterSpec)]) -> Option<RequestHeaders> {
    let mut request_headers = RequestHeaders::new();
    for (name, parameter) in headers {
        if let Some(value) = serialize_header_parameter(parameter) {
            request_headers.insert((*name).to_string(), value);
        }
    }

    let cookie_header = build_cookie_header(cookies);
    if !cookie_header.is_empty() {
        request_headers
            .entry("Cookie".to_string())
            .and_modify(|existing| {
                existing.push_str("; ");
                existing.push_str(&cookie_header);
            })
            .or_insert(cookie_header);
    }

    if request_headers.is_empty() {
        None
    } else {
        Some(request_headers)
    }
}

fn build_cookie_header(cookies: &[(&str, HeaderParameterSpec)]) -> String {
    cookies
        .iter()
        .filter_map(|(name, value)| {
            serialize_header_parameter(value)
                .map(|value| format!("{}={}", percent_encode(name), percent_encode(&value)))
        })
        .collect::<Vec<_>>()
        .join("; ")
}

fn serialize_header_parameter(parameter: &HeaderParameterSpec) -> Option<String> {
    if parameter.value.is_null() {
        return None;
    }
    if parameter.content_type.is_some() {
        return Some(parameter.value.to_string());
    }
    match &parameter.value {
        serde_json::Value::Null => None,
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        serde_json::Value::Array(values) => {
            let serialized = values
                .iter()
                .filter_map(serialize_json_value)
                .collect::<Vec<_>>();
            if serialized.is_empty() {
                None
            } else {
                Some(serialized.join(","))
            }
        }
        serde_json::Value::Object(values) => {
            let serialized = values
                .iter()
                .filter_map(|(key, value)| {
                    serialize_json_value(value).map(|serialized| {
                        if parameter.explode {
                            format!("{}={}", key, serialized)
                        } else {
                            format!("{},{}", key, serialized)
                        }
                    })
                })
                .collect::<Vec<_>>();
            if serialized.is_empty() {
                None
            } else {
                Some(serialized.join(","))
            }
        }
    }
}

fn serialize_json_value(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        other => Some(other.to_string()),
    }
}

struct QueryParameterSpec<'a> {
    name: &'a str,
    value: serde_json::Value,
    style: &'a str,
    explode: bool,
    allow_reserved: bool,
    content_type: Option<&'a str>,
}

impl<'a> QueryParameterSpec<'a> {
    fn new<T: serde::Serialize>(
        name: &'a str,
        value: T,
        style: &'a str,
        explode: bool,
        allow_reserved: bool,
        content_type: Option<&'a str>,
    ) -> Self {
        Self {
            name,
            value: serde_json::to_value(value).unwrap_or(serde_json::Value::Null),
            style,
            explode,
            allow_reserved,
            content_type,
        }
    }
}

fn build_query_string(parameters: &[QueryParameterSpec<'_>]) -> String {
    let mut pairs = Vec::new();
    for parameter in parameters {
        append_serialized_parameter(&mut pairs, parameter);
    }
    pairs.join("&")
}

fn append_serialized_parameter(pairs: &mut Vec<String>, parameter: &QueryParameterSpec<'_>) {
    if parameter.value.is_null() {
        return;
    }
    if parameter.content_type.is_some() {
        pairs.push(format!(
            "{}={}",
            percent_encode(parameter.name),
            encode_query_value(&parameter.value.to_string(), parameter.allow_reserved)
        ));
        return;
    }

    let style = if parameter.style.is_empty() { "form" } else { parameter.style };
    match &parameter.value {
        serde_json::Value::Array(values) => append_array_parameter(pairs, parameter.name, values, style, parameter.explode, parameter.allow_reserved),
        serde_json::Value::Object(values) if style == "deepObject" => append_deep_object_parameter(pairs, parameter.name, values, parameter.allow_reserved),
        serde_json::Value::Object(values) => append_object_parameter(pairs, parameter.name, values, style, parameter.explode, parameter.allow_reserved),
        value => pairs.push(format!("{}={}", percent_encode(parameter.name), encode_query_value(&primitive_to_string(value), parameter.allow_reserved))),
    }
}

fn append_array_parameter(
    pairs: &mut Vec<String>,
    name: &str,
    values: &[serde_json::Value],
    style: &str,
    explode: bool,
    allow_reserved: bool,
) {
    let serialized = values.iter().filter(|value| !value.is_null()).map(primitive_to_string).collect::<Vec<_>>();
    if serialized.is_empty() {
        return;
    }
    if style == "form" && explode {
        for item in serialized {
            pairs.push(format!("{}={}", percent_encode(name), encode_query_value(&item, allow_reserved)));
        }
        return;
    }
    pairs.push(format!("{}={}", percent_encode(name), encode_query_value(&serialized.join(","), allow_reserved)));
}

fn append_object_parameter(
    pairs: &mut Vec<String>,
    name: &str,
    values: &serde_json::Map<String, serde_json::Value>,
    style: &str,
    explode: bool,
    allow_reserved: bool,
) {
    let mut serialized = Vec::new();
    for (key, value) in values {
        if value.is_null() {
            continue;
        }
        if style == "form" && explode {
            pairs.push(format!("{}={}", percent_encode(key), encode_query_value(&primitive_to_string(value), allow_reserved)));
        } else {
            serialized.push(key.clone());
            serialized.push(primitive_to_string(value));
        }
    }
    if !serialized.is_empty() {
        pairs.push(format!("{}={}", percent_encode(name), encode_query_value(&serialized.join(","), allow_reserved)));
    }
}

fn append_deep_object_parameter(
    pairs: &mut Vec<String>,
    name: &str,
    values: &serde_json::Map<String, serde_json::Value>,
    allow_reserved: bool,
) {
    for (key, value) in values {
        if !value.is_null() {
            pairs.push(format!("{}={}", percent_encode(&format!("{}[{}]", name, key)), encode_query_value(&primitive_to_string(value), allow_reserved)));
        }
    }
}

fn encode_query_value(value: &str, allow_reserved: bool) -> String {
    let mut encoded = percent_encode(value);
    if !allow_reserved {
        return encoded;
    }
    for (escaped, reserved) in [
        ("%3A", ":"), ("%2F", "/"), ("%3F", "?"), ("%23", "#"),
        ("%5B", "["), ("%5D", "]"), ("%40", "@"), ("%21", "!"),
        ("%24", "$"), ("%26", "&"), ("%27", "'"), ("%28", "("),
        ("%29", ")"), ("%2A", "*"), ("%2B", "+"), ("%2C", ","),
        ("%3B", ";"), ("%3D", "="),
    ] {
        encoded = encoded.replace(escaped, reserved);
    }
    encoded
}

fn primitive_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Number(value) => value.to_string(),
        serde_json::Value::Bool(value) => value.to_string(),
        other => other.to_string(),
    }
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{:02X}", byte).chars().collect(),
        })
        .collect()
}
