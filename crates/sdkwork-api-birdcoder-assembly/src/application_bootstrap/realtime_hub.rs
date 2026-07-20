use serde_json::{json, Value};
use uuid::Uuid;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::events::{
    CodingSessionRealtimeEventInput, RealtimeEventPublisher,
};
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::ports::events::DeploymentEventPublisher;
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::events::WorkspaceEventPublisher;
use sdkwork_routes_workspace_app_api::realtime_hub::{
    current_rfc3339_timestamp, new_workspace_realtime_event_id, WorkspaceRealtimeHub,
};
use sdkwork_routes_workspace_app_api::realtime_replay::{
    WorkspaceRealtimeReplayError, WorkspaceRealtimeReplayEvent, WorkspaceRealtimeReplayPage,
    WorkspaceRealtimeReplayProvider, WorkspaceRealtimeReplayScope,
};

const REALTIME_REPLAY_MAX_PAGE_SIZE: usize = 200;

#[derive(Clone)]
pub struct HubRealtimeEventPublisher {
    hub: WorkspaceRealtimeHub,
}

impl HubRealtimeEventPublisher {
    pub fn new(hub: WorkspaceRealtimeHub) -> Self {
        Self { hub }
    }
}

#[derive(Clone)]
pub struct CodingSessionRealtimeReplayProvider {
    service: CodingSessionService,
}

impl CodingSessionRealtimeReplayProvider {
    pub fn new(service: CodingSessionService) -> Self {
        Self { service }
    }
}

#[async_trait::async_trait]
impl WorkspaceRealtimeReplayProvider for CodingSessionRealtimeReplayProvider {
    async fn load_page(
        &self,
        scope: &WorkspaceRealtimeReplayScope,
        after_sequence: Option<usize>,
        high_watermark: Option<usize>,
        page_size: usize,
    ) -> Result<WorkspaceRealtimeReplayPage, WorkspaceRealtimeReplayError> {
        let ctx = CodingSessionContext {
            tenant_id: scope.tenant_id.clone(),
            organization_id: scope.organization_id.clone(),
            user_id: scope.user_id.clone(),
            session_id: scope.iam_session_id.clone(),
        };
        let session = self
            .service
            .get_session(&ctx, &scope.coding_session_id)
            .await
            .map_err(map_replay_service_error)?;
        if session.workspace_id != scope.workspace_id {
            return Err(WorkspaceRealtimeReplayError::NotFound(
                "Coding session was not found in the requested workspace.".to_owned(),
            ));
        }

        let page_size = page_size.clamp(1, REALTIME_REPLAY_MAX_PAGE_SIZE);
        let page = self
            .service
            .replay_events(
                &ctx,
                &scope.coding_session_id,
                after_sequence,
                high_watermark,
                page_size,
            )
            .await
            .map_err(map_replay_service_error)?;
        let events = page
            .events
            .into_iter()
            .map(|event| {
                let input = durable_realtime_event_input(&session, &event);
                let message = json!({
                    "kind": "event",
                    "event": map_coding_session_event(&input),
                })
                .to_string();
                WorkspaceRealtimeReplayEvent {
                    event_id: event.id,
                    coding_session_id: event.coding_session_id,
                    sequence: event.sequence,
                    message,
                }
            })
            .collect::<Vec<_>>();

        Ok(WorkspaceRealtimeReplayPage {
            events,
            high_watermark: page.high_watermark,
            has_more: page.has_more,
        })
    }
}

fn map_replay_service_error(error: CodingSessionError) -> WorkspaceRealtimeReplayError {
    match error {
        CodingSessionError::NotFound(_) => WorkspaceRealtimeReplayError::NotFound(
            "Coding session was not found for realtime replay.".to_owned(),
        ),
        CodingSessionError::InvalidInput(message) => {
            WorkspaceRealtimeReplayError::InvalidCursor(message)
        }
        _ => WorkspaceRealtimeReplayError::Unavailable(
            "Coding session realtime replay is temporarily unavailable.".to_owned(),
        ),
    }
}

#[async_trait::async_trait]
impl RealtimeEventPublisher for HubRealtimeEventPublisher {
    async fn publish_workspace_event(
        &self,
        ctx: &CodingSessionContext,
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
        self.hub
            .publish_user_inventory(
                &ctx.tenant_id,
                &ctx.user_id,
                workspace_id,
                &message.to_string(),
            )
            .await
            .map(|_| ())
            .map_err(|error| CodingSessionError::EventPublish(error.to_string()))
    }

