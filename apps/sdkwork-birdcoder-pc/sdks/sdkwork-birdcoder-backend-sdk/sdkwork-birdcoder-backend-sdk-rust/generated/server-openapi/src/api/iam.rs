use std::sync::Arc;

use crate::api::paths::backend_path;
use crate::api::paths::append_query_string;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderBooleanSuccessEnvelope, BirdCoderCreateIamOrganizationMemberRequest, BirdCoderCreateIamOrganizationRequest, BirdCoderCreateIamPermissionRequest, BirdCoderCreateIamPolicyRequest, BirdCoderCreateIamRolePermissionRequest, BirdCoderCreateIamRoleRequest, BirdCoderCreateIamTenantMemberRequest, BirdCoderCreateIamTenantRequest, BirdCoderCreateIamUserRequest, BirdCoderCreateIamUserRoleRequest, BirdCoderDeletedResourceEnvelope, BirdCoderIamApiKeySummaryListEnvelope, BirdCoderIamAuditEventSummaryListEnvelope, BirdCoderIamOrganizationMemberSummaryEnvelope, BirdCoderIamOrganizationSummaryEnvelope, BirdCoderIamPermissionSummaryEnvelope, BirdCoderIamPermissionSummaryListEnvelope, BirdCoderIamPolicySummaryEnvelope, BirdCoderIamPolicySummaryListEnvelope, BirdCoderIamRolePermissionSummaryEnvelope, BirdCoderIamRolePermissionSummaryListEnvelope, BirdCoderIamRoleSummaryEnvelope, BirdCoderIamRoleSummaryListEnvelope, BirdCoderIamSecurityEventSummaryListEnvelope, BirdCoderIamTenantMemberSummaryEnvelope, BirdCoderIamTenantMemberSummaryListEnvelope, BirdCoderIamTenantSummaryEnvelope, BirdCoderIamTenantSummaryListEnvelope, BirdCoderIamUserRoleSummaryEnvelope, BirdCoderIamUserSummaryEnvelope, BirdCoderIamUserSummaryListEnvelope, BirdCoderTeamMemberSummaryListEnvelope, BirdCoderTeamSummaryListEnvelope, BirdCoderUpdateIamOrganizationMemberRequest, BirdCoderUpdateIamOrganizationRequest, BirdCoderUpdateIamPermissionRequest, BirdCoderUpdateIamPolicyRequest, BirdCoderUpdateIamRoleRequest, BirdCoderUpdateIamTenantMemberRequest, BirdCoderUpdateIamTenantRequest, BirdCoderUpdateIamUserRequest};

#[derive(Clone)]
pub struct IamApi {
    client: Arc<SdkworkHttpClient>,
}

