use serde_json::{json, Value};
use uuid::Uuid;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::events::{
    CodingSessionRealtimeEventInput, RealtimeEventPublisher,
};
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::ports::events::DeploymentEventPublisher;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::events::WorkspaceEventPublisher;
use sdkwork_routes_workspace_app_api::realtime_hub::{
    current_rfc3339_timestamp, new_workspace_realtime_event_id, WorkspaceRealtimeHub,
};

#[derive(Clone)]
pub struct HubRealtimeEventPublisher {
    hub: WorkspaceRealtimeHub,
}

impl HubRealtimeEventPublisher {
    pub fn new(hub: WorkspaceRealtimeHub) -> Self {
        Self { hub }
    }
}

#[async_trait::async_trait]
impl RealtimeEventPublisher for HubRealtimeEventPublisher {
    async fn publish_workspace_event(
        &self,
        _ctx: &CodingSessionContext,
        workspace_id: &str,
        event_kind: &str,
        payload_json: &str,
    ) -> Result<(), CodingSessionError> {
        let payload = serde_json::from_str::<Value>(payload_json).unwrap_or_else(|_| json!({}));
        let event = json!({
            "eventId": new_workspace_realtime_event_id(),
            "eventKind": event_kind,
            "workspaceId": workspace_id,
            "occurredAt": current_rfc3339_timestamp(),
            "sourceSurface": "app",
            "payload": payload,
        });
        let message = json!({
            "kind": "event",
            "event": event,
        });
        self.hub.publish(workspace_id, &message.to_string()).await;
        Ok(())
    }

    async fn publish_coding_session_event(
        &self,
        _ctx: &CodingSessionContext,
        event: &CodingSessionRealtimeEventInput,
    ) -> Result<(), CodingSessionError> {
        if event.workspace_id.trim().is_empty() {
            return Ok(());
        }

        let message = json!({
            "kind": "event",
            "event": map_coding_session_event(event),
        });
        self.hub
            .publish(&event.workspace_id, &message.to_string())
            .await;
        Ok(())
    }
}

#[derive(Clone)]
pub struct HubWorkspaceEventPublisher {
    hub: WorkspaceRealtimeHub,
}

impl HubWorkspaceEventPublisher {
    pub fn new(hub: WorkspaceRealtimeHub) -> Self {
        Self { hub }
    }

    async fn publish_workspace_lifecycle(
        &self,
        workspace_id: &str,
        event_kind: &str,
    ) -> Result<(), WorkspaceError> {
        let message = json!({
            "kind": "event",
            "event": {
                "eventId": Uuid::new_v4().to_string(),
                "eventKind": event_kind,
                "workspaceId": workspace_id,
                "occurredAt": current_rfc3339_timestamp(),
                "sourceSurface": "app",
            },
        });
        self.hub.publish(workspace_id, &message.to_string()).await;
        Ok(())
    }
}

#[async_trait::async_trait]
impl WorkspaceEventPublisher for HubWorkspaceEventPublisher {
    async fn publish_workspace_created(&self, workspace_id: &str) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(workspace_id, "workspace.created")
            .await
    }

    async fn publish_workspace_updated(&self, workspace_id: &str) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(workspace_id, "workspace.updated")
            .await
    }

    async fn publish_workspace_deleted(&self, workspace_id: &str) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(workspace_id, "workspace.deleted")
            .await
    }

    async fn publish_workspace_member_added(
        &self,
        workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(workspace_id, "workspace.member.added")
            .await
    }

    async fn publish_workspace_member_removed(
        &self,
        workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(workspace_id, "workspace.member.removed")
            .await
    }
}

#[derive(Clone)]
pub struct HubProjectEventPublisher {
    hub: WorkspaceRealtimeHub,
}

impl HubProjectEventPublisher {
    pub fn new(hub: WorkspaceRealtimeHub) -> Self {
        Self { hub }
    }