    async fn publish_coding_session_event(
        &self,
        ctx: &CodingSessionContext,
        event: &CodingSessionRealtimeEventInput,
    ) -> Result<(), CodingSessionError> {
        if event.workspace_id.trim().is_empty() {
            return Ok(());
        }

        let message = json!({
            "kind": "event",
            "event": map_coding_session_event(event),
        });
        let message = message.to_string();
        let publish_result = match (
            event.coding_session_event_id.as_ref(),
            event.coding_session_event_sequence.as_ref(),
        ) {
            (Some(_), Some(_)) => {
                self.hub
                    .publish_session(
                        &ctx.tenant_id,
                        &ctx.user_id,
                        &event.workspace_id,
                        &event.coding_session_id,
                        &message,
                    )
                    .await
            }
            (None, None) => {
                self.hub
                    .publish_user_inventory(
                        &ctx.tenant_id,
                        &ctx.user_id,
                        &event.workspace_id,
                        &message,
                    )
                    .await
            }
            _ => {
                return Err(CodingSessionError::InvalidInput(
                    "Durable realtime events require both event id and sequence.".to_owned(),
                ));
            }
        };
        publish_result
            .map(|_| ())
            .map_err(|error| CodingSessionError::EventPublish(error.to_string()))
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
        tenant_id: &str,
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
        self.hub
            .publish(tenant_id, workspace_id, &message.to_string())
            .await
            .map(|_| ())
            .map_err(|error| WorkspaceError::EventPublish(error.to_string()))
    }
}

#[async_trait::async_trait]
impl WorkspaceEventPublisher for HubWorkspaceEventPublisher {
    async fn publish_workspace_created(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(&ctx.tenant_id, workspace_id, "workspace.created")
            .await
    }

    async fn publish_workspace_updated(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(&ctx.tenant_id, workspace_id, "workspace.updated")
            .await
    }

    async fn publish_workspace_deleted(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(&ctx.tenant_id, workspace_id, "workspace.deleted")
            .await
    }

    async fn publish_workspace_member_added(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(&ctx.tenant_id, workspace_id, "workspace.member.added")
            .await
    }

    async fn publish_workspace_member_removed(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.publish_workspace_lifecycle(&ctx.tenant_id, workspace_id, "workspace.member.removed")
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
        tenant_id: &str,
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
        self.hub
            .publish(tenant_id, workspace_id, &message.to_string())
            .await
            .map(|_| ())
            .map_err(|error| ProjectError::EventPublish(error.to_string()))
    }
}

#[async_trait::async_trait]
impl ProjectEventPublisher for HubProjectEventPublisher {
    async fn publish_project_created(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(&ctx.tenant_id, workspace_id, project_id, "project.created")
            .await
    }

    async fn publish_project_updated(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(&ctx.tenant_id, workspace_id, project_id, "project.updated")
            .await
    }

    async fn publish_project_deleted(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(&ctx.tenant_id, workspace_id, project_id, "project.deleted")
            .await
    }

    async fn publish_project_collaborator_added(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(&ctx.tenant_id, workspace_id, project_id, "project.updated")
            .await
    }

    async fn publish_project_collaborator_removed(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        self.publish_project_lifecycle(&ctx.tenant_id, workspace_id, project_id, "project.updated")
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
        tenant_id: &str,
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
        self.hub
            .publish(tenant_id, workspace_id, &message.to_string())
            .await
            .map(|_| ())
            .map_err(|error| DeploymentError::EventPublish(error.to_string()))
    }
}

#[async_trait::async_trait]
impl DeploymentEventPublisher for HubDeploymentEventPublisher {
    async fn publish_deployment_created(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        _deployment_id: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(&ctx.tenant_id, workspace_id, project_id)
            .await
    }

    async fn publish_deployment_status_changed(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        _deployment_id: &str,
        _status: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(&ctx.tenant_id, workspace_id, project_id)
            .await
    }

    async fn publish_release_created(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        _release_id: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(&ctx.tenant_id, workspace_id, project_id)
            .await
    }

    async fn publish_audit_event(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        _scope_type: &str,
        _scope_id: &str,
        _event_type: &str,
    ) -> Result<(), DeploymentError> {
        self.publish_project_activity(&ctx.tenant_id, workspace_id, project_id)
            .await
    }
}