impl IamApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// List SDKWork IAM API keys
    pub async fn api_keys_list(&self) -> Result<BirdCoderIamApiKeySummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/api_keys".to_string());
        self.client.get(&path, None, None).await
    }

    /// Revoke SDKWork IAM API key
    pub async fn api_keys_revoke(&self, api_key_id: &str) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/api_keys/{}/revoke", serialize_path_parameter(api_key_id, PathParameterSpec::new("apiKeyId", "simple", false))));
        self.client.post(&path, Option::<&serde_json::Value>::None, None, None, None).await
    }

    /// List SDKWork IAM audit events
    pub async fn audit_events_list(&self) -> Result<BirdCoderIamAuditEventSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/audit_events".to_string());
        self.client.get(&path, None, None).await
    }

    /// Get SDKWork IAM organization
    pub async fn organizations_retrieve(&self, organization_id: &str) -> Result<BirdCoderIamOrganizationSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/organizations/{}", serialize_path_parameter(organization_id, PathParameterSpec::new("organizationId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM organization
    pub async fn organizations_update(&self, organization_id: &str, body: &BirdCoderUpdateIamOrganizationRequest) -> Result<BirdCoderIamOrganizationSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/organizations/{}", serialize_path_parameter(organization_id, PathParameterSpec::new("organizationId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM organization
    pub async fn organizations_delete(&self, organization_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/organizations/{}", serialize_path_parameter(organization_id, PathParameterSpec::new("organizationId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// Create SDKWork IAM organization
    pub async fn organizations_create(&self, body: &BirdCoderCreateIamOrganizationRequest) -> Result<BirdCoderIamOrganizationSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/organizations".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Create SDKWork IAM organization membership
    pub async fn organization_memberships_create(&self, body: &BirdCoderCreateIamOrganizationMemberRequest) -> Result<BirdCoderIamOrganizationMemberSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/organization_memberships".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Update SDKWork IAM organization membership
    pub async fn organization_memberships_update(&self, membership_id: &str, body: &BirdCoderUpdateIamOrganizationMemberRequest) -> Result<BirdCoderIamOrganizationMemberSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/organization_memberships/{}", serialize_path_parameter(membership_id, PathParameterSpec::new("membershipId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// List SDKWork IAM permissions
    pub async fn permissions_list(&self) -> Result<BirdCoderIamPermissionSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/permissions".to_string());
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM permission
    pub async fn permissions_create(&self, body: &BirdCoderCreateIamPermissionRequest) -> Result<BirdCoderIamPermissionSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/permissions".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM permission
    pub async fn permissions_retrieve(&self, permission_id: &str) -> Result<BirdCoderIamPermissionSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/permissions/{}", serialize_path_parameter(permission_id, PathParameterSpec::new("permissionId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM permission
    pub async fn permissions_update(&self, permission_id: &str, body: &BirdCoderUpdateIamPermissionRequest) -> Result<BirdCoderIamPermissionSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/permissions/{}", serialize_path_parameter(permission_id, PathParameterSpec::new("permissionId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM permission
    pub async fn permissions_delete(&self, permission_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/permissions/{}", serialize_path_parameter(permission_id, PathParameterSpec::new("permissionId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM policies
    pub async fn policies_list(&self) -> Result<BirdCoderIamPolicySummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/policies".to_string());
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM policy
    pub async fn policies_create(&self, body: &BirdCoderCreateIamPolicyRequest) -> Result<BirdCoderIamPolicySummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/policies".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM policy
    pub async fn policies_retrieve(&self, policy_id: &str) -> Result<BirdCoderIamPolicySummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/policies/{}", serialize_path_parameter(policy_id, PathParameterSpec::new("policyId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM policy
    pub async fn policies_update(&self, policy_id: &str, body: &BirdCoderUpdateIamPolicyRequest) -> Result<BirdCoderIamPolicySummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/policies/{}", serialize_path_parameter(policy_id, PathParameterSpec::new("policyId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM policy
    pub async fn policies_delete(&self, policy_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/policies/{}", serialize_path_parameter(policy_id, PathParameterSpec::new("policyId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM roles
    pub async fn roles_list(&self) -> Result<BirdCoderIamRoleSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/roles".to_string());
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM role
    pub async fn roles_create(&self, body: &BirdCoderCreateIamRoleRequest) -> Result<BirdCoderIamRoleSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/roles".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM role
    pub async fn roles_retrieve(&self, role_id: &str) -> Result<BirdCoderIamRoleSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM role
    pub async fn roles_update(&self, role_id: &str, body: &BirdCoderUpdateIamRoleRequest) -> Result<BirdCoderIamRoleSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM role
    pub async fn roles_delete(&self, role_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM role permissions
    pub async fn roles_permissions_list(&self, role_id: &str) -> Result<BirdCoderIamRolePermissionSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}/permissions", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM role permission
    pub async fn roles_permissions_create(&self, role_id: &str, body: &BirdCoderCreateIamRolePermissionRequest) -> Result<BirdCoderIamRolePermissionSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}/permissions", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM role permission
    pub async fn roles_permissions_delete(&self, role_id: &str, permission_id: &str) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/roles/{}/permissions/{}", serialize_path_parameter(role_id, PathParameterSpec::new("roleId", "simple", false)), serialize_path_parameter(permission_id, PathParameterSpec::new("permissionId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM security events
    pub async fn security_events_list(&self) -> Result<BirdCoderIamSecurityEventSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/security_events".to_string());
        self.client.get(&path, None, None).await
    }

    /// List SDKWork IAM tenants
    pub async fn tenants_list(&self) -> Result<BirdCoderIamTenantSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/tenants".to_string());
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM tenant
    pub async fn tenants_create(&self, body: &BirdCoderCreateIamTenantRequest) -> Result<BirdCoderIamTenantSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/tenants".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM tenant
    pub async fn tenants_retrieve(&self, tenant_id: &str) -> Result<BirdCoderIamTenantSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM tenant
    pub async fn tenants_update(&self, tenant_id: &str, body: &BirdCoderUpdateIamTenantRequest) -> Result<BirdCoderIamTenantSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM tenant
    pub async fn tenants_delete(&self, tenant_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM tenant members
    pub async fn tenants_members_list(&self, tenant_id: &str) -> Result<BirdCoderIamTenantMemberSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}/members", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM tenant member
    pub async fn tenants_members_create(&self, tenant_id: &str, body: &BirdCoderCreateIamTenantMemberRequest) -> Result<BirdCoderIamTenantMemberSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}/members", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Update SDKWork IAM tenant member
    pub async fn tenants_members_update(&self, tenant_id: &str, user_id: &str, body: &BirdCoderUpdateIamTenantMemberRequest) -> Result<BirdCoderIamTenantMemberSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}/members/{}", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false)), serialize_path_parameter(user_id, PathParameterSpec::new("userId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM tenant member
    pub async fn tenants_members_delete(&self, tenant_id: &str, user_id: &str) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/tenants/{}/members/{}", serialize_path_parameter(tenant_id, PathParameterSpec::new("tenantId", "simple", false)), serialize_path_parameter(user_id, PathParameterSpec::new("userId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List SDKWork IAM users
    pub async fn users_list(&self) -> Result<BirdCoderIamUserSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/users".to_string());
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM user
    pub async fn users_create(&self, body: &BirdCoderCreateIamUserRequest) -> Result<BirdCoderIamUserSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/users".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM user
    pub async fn users_retrieve(&self, user_id: &str) -> Result<BirdCoderIamUserSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/users/{}", serialize_path_parameter(user_id, PathParameterSpec::new("userId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Update SDKWork IAM user
    pub async fn users_update(&self, user_id: &str, body: &BirdCoderUpdateIamUserRequest) -> Result<BirdCoderIamUserSummaryEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/users/{}", serialize_path_parameter(user_id, PathParameterSpec::new("userId", "simple", false))));
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM user
    pub async fn users_delete(&self, user_id: &str) -> Result<BirdCoderDeletedResourceEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/users/{}", serialize_path_parameter(user_id, PathParameterSpec::new("userId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// Create SDKWork IAM user role binding
    pub async fn role_bindings_create(&self, body: &BirdCoderCreateIamUserRoleRequest) -> Result<BirdCoderIamUserRoleSummaryEnvelope, SdkworkError> {
        let path = backend_path(&"/iam/role_bindings".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete SDKWork IAM user role binding
    pub async fn role_bindings_delete(&self, role_binding_id: &str) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/role_bindings/{}", serialize_path_parameter(role_binding_id, PathParameterSpec::new("roleBindingId", "simple", false))));
        self.client.delete(&path, None, None).await
    }

    /// List team members
    pub async fn teams_members_list(&self, team_id: &str) -> Result<BirdCoderTeamMemberSummaryListEnvelope, SdkworkError> {
        let path = backend_path(&format!("/iam/teams/{}/members", serialize_path_parameter(team_id, PathParameterSpec::new("teamId", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// List teams
    pub async fn teams_list(&self, user_id: Option<&str>, workspace_id: Option<&str>) -> Result<BirdCoderTeamSummaryListEnvelope, SdkworkError> {
        let query = build_query_string(&[
            QueryParameterSpec::new("userId", user_id, "form", true, false, None),
            QueryParameterSpec::new("workspaceId", workspace_id, "form", true, false, None),
        ]);
        let path = append_query_string(backend_path(&"/iam/teams".to_string()), &query);
        self.client.get(&path, None, None).await
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