    async fn publish_project_lifecycle(
        &self,
        workspace_id: &str,
        project_id: &str,
        event_kind: &str,
    ) -> Result<(), ProjectError> {
        if workspace_id.trim().is_empty() || project_id.trim().is_empty() {
            return Ok(());
        }

        let message = json!({
            "kind": "event",
            "event": {
                "eventId": new_workspace_realtime_event_id(),
                "eventKind": event_kind,
                "workspaceId": workspace_id,
                "projectId": project_id,
                "occurredAt": current_rfc3339_timestamp(),
                "sourceSurface": "app",
            },
        });
        self.hub.publish(workspace_id, &message.to_string()).await;
        Ok(())
    }
}

#[async_trait::async_trait]
impl ProjectEventPublisher for HubProjectEventPublisher {
    async fn publish_project_created(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(workspace_id, project_id, "project.created")
            .await
    }

    async fn publish_project_updated(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(workspace_id, project_id, "project.updated")
            .await
    }

    async fn publish_project_deleted(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(workspace_id, project_id, "project.deleted")
            .await
    }

    async fn publish_project_collaborator_added(
        &self,
        workspace_id: &str,
        project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(workspace_id, project_id, "project.updated")
            .await
    }

    async fn publish_project_collaborator_removed(
        &self,
        workspace_id: &str,
        project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(workspace_id, project_id, "project.updated")
            .await
    }
}

#[derive(Clone)]
pub struct HubDeploymentEventPublisher {
    hub: WorkspaceRealtimeHub,
}

impl HubDeploymentEventPublisher {
    pub fn new(hub: WorkspaceRealtimeHub) -> Self {
        Self { hub }
    }

    async fn publish_project_activity(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), DeploymentError> {
        if workspace_id.trim().is_empty() || project_id.trim().is_empty() {
            return Ok(());
        }

        let message = json!({
            "kind": "event",
            "event": {
                "eventId": new_workspace_realtime_event_id(),
                "eventKind": "project.updated",
                "workspaceId": workspace_id,
                "projectId": project_id,
                "occurredAt": current_rfc3339_timestamp(),
                "sourceSurface": "app",
            },
        });
        self.hub.publish(workspace_id, &message.to_string()).await;
        Ok(())
    }
}

#[async_trait::async_trait]
impl DeploymentEventPublisher for HubDeploymentEventPublisher {
    async fn publish_deployment_created(
        &self,
        workspace_id: &str,
        project_id: &str,
        _deployment_id: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(workspace_id, project_id)
            .await
    }

    async fn publish_deployment_status_changed(
        &self,
        workspace_id: &str,
        project_id: &str,
        _deployment_id: &str,
        _status: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(workspace_id, project_id)
            .await
    }

    async fn publish_release_created(
        &self,
        workspace_id: &str,
        project_id: &str,
        _release_id: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(workspace_id, project_id)
            .await
    }

    async fn publish_audit_event(
        &self,
        workspace_id: &str,
        project_id: &str,
        _scope_type: &str,
        _scope_id: &str,
        _event_type: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(workspace_id, project_id)
            .await
    }
}

fn map_coding_session_event(event: &CodingSessionRealtimeEventInput) -> Value {
    json!({
        "eventId": new_workspace_realtime_event_id(),
        "eventKind": event.event_kind,
        "workspaceId": event.workspace_id,
        "projectId": event.project_id,
        "codingSessionId": event.coding_session_id,
        "codingSessionTitle": event.coding_session_title,
        "codingSessionStatus": event.coding_session_status,
        "codingSessionHostMode": event.coding_session_host_mode,
        "codingSessionEngineId": event.coding_session_engine_id,
        "codingSessionModelId": event.coding_session_model_id,
        "codingSessionRuntimeStatus": event.coding_session_runtime_status,
        "nativeSessionId": event.native_session_id,
        "turnId": event.turn_id,
        "codingSessionUpdatedAt": event.coding_session_updated_at,
        "occurredAt": current_rfc3339_timestamp(),
        "sourceSurface": event.source_surface,
    })
}