fn canonical_outer_event_kind(event: &CodingSessionRealtimeEventInput) -> &str {
    if event.coding_session_event_id.is_none() {
        return event.event_kind.as_str();
    }
    match event.coding_session_event_kind.as_deref() {
        Some("turn.completed") => "coding-session.turn.completed",
        _ => "coding-session.updated",
    }
}

fn durable_realtime_event_input(
    session: &sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload,
    event: &sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionEventPayload,
) -> CodingSessionRealtimeEventInput {
    CodingSessionRealtimeEventInput {
        event_kind: "coding-session.updated".to_owned(),
        source_surface: "core".to_owned(),
        workspace_id: session.workspace_id.clone(),
        project_id: session.project_id.clone(),
        coding_session_runtime_location_id: session.runtime_location_id.clone(),
        coding_session_id: session.id.clone(),
        coding_session_title: session.title.clone(),
        coding_session_status: session.status.clone(),
        coding_session_host_mode: session.host_mode.clone(),
        coding_session_engine_id: session.engine_id.clone(),
        coding_session_model_id: session.model_id.clone(),
        coding_session_runtime_status: event
            .payload
            .get("runtimeStatus")
            .and_then(Value::as_str)
            .map(str::to_owned),
        coding_session_event_id: Some(event.id.clone()),
        coding_session_event_kind: Some(event.kind.clone()),
        coding_session_event_payload: Some(json!(event.payload)),
        coding_session_event_sequence: Some(event.sequence.to_string()),
        native_session_id: session.native_session_id.clone(),
        coding_session_updated_at: Some(event.created_at.clone()),
        turn_id: event.turn_id.clone(),
    }
}

