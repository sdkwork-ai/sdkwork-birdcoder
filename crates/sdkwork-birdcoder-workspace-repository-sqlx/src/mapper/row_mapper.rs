use serde_json::Value;

use crate::db::rows::*;
use sdkwork_birdcoder_deployment_service::domain::results::{
    AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload,
};
use sdkwork_birdcoder_project_service::domain::results::{
    ProjectCollaboratorPayload, ProjectPayload,
};
use sdkwork_birdcoder_workspace_service::domain::results::{
    TeamMemberPayload, TeamPayload, WorkspaceMemberPayload, WorkspacePayload,
};

fn i64_to_string(v: i64) -> String {
    v.to_string()
}

fn opt_i64_to_opt_string(v: Option<i64>) -> Option<String> {
    v.map(|n| n.to_string())
}

fn i64_to_bool(v: i64) -> bool {
    v != 0
}

fn project_status_to_payload_status(value: i64) -> &'static str {
    match value {
        0 => "active",
        1 => "archived",
        // Never expose an unknown legacy storage value as an active project.
        _ => "archived",
    }
}

pub fn workspace_row_to_payload(row: &WorkspaceRow) -> WorkspacePayload {
    WorkspacePayload {
        id: i64_to_string(row.id),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        data_scope: Some(i64_to_string(row.data_scope)),
        code: row.code.clone(),
        title: row.title.clone(),
        name: row.name.clone(),
        description: row.description.clone(),
        icon: row.icon.clone(),
        color: row.color.clone(),
        owner_id: Some(i64_to_string(row.owner_id)),
        leader_id: opt_i64_to_opt_string(row.leader_id),
        created_by_user_id: opt_i64_to_opt_string(row.created_by_user_id),
        entity_type: row.r#type.clone(),
        start_time: row.start_time.clone(),
        end_time: row.end_time.clone(),
        max_members: row.max_members,
        current_members: row.current_members,
        member_count: row.member_count.map(|v| v as usize),
        max_storage: row.max_storage.map(|v| v.to_string()),
        used_storage: row.used_storage.map(|v| v.to_string()),
        settings: row
            .settings_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        is_public: Some(i64_to_bool(row.is_public)),
        is_template: Some(i64_to_bool(row.is_template)),
        status: row.status.clone(),
        viewer_role: None,
    }
}

pub fn workspace_member_row_to_payload(row: &WorkspaceMemberRow) -> WorkspaceMemberPayload {
    WorkspaceMemberPayload {
        id: i64_to_string(row.id),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        workspace_id: i64_to_string(row.workspace_id),
        user_id: i64_to_string(row.user_id),
        user_email: None,
        user_display_name: None,
        user_avatar_url: None,
        team_id: opt_i64_to_opt_string(row.team_id),
        role: row.role.clone(),
        status: row.status.clone(),
        created_by_user_id: opt_i64_to_opt_string(row.created_by_user_id),
        granted_by_user_id: opt_i64_to_opt_string(row.granted_by_user_id),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
    }
}

