use std::sync::Arc;

use crate::api::paths::app_path;
use crate::api::paths::append_query_string;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderCommitProjectGitChangesRequest, BirdCoderCreateProjectGitBranchRequest, BirdCoderCreateProjectGitWorktreeRequest, BirdCoderCreateProjectRequest, BirdCoderCreateWorkspaceRequest, BirdCoderDeletedResourceEnvelope, BirdCoderDeploymentRecordSummaryListEnvelope, BirdCoderDeploymentTargetSummaryListEnvelope, BirdCoderProjectCollaboratorSummaryEnvelope, BirdCoderProjectCollaboratorSummaryListEnvelope, BirdCoderProjectGitOverviewEnvelope, BirdCoderProjectPublishResultEnvelope, BirdCoderProjectSummaryEnvelope, BirdCoderProjectSummaryListEnvelope, BirdCoderPublishProjectRequest, BirdCoderPushProjectGitBranchRequest, BirdCoderRemoveProjectGitWorktreeRequest, BirdCoderSwitchProjectGitBranchRequest, BirdCoderUpdateProjectRequest, BirdCoderUpdateWorkspaceRequest, BirdCoderUpsertProjectCollaboratorRequest, BirdCoderWorkspaceSummaryEnvelope, BirdCoderWorkspaceSummaryListEnvelope, ProblemDetail};

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
    pub async fn projects_list(&self, user_id: Option<&str>, workspace_id: Option<&str>, root_path: Option<&str>, limit: Option<i64>, offset: Option<i64>) -> Result<BirdCoderProjectSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("userId", user_id, "form", true, false, None),
            QueryParameterSpec::new("workspaceId", workspace_id, "form", true, false, None),
            QueryParameterSpec::new("rootPath", root_path, "form", true, false, None),
            QueryParameterSpec::new("limit", limit, "form", true, false, None),
            QueryParameterSpec::new("offset", offset, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/projects".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// Upsert project collaborator
    pub async fn projects_collaborators_upsert(&self, project_id: &str, body: &BirdCoderUpsertProjectCollaboratorRequest) -> Result<BirdCoderProjectCollaboratorSummaryEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/collaborators", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List project collaborators
    pub async fn projects_collaborators_list(&self, project_id: &str, limit: Option<i64>, offset: Option<i64>) -> Result<BirdCoderProjectCollaboratorSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("limit", limit, "form", true, false, None),
            QueryParameterSpec::new("offset", offset, "form", true, false, None),
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
    pub async fn workspaces_list(&self, user_id: Option<&str>, limit: Option<i64>, offset: Option<i64>) -> Result<BirdCoderWorkspaceSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("userId", user_id, "form", true, false, None),
            QueryParameterSpec::new("limit", limit, "form", true, false, None),
            QueryParameterSpec::new("offset", offset, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/workspaces".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// Delete project
    pub async fn projects_delete(&self, project_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
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
    pub async fn workspaces_delete(&self, workspace_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
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

    /// Subscribe to workspace realtime invalidation events
    pub async fn workspaces_realtime_subscribe(&self, workspace_id: &str, session_id: Option<&str>) -> Result<ProblemDetail, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("sessionId", session_id, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/workspaces/{}/realtime", serialize_path_parameter(workspace_id, PathParameterSpec::new("workspaceId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// List deployments
    pub async fn deployments_list(&self, limit: Option<i64>, offset: Option<i64>) -> Result<BirdCoderDeploymentRecordSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("limit", limit, "form", true, false, None),
            QueryParameterSpec::new("offset", offset, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&"/deployments".to_string()), &query);
        self.client.get(&path, None, None).await
    }

    /// List project deployment targets
    pub async fn projects_deployment_targets_list(&self, project_id: &str, limit: Option<i64>, offset: Option<i64>) -> Result<BirdCoderDeploymentTargetSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("limit", limit, "form", true, false, None),
            QueryParameterSpec::new("offset", offset, "form", true, false, None),
        ]);
        let path = append_query_string(app_path(&format!("/projects/{}/deployment_targets", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false)))), &query);
        self.client.get(&path, None, None).await
    }

    /// Get project Git overview
    pub async fn projects_git_overview_retrieve(&self, project_id: &str) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/overview", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
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
    pub async fn projects_git_worktree_prune_create(&self, project_id: &str) -> Result<BirdCoderProjectGitOverviewEnvelope, SdkworkError> {
        let path = app_path(&format!("/projects/{}/git/worktree_prune", serialize_path_parameter(project_id, PathParameterSpec::new("projectId", "simple", false))));
        self.client.post(&path, Option::<&serde_json::Value>::None, None, None, None).await
    }

    /// Publish project release flow
    pub async fn projects_publish_create(&self, project_id: &str, body: &BirdCoderPublishProjectRequest) -> Result<BirdCoderProjectPublishResultEnvelope, SdkworkError> {
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