fn map_coding_session_event(event: &CodingSessionRealtimeEventInput) -> Value {
    json!({
        "eventId": event.coding_session_event_id.clone().unwrap_or_else(new_workspace_realtime_event_id),
        "eventKind": canonical_outer_event_kind(event),
        "workspaceId": event.workspace_id,
        "projectId": event.project_id,
        "codingSessionRuntimeLocationId": event.coding_session_runtime_location_id,
        "codingSessionId": event.coding_session_id,
        "codingSessionTitle": event.coding_session_title,
        "codingSessionStatus": event.coding_session_status,
        "codingSessionHostMode": event.coding_session_host_mode,
        "codingSessionEngineId": event.coding_session_engine_id,
        "codingSessionModelId": event.coding_session_model_id,
        "codingSessionRuntimeStatus": event.coding_session_runtime_status,
        "codingSessionEventKind": event.coding_session_event_kind,
        "codingSessionEventPayload": event.coding_session_event_payload,
        "codingSessionEventSequence": event.coding_session_event_sequence,
        "nativeSessionId": event.native_session_id,
        "turnId": event.turn_id,
        "codingSessionUpdatedAt": event.coding_session_updated_at,
        "occurredAt": event.coding_session_event_id.as_ref()
            .and(event.coding_session_updated_at.clone())
            .unwrap_or_else(current_rfc3339_timestamp),
        "sourceSurface": event.source_surface,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stream_event() -> CodingSessionRealtimeEventInput {
        CodingSessionRealtimeEventInput {
            event_kind: "coding-session.updated".to_owned(),
            source_surface: "core".to_owned(),
            workspace_id: "workspace-1".to_owned(),
            project_id: "project-1".to_owned(),
            coding_session_runtime_location_id: Some("runtime-location-1".to_owned()),
            coding_session_id: "session-1".to_owned(),
            coding_session_title: "Stream".to_owned(),
            coding_session_status: "active".to_owned(),
            coding_session_host_mode: "server".to_owned(),
            coding_session_engine_id: "codex".to_owned(),
            coding_session_model_id: "gpt-5.4".to_owned(),
            coding_session_runtime_status: Some("streaming".to_owned()),
            coding_session_event_id: Some("durable-event-7".to_owned()),
            coding_session_event_kind: Some("message.delta".to_owned()),
            coding_session_event_payload: Some(json!({
                "role": "assistant",
                "contentDelta": "hello",
            })),
            coding_session_event_sequence: Some("7".to_owned()),
            native_session_id: Some("native-1".to_owned()),
            coding_session_updated_at: Some("2026-07-15T00:00:00Z".to_owned()),
            turn_id: Some("turn-1".to_owned()),
        }
    }

    fn coding_context(tenant_id: &str, user_id: &str) -> CodingSessionContext {
        CodingSessionContext {
            tenant_id: tenant_id.to_owned(),
            organization_id: "organization-1".to_owned(),
            user_id: user_id.to_owned(),
            session_id: format!("session-{user_id}"),
        }
    }

    #[test]
    fn realtime_projection_preserves_canonical_stream_event_fields() {
        let event = stream_event();

        let mapped = map_coding_session_event(&event);
        assert_eq!(
            mapped["codingSessionRuntimeLocationId"],
            "runtime-location-1"
        );
        assert_eq!(mapped["codingSessionEventKind"], "message.delta");
        assert_eq!(mapped["codingSessionEventPayload"]["contentDelta"], "hello");
        assert_eq!(mapped["codingSessionEventSequence"], "7");
        assert_eq!(mapped["nativeSessionId"], "native-1");
        assert_eq!(mapped["eventId"], "durable-event-7");
        assert_eq!(mapped["occurredAt"], "2026-07-15T00:00:00Z");
    }

    #[tokio::test]
    async fn coding_session_publisher_routes_durable_payload_only_to_its_session_channel() {
        let hub = WorkspaceRealtimeHub::new();
        let mut owner = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "session-1")
            .await
            .expect("subscribe owner");
        let mut other_user = hub
            .subscribe_session("tenant-1", "user-2", "workspace-1", "session-1")
            .await
            .expect("subscribe other user");
        let mut other_session = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "session-2")
            .await
            .expect("subscribe another session");
        let mut inventory = hub
            .subscribe_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe owner inventory");
        let mut public = hub
            .subscribe("tenant-1", "workspace-1")
            .await
            .expect("subscribe public");
        let publisher = HubRealtimeEventPublisher::new(hub);

        publisher
            .publish_coding_session_event(&coding_context("tenant-1", "user-1"), &stream_event())
            .await
            .expect("publish owner event");

        let message = owner.recv().await.expect("owner receives event");
        let value: Value = serde_json::from_str(&message).expect("parse owner event");
        assert_eq!(
            value["event"]["codingSessionEventPayload"]["contentDelta"],
            "hello"
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), other_user.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), other_session.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), inventory.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), public.recv())
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn coding_session_summary_publisher_routes_only_to_owner_inventory() {
        let hub = WorkspaceRealtimeHub::new();
        let mut inventory = hub
            .subscribe_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe owner inventory");
        let mut session = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "session-1")
            .await
            .expect("subscribe durable session");
        let publisher = HubRealtimeEventPublisher::new(hub);
        let mut event = stream_event();
        event.coding_session_event_id = None;
        event.coding_session_event_kind = None;
        event.coding_session_event_payload = None;
        event.coding_session_event_sequence = None;

        publisher
            .publish_coding_session_event(&coding_context("tenant-1", "user-1"), &event)
            .await
            .expect("publish owner inventory event");

        let message = inventory.recv().await.expect("inventory receives summary");
        let value: Value = serde_json::from_str(&message).expect("parse summary event");
        assert_eq!(value["event"]["codingSessionId"], "session-1");
        assert!(value["event"]["codingSessionEventPayload"].is_null());
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), session.recv())
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn workspace_lifecycle_publisher_remains_public() {
        let hub = WorkspaceRealtimeHub::new();
        let mut public = hub
            .subscribe("tenant-1", "workspace-1")
            .await
            .expect("subscribe public");
        let mut other_tenant = hub
            .subscribe("tenant-2", "workspace-1")
            .await
            .expect("subscribe another tenant public channel");
        let mut user_inventory = hub
            .subscribe_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe owner");
        let publisher = HubWorkspaceEventPublisher::new(hub);
        let ctx = WorkspaceContext {
            tenant_id: "tenant-1".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "user-1".to_owned(),
        };

        publisher
            .publish_workspace_updated(&ctx, "workspace-1")
            .await
            .expect("publish public lifecycle event");

        let message = public
            .recv()
            .await
            .expect("public receives lifecycle event");
        let value: Value = serde_json::from_str(&message).expect("parse lifecycle event");
        assert_eq!(value["event"]["eventKind"], "workspace.updated");
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), other_tenant.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), user_inventory.recv(),)
                .await
                .is_err()
        );
    }
}