pub fn project_row_to_payload(row: &ProjectRow) -> ProjectPayload {
    ProjectPayload {
        created_at: Some(row.created_at.clone()),
        id: i64_to_string(row.id),
        uuid: Some(row.uuid.clone()),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        data_scope: Some(i64_to_string(row.data_scope)),
        workspace_id: row.workspace_id.map(i64_to_string).unwrap_or_default(),
        workspace_uuid: row.workspace_uuid.clone(),
        user_id: opt_i64_to_opt_string(row.user_id),
        parent_id: opt_i64_to_opt_string(row.parent_id),
        parent_uuid: row.parent_uuid.clone(),
        parent_metadata: row
            .parent_metadata
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        code: Some(row.code.clone()),
        title: Some(row.title.clone()),
        name: row.name.clone(),
        description: row.description.clone(),
        domain_prefix: row.domain_prefix.clone(),
        owner_id: None,
        leader_id: opt_i64_to_opt_string(row.leader_id),
        created_by_user_id: opt_i64_to_opt_string(row.user_id),
        author: row.author.clone(),
        file_id: row.file_id.map(|v| v.to_string()),
        conversation_id: row.conversation_id.map(|v| v.to_string()),
        entity_type: Some(row.r#type.to_string()),
        start_time: row.start_time.clone(),
        end_time: row.end_time.clone(),
        budget_amount: row.budget_amount.map(|v| v.to_string()),
        cover_image: row
            .cover_image
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        is_template: Some(i64_to_bool(row.is_template)),
        collaborator_count: None,
        status: project_status_to_payload_status(row.status).to_owned(),
        updated_at: Some(row.updated_at.clone()),
        viewer_role: None,
    }
}

pub fn project_collaborator_row_to_payload(
    row: &ProjectCollaboratorRow,
) -> ProjectCollaboratorPayload {
    ProjectCollaboratorPayload {
        id: i64_to_string(row.id),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        project_id: i64_to_string(row.project_id),
        workspace_id: i64_to_string(row.workspace_id),
        user_id: i64_to_string(row.user_id),
        user_email: None,
        user_display_name: None,
        user_avatar_url: None,
        team_id: opt_i64_to_opt_string(row.team_id),
        role: row.role.clone(),
        status: row.status.clone(),
        created_by_user_id: opt_i64_to_opt_string(row.created_by_user_id),
        granted_by_user_id: opt_i64_to_opt_string(row.granted_by_user_id),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
    }
}

pub fn deployment_record_row_to_payload(row: &DeploymentRecordRow) -> DeploymentPayload {
    DeploymentPayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        project_id: row.project_id.clone(),
        target_id: row.target_id.clone(),
        release_record_id: row.release_record_id.clone(),
        status: row.status.clone(),
        endpoint_url: row.endpoint_url.clone(),
        started_at: row.started_at.clone(),
        completed_at: row.completed_at.clone(),
    }
}

pub fn deployment_target_row_to_payload(row: &DeploymentTargetRow) -> DeploymentTargetPayload {
    DeploymentTargetPayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        project_id: row.project_id.clone(),
        name: row.name.clone(),
        environment_key: row.environment_key.clone(),
        runtime: row.runtime.clone(),
        status: row.status.clone(),
    }
}

pub fn release_record_row_to_payload(row: &ReleaseRecordRow) -> ReleasePayload {
    ReleasePayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        release_version: row.release_version.clone(),
        release_kind: row.release_kind.clone(),
        rollout_stage: row.rollout_stage.clone(),
        manifest: serde_json::from_str(&row.manifest_json).ok(),
        status: row.status.clone(),
    }
}

pub fn audit_event_row_to_payload(row: &AuditEventRow) -> AuditPayload {
    AuditPayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        scope_type: row.scope_type.clone(),
        scope_id: row.scope_id.clone(),
        event_type: row.event_type.clone(),
        payload: serde_json::from_str(&row.payload_json).unwrap_or(Value::Null),
    }
}

pub fn governance_policy_row_to_payload(row: &GovernancePolicyRow) -> PolicyPayload {
    PolicyPayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        scope_type: row.scope_type.clone(),
        scope_id: row.scope_id.clone(),
        policy_category: row.policy_category.clone(),
        target_type: row.target_type.clone(),
        target_id: row.target_id.clone(),
        approval_policy: row.approval_policy.clone(),
        rationale: row.rationale.clone(),
        status: row.status.clone(),
    }
}

pub fn team_row_to_payload(row: &TeamRow) -> TeamPayload {
    TeamPayload {
        id: i64_to_string(row.id),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        workspace_id: i64_to_string(row.workspace_id),
        code: row.code.clone(),
        title: row.title.clone(),
        name: row.name.clone(),
        description: row.description.clone(),
        owner_id: Some(i64_to_string(row.owner_id)),
        leader_id: opt_i64_to_opt_string(row.leader_id),
        created_by_user_id: opt_i64_to_opt_string(row.created_by_user_id),
        metadata: row
            .metadata_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        status: row.status.clone(),
    }
}

pub fn team_member_row_to_payload(row: &TeamMemberRow) -> TeamMemberPayload {
    TeamMemberPayload {
        id: i64_to_string(row.id),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        team_id: i64_to_string(row.team_id),
        user_id: i64_to_string(row.user_id),
        role: row.role.clone(),
        created_by_user_id: opt_i64_to_opt_string(row.created_by_user_id),
        granted_by_user_id: opt_i64_to_opt_string(row.granted_by_user_id),
        status: row.status.clone(),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
    }
}
