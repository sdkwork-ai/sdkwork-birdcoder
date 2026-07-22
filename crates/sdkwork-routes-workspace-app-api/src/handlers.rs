use std::collections::VecDeque;
use std::convert::Infallible;
use std::time::Duration;

use axum::extract::rejection::QueryRejection;
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{FromRequestParts, Path, Query, State};
use axum::http::request::Parts;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures_util::{stream, SinkExt, StreamExt};
use serde::Deserialize;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{
    coding_session_context, deployment_context, project_context, workspace_context,
    RequiredIamContext, StrictOffsetListQuery, WebRequestContext,
};
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::WorkspaceScopedQuery;
use sdkwork_birdcoder_workspace_service::domain::results::{
    DeleteEntityPayload as WorkspaceDeleteEntityPayload, TeamPayload, WorkspaceMemberPayload,
    WorkspacePayload,
};
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use sdkwork_birdcoder_project_service::domain::commands::{
    CommitProjectGitChangesRequest, CreateProjectGitBranchRequest, CreateProjectGitWorktreeRequest,
    CreateProjectRequest, PushProjectGitBranchRequest, RemoveProjectGitWorktreeRequest,
    SwitchProjectGitBranchRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use sdkwork_birdcoder_project_service::domain::results::{
    DeleteEntityPayload, ProjectCollaboratorPayload, ProjectPayload,
};
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    CreateProjectRuntimeLocationRequest, ProjectRuntimeLocationAuditContext,
    ProjectRuntimeLocationCommandAcceptedPayload, ProjectRuntimeLocationPayload,
    ProjectRuntimeLocationPreferencePayload, ProjectRuntimeLocationVerificationAcceptedPayload,
    RebindProjectRuntimeLocationRequest, SetProjectRuntimeLocationPreferenceRequest,
    UpdateProjectRuntimeLocationRequest,
};
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    ProjectSandboxBindingAuditContext, ProjectSandboxBindingPayload,
    UpsertProjectSandboxBindingRequest,
};
use sdkwork_birdcoder_project_service::ports::git::{GitProjectDiff, GitProjectOverview};
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::{
    ProjectRuntimeLocationService, RuntimeLocationMutationContext,
};
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::ProjectSandboxBindingService;

use sdkwork_birdcoder_deployment_service::domain::commands::PublishProjectCommand;
use sdkwork_birdcoder_deployment_service::domain::commands::PublishProjectRequest as DeployPublishRequest;
use sdkwork_birdcoder_deployment_service::domain::results::{
    DeploymentPayload, DeploymentTargetPayload, PublishProjectResultPayload,
};
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;

use crate::error;
use crate::mapper::request::{
    CommitGitChangesBody, CreateGitBranchBody, CreateGitWorktreeBody, CreateProjectBody,
    CreateProjectRuntimeLocationBody, CreateWorkspaceBody, ProjectGitRuntimeLocationQuery,
    ProjectListQuery, ProjectPathParams, ProjectRuntimeLocationPathParams,
    ProjectRuntimeLocationPreferencePathParams, PruneGitWorktreesBody, PublishProjectBody,
    PushGitBranchBody, RebindProjectRuntimeLocationBody, RemoveGitWorktreeBody,
    SetProjectRuntimeLocationPreferenceBody, SwitchGitBranchBody, TeamListQuery, UpdateProjectBody,
    UpdateProjectRuntimeLocationBody, UpdateWorkspaceBody, UpsertProjectCollaboratorBody,
    UpsertProjectSandboxBindingBody, UpsertWorkspaceMemberBody, WorkspaceListQuery,
    WorkspacePathParams,
};
use crate::realtime_hub::{
    build_workspace_ready_message, RealtimeSubscriberLimitExceeded, WorkspaceRealtimeHub,
    WorkspaceRealtimeSubscription,
};
use crate::realtime_metrics::{
    connection_closed, connection_opened, record_lag_recovery, record_replay_events,
    record_replay_failure, record_replay_request, record_sequence_gap_recovery,
};
use crate::realtime_replay::{
    SharedWorkspaceRealtimeReplayProvider, WorkspaceRealtimeReplayError,
    WorkspaceRealtimeReplayEvent, WorkspaceRealtimeReplayScope,
};

const REALTIME_REPLAY_PAGE_SIZE: usize = 200;
const REALTIME_DURABLE_RECONCILIATION_INTERVAL: Duration = Duration::from_secs(10);
const REALTIME_WEBSOCKET_HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);
const REALTIME_WEBSOCKET_PONG_TIMEOUT: Duration = Duration::from_secs(10);
const REALTIME_AUTHORIZATION_LEASE: Duration = Duration::from_secs(5 * 60);
const WORKSPACE_REALTIME_WEBSOCKET_PROTOCOL: &str = "sdkwork-realtime-v1";

#[derive(Clone)]
pub struct WorkspaceAppState {
    pub workspace_service: WorkspaceService,
    pub project_service: ProjectService,
    pub runtime_location_service: ProjectRuntimeLocationService,
    pub sandbox_binding_service: ProjectSandboxBindingService,
    pub deployment_service: DeploymentService,
    pub team_service: TeamService,
    pub realtime_hub: WorkspaceRealtimeHub,
    pub realtime_replay_provider: Option<SharedWorkspaceRealtimeReplayProvider>,
}

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

fn runtime_location_audit_context(web: &WebRequestContext) -> ProjectRuntimeLocationAuditContext {
    ProjectRuntimeLocationAuditContext {
        trace_id: request_trace_id(web).map(str::to_owned),
    }
}

fn sandbox_binding_audit_context(web: &WebRequestContext) -> ProjectSandboxBindingAuditContext {
    ProjectSandboxBindingAuditContext {
        trace_id: request_trace_id(web).map(str::to_owned),
    }
}

fn required_idempotency_key(
    headers: &HeaderMap,
    trace_id: Option<&str>,
    resource_name: &str,
) -> Result<String, error::ProblemJsonBody> {
    let Some(value) = headers.get("idempotency-key") else {
        return Err(error::map_precondition_required(
            format!("Idempotency-Key is required for this {resource_name} mutation."),
            trace_id,
        ));
    };
    let value = value.to_str().map_err(|_| {
        error::map_validation_error("Idempotency-Key must be valid header text.", trace_id)
    })?;
    let value = value.trim();
    if value.is_empty() {
        return Err(error::map_validation_error(
            "Idempotency-Key must not be blank.",
            trace_id,
        ));
    }
    Ok(value.to_owned())
}

fn parse_if_match(
    header_value: &axum::http::HeaderValue,
    trace_id: Option<&str>,
) -> Result<i64, error::ProblemJsonBody> {
    let value = header_value
        .to_str()
        .map_err(|_| error::map_validation_error("If-Match must be valid header text.", trace_id))?
        .trim();
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(error::map_validation_error(
            "If-Match must be a non-negative decimal version.",
            trace_id,
        ));
    }
    value.parse::<i64>().map_err(|_| {
        error::map_validation_error("If-Match must be a non-negative decimal version.", trace_id)
    })
}

fn required_if_match(
    headers: &HeaderMap,
    trace_id: Option<&str>,
    resource_name: &str,
) -> Result<i64, error::ProblemJsonBody> {
    let Some(value) = headers.get("if-match") else {
        return Err(error::map_precondition_required(
            format!("If-Match is required for this {resource_name} mutation."),
            trace_id,
        ));
    };
    parse_if_match(value, trace_id)
}

fn optional_if_match(
    headers: &HeaderMap,
    trace_id: Option<&str>,
) -> Result<Option<i64>, error::ProblemJsonBody> {
    headers
        .get("if-match")
        .map(|value| parse_if_match(value, trace_id))
        .transpose()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceRealtimeQuery {
    transport: Option<String>,
    coding_session_id: Option<String>,
    after_sequence: Option<usize>,
}

struct WorkspaceRealtimeDeliveryState {
    public_receiver: Option<WorkspaceRealtimeSubscription>,
    scoped_receiver: WorkspaceRealtimeSubscription,
    replay_provider: Option<SharedWorkspaceRealtimeReplayProvider>,
    replay_scope: Option<WorkspaceRealtimeReplayScope>,
    cursor: Option<usize>,
    high_watermark: Option<usize>,
    pending_replay: VecDeque<WorkspaceRealtimeReplayEvent>,
    replay_complete: bool,
    websocket: bool,
    next_reconciliation_at: tokio::time::Instant,
    authorization_lease_deadline: tokio::time::Instant,
}

enum WorkspaceRealtimeDelivery {
    Message(String),
    AuthorizationLeaseExpired,
    Closed,
}

impl WorkspaceRealtimeDeliveryState {
    fn live_only(
        public_receiver: WorkspaceRealtimeSubscription,
        user_inventory_receiver: WorkspaceRealtimeSubscription,
        transport: WorkspaceRealtimeTransport,
    ) -> Self {
        let websocket = transport == WorkspaceRealtimeTransport::WebSocket;
        connection_opened(websocket);
        Self {
            public_receiver: Some(public_receiver),
            scoped_receiver: user_inventory_receiver,
            replay_provider: None,
            replay_scope: None,
            cursor: None,
            high_watermark: None,
            pending_replay: VecDeque::new(),
            replay_complete: true,
            websocket,
            next_reconciliation_at: tokio::time::Instant::now()
                + REALTIME_DURABLE_RECONCILIATION_INTERVAL,
            authorization_lease_deadline: tokio::time::Instant::now()
                + REALTIME_AUTHORIZATION_LEASE,
        }
    }

    fn durable(
        session_receiver: WorkspaceRealtimeSubscription,
        replay_provider: SharedWorkspaceRealtimeReplayProvider,
        replay_scope: WorkspaceRealtimeReplayScope,
        cursor: Option<usize>,
        transport: WorkspaceRealtimeTransport,
    ) -> Self {
        let websocket = transport == WorkspaceRealtimeTransport::WebSocket;
        connection_opened(websocket);
        Self {
            public_receiver: None,
            scoped_receiver: session_receiver,
            replay_provider: Some(replay_provider),
            replay_scope: Some(replay_scope),
            cursor,
            high_watermark: None,
            pending_replay: VecDeque::new(),
            replay_complete: false,
            websocket,
            next_reconciliation_at: tokio::time::Instant::now()
                + REALTIME_DURABLE_RECONCILIATION_INTERVAL,
            authorization_lease_deadline: tokio::time::Instant::now()
                + REALTIME_AUTHORIZATION_LEASE,
        }
    }

    async fn prime(&mut self) -> Result<(), WorkspaceRealtimeReplayError> {
        if !self.replay_complete {
            self.load_replay_page().await?;
        }
        Ok(())
    }

    async fn load_replay_page(&mut self) -> Result<(), WorkspaceRealtimeReplayError> {
        let provider = self.replay_provider.as_ref().ok_or_else(|| {
            WorkspaceRealtimeReplayError::Unavailable(
                "Coding session realtime replay provider is not configured.".to_owned(),
            )
        })?;
        let scope = self.replay_scope.as_ref().ok_or_else(|| {
            WorkspaceRealtimeReplayError::Unavailable(
                "Coding session realtime replay scope is not configured.".to_owned(),
            )
        })?;
        record_replay_request();
        let page = provider
            .load_page(
                scope,
                self.cursor,
                self.high_watermark,
                REALTIME_REPLAY_PAGE_SIZE,
            )
            .await
            .inspect_err(|_error| {
                record_replay_failure();
            })?;
        if page.events.len() > REALTIME_REPLAY_PAGE_SIZE {
            record_replay_failure();
            return Err(WorkspaceRealtimeReplayError::Unavailable(format!(
                "Coding session replay provider exceeded the bounded page size of {REALTIME_REPLAY_PAGE_SIZE}."
            )));
        }
        record_replay_events(page.events.len());

        if let (Some(current), Some(high_watermark)) = (self.high_watermark, page.high_watermark) {
            if current != high_watermark {
                return Err(WorkspaceRealtimeReplayError::Unavailable(
                    "Coding session replay high watermark changed during one replay pass."
                        .to_owned(),
                ));
            }
        }
        self.high_watermark = page.high_watermark;

        let mut previous_sequence = self.cursor;
        for event in page.events {
            validate_replay_event(scope, previous_sequence, self.high_watermark, &event)?;
            previous_sequence = Some(event.sequence);
            self.pending_replay.push_back(event);
        }

        if page.has_more && self.pending_replay.is_empty() {
            return Err(WorkspaceRealtimeReplayError::Unavailable(
                "Coding session replay provider returned an empty non-terminal page.".to_owned(),
            ));
        }
        self.replay_complete = !page.has_more;
        if self.replay_complete {
            self.next_reconciliation_at =
                tokio::time::Instant::now() + REALTIME_DURABLE_RECONCILIATION_INTERVAL;
        }
        Ok(())
    }

    async fn next_delivery(&mut self) -> WorkspaceRealtimeDelivery {
        let lease_deadline = self.authorization_lease_deadline;
        tokio::select! {
            biased;
            _ = tokio::time::sleep_until(lease_deadline) => {
                WorkspaceRealtimeDelivery::AuthorizationLeaseExpired
            },
            message = self.next_message_before_lease() => match message {
                Some(message) => WorkspaceRealtimeDelivery::Message(message),
                None => WorkspaceRealtimeDelivery::Closed,
            },
        }
    }

    async fn next_message(&mut self) -> Option<String> {
        match self.next_delivery().await {
            WorkspaceRealtimeDelivery::Message(message) => Some(message),
            WorkspaceRealtimeDelivery::AuthorizationLeaseExpired
            | WorkspaceRealtimeDelivery::Closed => None,
        }
    }

    async fn next_message_before_lease(&mut self) -> Option<String> {
        loop {
            if let Some(event) = self.pending_replay.pop_front() {
                self.cursor = Some(event.sequence);
                return Some(event.message);
            }

            if !self.replay_complete {
                if let Err(error) = self.load_replay_page().await {
                    tracing::error!(?error, "coding session realtime replay failed");
                    return None;
                }
                continue;
            }

            let received = if self.replay_scope.is_some() {
                let reconciliation_deadline = self.next_reconciliation_at;
                tokio::select! {
                    result = self.scoped_receiver.recv() => Some(result),
                    _ = tokio::time::sleep_until(reconciliation_deadline) => None,
                }
            } else {
                match self.public_receiver.as_mut() {
                    Some(public_receiver) => Some(tokio::select! {
                        result = public_receiver.recv() => result,
                        result = self.scoped_receiver.recv() => result,
                    }),
                    None => Some(self.scoped_receiver.recv().await),
                }
            };
            let Some(received) = received else {
                self.next_reconciliation_at =
                    tokio::time::Instant::now() + REALTIME_DURABLE_RECONCILIATION_INTERVAL;
                self.high_watermark = None;
                self.replay_complete = false;
                continue;
            };

            match received {
                Ok(message) => {
                    let Some(scope) = self.replay_scope.as_ref() else {
                        return Some(message);
                    };
                    let Some((coding_session_id, sequence, _)) =
                        parse_coding_session_message_cursor(&message)
                    else {
                        continue;
                    };
                    if coding_session_id != scope.coding_session_id
                        || self.cursor.is_some_and(|cursor| sequence <= cursor)
                    {
                        continue;
                    }
                    let expected_sequence = self.cursor.unwrap_or(0).saturating_add(1);
                    if sequence != expected_sequence {
                        tracing::warn!(
                            cursor = ?self.cursor,
                            expected_sequence,
                            received_sequence = sequence,
                            "coding session realtime sequence gap detected; recovering from durable replay"
                        );
                        record_sequence_gap_recovery();
                        self.high_watermark = None;
                        self.replay_complete = false;
                        continue;
                    }
                    self.cursor = Some(sequence);
                    return Some(message);
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                    if self.replay_scope.is_none() {
                        tracing::warn!(skipped, "workspace realtime live-only subscriber lagged");
                        return None;
                    }
                    tracing::warn!(
                        skipped,
                        cursor = ?self.cursor,
                        "coding session realtime subscriber lagged; recovering from durable replay"
                    );
                    record_lag_recovery();
                    self.high_watermark = None;
                    self.replay_complete = false;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
            }
        }
    }
}

impl Drop for WorkspaceRealtimeDeliveryState {
    fn drop(&mut self) {
        connection_closed(self.websocket);
    }
}

pub(crate) struct OptionalWebSocketUpgrade(Option<WebSocketUpgrade>);

impl<S> FromRequestParts<S> for OptionalWebSocketUpgrade
where
    S: Send + Sync,
{
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Ok(Self(
            WebSocketUpgrade::from_request_parts(parts, state)
                .await
                .ok(),
        ))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum WorkspaceRealtimeTransport {
    Sse,
    WebSocket,
}

fn resolve_workspace_realtime_transport(
    query_transport: Option<&str>,
    has_websocket_upgrade: bool,
) -> Result<WorkspaceRealtimeTransport, &'static str> {
    match query_transport
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(value) if value.eq_ignore_ascii_case("sse") => Ok(WorkspaceRealtimeTransport::Sse),
        Some(value) if value.eq_ignore_ascii_case("websocket") => {
            Ok(WorkspaceRealtimeTransport::WebSocket)
        }
        Some(_) => Err("Workspace realtime transport must be 'sse' or 'websocket'."),
        None if has_websocket_upgrade => Ok(WorkspaceRealtimeTransport::WebSocket),
        None => Ok(WorkspaceRealtimeTransport::Sse),
    }
}

fn validate_workspace_realtime_websocket_protocol(headers: &HeaderMap) -> Result<(), &'static str> {
    let mut application_protocol_count = 0usize;
    for value in headers.get_all(header::SEC_WEBSOCKET_PROTOCOL) {
        let value = value
            .to_str()
            .map_err(|_| "Sec-WebSocket-Protocol must contain valid header text.")?;
        application_protocol_count += value
            .split(',')
            .map(str::trim)
            .filter(|protocol| *protocol == WORKSPACE_REALTIME_WEBSOCKET_PROTOCOL)
            .count();
    }

    match application_protocol_count {
        1 => Ok(()),
        0 => Err(
            "Workspace realtime websocket requests must offer the 'sdkwork-realtime-v1' application protocol.",
        ),
        _ => Err(
            "Workspace realtime websocket requests must offer the 'sdkwork-realtime-v1' application protocol exactly once.",
        ),
    }
}

fn parse_last_event_id_cursor(
    headers: &HeaderMap,
    coding_session_id: &str,
) -> Result<Option<usize>, &'static str> {
    let Some(last_event_id) = read_last_event_id(headers)? else {
        return Ok(None);
    };
    let Some((cursor_session_id, sequence)) = last_event_id.rsplit_once(':') else {
        return Err("Last-Event-ID must use the '<codingSessionId>:<sequence>' cursor format.");
    };
    if cursor_session_id != coding_session_id {
        return Err("Last-Event-ID does not belong to the requested coding session.");
    }
    sequence
        .parse::<usize>()
        .map(Some)
        .map_err(|_| "Last-Event-ID contains an invalid coding session sequence.")
}

fn read_last_event_id(headers: &HeaderMap) -> Result<Option<&str>, &'static str> {
    let Some(value) = headers.get("last-event-id") else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| "Last-Event-ID must contain valid UTF-8 text.")?
        .trim();
    Ok((!value.is_empty()).then_some(value))
}

fn parse_coding_session_message_cursor(message: &str) -> Option<(String, usize, String)> {
    let value = serde_json::from_str::<serde_json::Value>(message).ok()?;
    let event = value.get("event")?;
    let coding_session_id = event.get("codingSessionId")?.as_str()?.trim();
    let event_id = event.get("eventId")?.as_str()?.trim();
    let sequence = event.get("codingSessionEventSequence")?;
    let sequence = match sequence {
        serde_json::Value::String(value) => value.parse::<usize>().ok()?,
        serde_json::Value::Number(value) => value
            .as_u64()
            .and_then(|value| usize::try_from(value).ok())?,
        _ => return None,
    };
    if coding_session_id.is_empty() || event_id.is_empty() {
        return None;
    }
    if sequence == 0 {
        return None;
    }
    Some((coding_session_id.to_owned(), sequence, event_id.to_owned()))
}

fn validate_replay_event(
    scope: &WorkspaceRealtimeReplayScope,
    previous_sequence: Option<usize>,
    high_watermark: Option<usize>,
    event: &WorkspaceRealtimeReplayEvent,
) -> Result<(), WorkspaceRealtimeReplayError> {
    if event.coding_session_id != scope.coding_session_id {
        return Err(WorkspaceRealtimeReplayError::Unavailable(
            "Coding session replay provider returned an event from another session.".to_owned(),
        ));
    }
    let expected_sequence = previous_sequence.unwrap_or(0).saturating_add(1);
    if event.sequence != expected_sequence {
        return Err(WorkspaceRealtimeReplayError::Unavailable(
            "Coding session replay provider returned a non-contiguous sequence.".to_owned(),
        ));
    }
    if high_watermark.is_some_and(|high| event.sequence > high) {
        return Err(WorkspaceRealtimeReplayError::Unavailable(
            "Coding session replay provider returned an event above the replay high watermark."
                .to_owned(),
        ));
    }
    let Some((message_session_id, message_sequence, message_event_id)) =
        parse_coding_session_message_cursor(&event.message)
    else {
        return Err(WorkspaceRealtimeReplayError::Unavailable(
            "Coding session replay provider returned a message without a durable cursor."
                .to_owned(),
        ));
    };
    if message_session_id != event.coding_session_id
        || message_sequence != event.sequence
        || message_event_id != event.event_id
    {
        return Err(WorkspaceRealtimeReplayError::Unavailable(
            "Coding session replay metadata does not match its canonical message.".to_owned(),
        ));
    }
    Ok(())
}

fn map_replay_error(
    error: WorkspaceRealtimeReplayError,
    trace_id: Option<&str>,
) -> error::ProblemJsonBody {
    match error {
        WorkspaceRealtimeReplayError::InvalidCursor(message) => {
            error::map_validation_error(message, trace_id)
        }
        WorkspaceRealtimeReplayError::NotFound(message) => error::map_not_found(message, trace_id),
        WorkspaceRealtimeReplayError::Unavailable(message) => {
            error::map_unavailable(message, trace_id)
        }
    }
}

// ── Workspace handlers ───────────────────────────────────────────────

pub async fn list_workspaces(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<WorkspaceListQuery>,
) -> Result<Json<ApiListEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    if let Some(requested_user_id) = query.user_id.as_deref() {
        if requested_user_id != iam.user_id {
            return Err(error::forbidden(
                "Workspace listing is limited to the authenticated user.",
                request_trace_id(&web),
            ));
        }
    }
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let scoped = WorkspaceScopedQuery {
        root_path: None,
        user_id: Some(iam.user_id.clone()),
        workspace_id: None,
        pagination: sdkwork_birdcoder_workspace_service::domain::models::ListPagination {
            offset: Some(pagination.offset),
            page_size: Some(pagination.page_size),
        },
    };
    let trace_id = request_trace_id(&web);
    match state.workspace_service.list_workspaces(&ctx, &scoped).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_workspace_error(e, trace_id, "workspaces.list")),
    }
}

pub async fn get_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    match state
        .workspace_service
        .get_workspace(&ctx, &params.workspace_id)
        .await
    {
        Ok(workspace) => Ok(Json(build_data_envelope(workspace, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.retrieve",
        )),
    }
}

pub async fn create_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<WorkspacePayload>>), error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    let request = CreateWorkspaceRequest {
        name: body.name,
        description: body.description,
        tenant_id: body.tenant_id,
        organization_id: body.organization_id,
        data_scope: body.data_scope,
        code: body.code,
        title: body.title,
        owner_id: body.owner_id,
        leader_id: body.leader_id,
        created_by_user_id: body.created_by_user_id,
        icon: body.icon,
        color: body.color,
        entity_type: body.entity_type,
        start_time: body.start_time,
        end_time: body.end_time,
        max_members: body.max_members,
        current_members: body.current_members,
        member_count: body.member_count,
        max_storage: body.max_storage,
        used_storage: body.used_storage,
        settings: body.settings,
        is_public: body.is_public,
        is_template: body.is_template,
    };
    match state
        .workspace_service
        .create_workspace(&ctx, &request)
        .await
    {
        Ok(workspace) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(workspace, request_id(&web))),
        )),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.create",
        )),
    }
}

pub async fn update_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    let request = UpdateWorkspaceRequest {
        name: body.name,
        description: body.description,
        data_scope: body.data_scope,
        code: body.code,
        title: body.title,
        owner_id: body.owner_id,
        leader_id: body.leader_id,
        icon: body.icon,
        color: body.color,
        entity_type: body.entity_type,
        start_time: body.start_time,
        end_time: body.end_time,
        max_members: body.max_members,
        current_members: body.current_members,
        member_count: body.member_count,
        max_storage: body.max_storage,
        used_storage: body.used_storage,
        settings: body.settings,
        is_public: body.is_public,
        is_template: body.is_template,
        status: body.status,
    };
    match state
        .workspace_service
        .update_workspace(&ctx, &params.workspace_id, &request)
        .await
    {
        Ok(workspace) => Ok(Json(build_data_envelope(workspace, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.update",
        )),
    }
}

pub async fn delete_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiDataEnvelope<WorkspaceDeleteEntityPayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    match state
        .workspace_service
        .delete_workspace(&ctx, &params.workspace_id)
        .await
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.delete",
        )),
    }
}

pub(crate) async fn subscribe_workspace_realtime(
    OptionalWebSocketUpgrade(ws): OptionalWebSocketUpgrade,
    headers: HeaderMap,
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    Path(params): Path<WorkspacePathParams>,
    query: Result<Query<WorkspaceRealtimeQuery>, QueryRejection>,
    State(state): State<WorkspaceAppState>,
) -> Result<Response, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let Query(query) = query.map_err(|_| {
        error::map_validation_error("Workspace realtime query parameters are invalid.", trace_id)
    })?;
    let workspace_id = params.workspace_id.clone();
    let ctx = workspace_context(&iam);
    if state
        .workspace_service
        .ensure_workspace_access(&ctx, &workspace_id)
        .await
        .is_err()
    {
        return Err(error::map_not_found(
            format!("Workspace '{workspace_id}' was not found."),
            trace_id,
        ));
    }

    let user_id = iam.user_id.clone();
    let hub = state.realtime_hub.clone();
    let transport = resolve_workspace_realtime_transport(query.transport.as_deref(), ws.is_some())
        .map_err(|message| error::map_validation_error(message, trace_id))?;
    let websocket_upgrade = match transport {
        WorkspaceRealtimeTransport::Sse => None,
        WorkspaceRealtimeTransport::WebSocket => {
            let ws = ws.ok_or_else(|| {
                error::map_validation_error(
                    "Workspace realtime websocket transport requires a websocket upgrade request.",
                    trace_id,
                )
            })?;
            validate_workspace_realtime_websocket_protocol(&headers)
                .map_err(|message| error::map_validation_error(message, trace_id))?;
            Some(ws)
        }
    };

    let coding_session_id = query
        .coding_session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    if query.after_sequence.is_some() && coding_session_id.is_none() {
        return Err(error::map_validation_error(
            "afterSequence requires codingSessionId for a session-scoped durable cursor.",
            trace_id,
        ));
    }
    if coding_session_id.is_none()
        && read_last_event_id(&headers)
            .map_err(|message| error::map_validation_error(message, trace_id))?
            .is_some()
    {
        return Err(error::map_validation_error(
            "Last-Event-ID requires codingSessionId for a session-scoped durable cursor.",
            trace_id,
        ));
    }

    let mut delivery = if let Some(coding_session_id) = coding_session_id {
        let header_cursor = parse_last_event_id_cursor(&headers, &coding_session_id)
            .map_err(|message| error::map_validation_error(message, trace_id))?;
        if query.after_sequence.is_some()
            && header_cursor.is_some()
            && query.after_sequence != header_cursor
        {
            return Err(error::map_validation_error(
                "afterSequence and Last-Event-ID must identify the same durable cursor.",
                trace_id,
            ));
        }
        let replay_provider = state.realtime_replay_provider.clone().ok_or_else(|| {
            error::map_unavailable(
                "Coding session realtime replay is not configured for this deployment.",
                trace_id,
            )
        })?;
        let session_receiver = match hub
            .subscribe_session(
                &iam.tenant_id,
                &iam.user_id,
                &workspace_id,
                &coding_session_id,
            )
            .await
        {
            Ok(receiver) => receiver,
            Err(RealtimeSubscriberLimitExceeded) => {
                return Err(error::map_rate_limited(
                    "Workspace realtime subscription limit reached. Try again later.",
                    trace_id,
                ));
            }
        };
        let coding_context = coding_session_context(&iam);
        WorkspaceRealtimeDeliveryState::durable(
            session_receiver,
            replay_provider,
            WorkspaceRealtimeReplayScope {
                tenant_id: coding_context.tenant_id,
                organization_id: coding_context.organization_id,
                user_id: coding_context.user_id,
                iam_session_id: coding_context.session_id,
                workspace_id: workspace_id.clone(),
                coding_session_id,
            },
            query.after_sequence.or(header_cursor),
            transport,
        )
    } else {
        let (public_receiver, user_inventory_receiver) = match hub
            .subscribe_public_and_user_inventory(&iam.tenant_id, &iam.user_id, &workspace_id)
            .await
        {
            Ok(receivers) => receivers,
            Err(RealtimeSubscriberLimitExceeded) => {
                return Err(error::map_rate_limited(
                    "Workspace realtime subscription limit reached. Try again later.",
                    trace_id,
                ));
            }
        };
        WorkspaceRealtimeDeliveryState::live_only(
            public_receiver,
            user_inventory_receiver,
            transport,
        )
    };
    delivery
        .prime()
        .await
        .map_err(|error| map_replay_error(error, trace_id))?;

    if let Some(ws) = websocket_upgrade {
        Ok(ws
            .protocols([WORKSPACE_REALTIME_WEBSOCKET_PROTOCOL])
            .on_upgrade(move |socket| {
                handle_workspace_realtime(socket, delivery, workspace_id, user_id)
            })
            .into_response())
    } else {
        Ok(build_workspace_realtime_sse_response(
            delivery,
            workspace_id,
            user_id,
        ))
    }
}

fn build_workspace_realtime_sse_response(
    delivery: WorkspaceRealtimeDeliveryState,
    workspace_id: String,
    user_id: String,
) -> Response {
    let ready = build_workspace_ready_message(&workspace_id, &user_id);
    let initial = stream::once(async move {
        Ok::<Event, Infallible>(Event::default().event("ready").data(ready))
    });
    let updates = stream::unfold(delivery, |mut delivery| async move {
        let message = delivery.next_message().await?;
        let mut event = Event::default().event("event").data(message.clone());
        if let Some((coding_session_id, sequence, _)) =
            parse_coding_session_message_cursor(&message)
        {
            event = event.id(format!("{coding_session_id}:{sequence}"));
        }
        Some((Ok::<Event, Infallible>(event), delivery))
    });

    let mut response = Sse::new(initial.chain(updates))
        .keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("keep-alive"),
        )
        .into_response();
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-cache, no-store, no-transform"),
    );
    response.headers_mut().insert(
        axum::http::HeaderName::from_static("x-accel-buffering"),
        axum::http::HeaderValue::from_static("no"),
    );
    response
}

fn workspace_realtime_heartbeat() -> tokio::time::Interval {
    let mut heartbeat = tokio::time::interval_at(
        tokio::time::Instant::now() + REALTIME_WEBSOCKET_HEARTBEAT_INTERVAL,
        REALTIME_WEBSOCKET_HEARTBEAT_INTERVAL,
    );
    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    heartbeat
}

#[derive(Default)]
struct WebSocketHeartbeatState {
    expected_pong: Option<Vec<u8>>,
    pong_deadline: Option<tokio::time::Instant>,
}

impl WebSocketHeartbeatState {
    fn is_waiting_for_pong(&self) -> bool {
        self.expected_pong.is_some()
    }

    fn begin_ping(&mut self, payload: Vec<u8>, now: tokio::time::Instant) {
        self.expected_pong = Some(payload);
        self.pong_deadline = Some(now + REALTIME_WEBSOCKET_PONG_TIMEOUT);
    }

    fn observe_pong(&mut self, payload: &[u8]) -> bool {
        if self.expected_pong.as_deref() != Some(payload) {
            return false;
        }
        self.expected_pong = None;
        self.pong_deadline = None;
        true
    }

    fn pong_deadline(&self) -> Option<tokio::time::Instant> {
        self.pong_deadline
    }
}

async fn wait_for_websocket_pong(deadline: Option<tokio::time::Instant>) {
    match deadline {
        Some(deadline) => tokio::time::sleep_until(deadline).await,
        None => std::future::pending::<()>().await,
    }
}

async fn handle_workspace_realtime(
    socket: WebSocket,
    mut delivery: WorkspaceRealtimeDeliveryState,
    workspace_id: String,
    user_id: String,
) {
    let (mut sender, mut inbound) = socket.split();

    if sender
        .send(Message::Text(
            build_workspace_ready_message(&workspace_id, &user_id).into(),
        ))
        .await
        .is_err()
    {
        return;
    }

    let mut heartbeat = workspace_realtime_heartbeat();
    let mut heartbeat_state = WebSocketHeartbeatState::default();
    loop {
        let pong_deadline = heartbeat_state.pong_deadline();
        tokio::select! {
            event = delivery.next_delivery() => {
                match event {
                    WorkspaceRealtimeDelivery::Message(message) => {
                        if sender.send(Message::Text(message.into())).await.is_err() {
                            break;
                        }
                    }
                    WorkspaceRealtimeDelivery::AuthorizationLeaseExpired => {
                        let _ = sender
                            .send(Message::Close(Some(CloseFrame {
                                code: 1008,
                                reason: "Workspace realtime authorization lease expired.".into(),
                            })))
                            .await;
                        break;
                    }
                    WorkspaceRealtimeDelivery::Closed => break,
                }
            }
            inbound_message = inbound.next() => {
                match inbound_message {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Pong(payload))) => {
                        heartbeat_state.observe_pong(payload.as_ref());
                    }
                    Some(Ok(Message::Text(_))) | Some(Ok(Message::Binary(_))) => {
                        let _ = sender
                            .send(Message::Close(Some(CloseFrame {
                                code: 1003,
                                reason: "Workspace realtime is a server-push-only channel."
                                    .into(),
                            })))
                            .await;
                        break;
                    }
                    Some(Err(_)) => break,
                }
            }
            _ = heartbeat.tick() => {
                if !heartbeat_state.is_waiting_for_pong() {
                    let payload = uuid::Uuid::new_v4().as_bytes().to_vec();
                    if sender.send(Message::Ping(payload.clone().into())).await.is_err() {
                        break;
                    }
                    heartbeat_state.begin_ping(payload, tokio::time::Instant::now());
                }
            }
            _ = wait_for_websocket_pong(pong_deadline) => {
                let _ = sender
                    .send(Message::Close(Some(CloseFrame {
                        code: 1001,
                        reason: "Workspace realtime heartbeat timed out.".into(),
                    })))
                    .await;
                break;
            }
        }
    }
}

pub async fn list_workspace_members(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiListEnvelope<WorkspaceMemberPayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .workspace_service
        .list_workspace_members(&ctx, &params.workspace_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.members.list",
        )),
    }
}

pub async fn upsert_workspace_member(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpsertWorkspaceMemberBody>,
) -> Result<Json<ApiDataEnvelope<WorkspaceMemberPayload>>, error::ProblemJsonBody> {
    let ctx = workspace_context(&iam);
    let request = UpsertWorkspaceMemberRequest {
        user_id: body.user_id,
        email: body.email,
        team_id: body.team_id,
        role: body.role,
        status: body.status,
        created_by_user_id: body.created_by_user_id,
        granted_by_user_id: body.granted_by_user_id,
    };
    match state
        .workspace_service
        .upsert_workspace_member(&ctx, &params.workspace_id, &request)
        .await
    {
        Ok(member) => Ok(Json(build_data_envelope(member, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(
            e,
            request_trace_id(&web),
            "workspaces.members.create",
        )),
    }
}

// ── Project handlers ─────────────────────────────────────────────────

pub async fn list_projects(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<ApiListEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = project_context(&iam);
    let workspace_id = query
        .workspace_id
        .as_deref()
        .filter(|value| !sdkwork_utils_rust::is_blank(Some(value)))
        .ok_or_else(|| {
            error::map_validation_error("workspaceId is required to list projects.", trace_id)
        })?;
    let workspace_ctx = workspace_context(&iam);
    state
        .workspace_service
        .ensure_workspace_access(&workspace_ctx, workspace_id)
        .await
        .map_err(|error| error::map_workspace_error(error, trace_id, "projects.list"))?;
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET and user filters down
    // to SQL — never collect-then-slice in process memory.
    // Validate user_id scoping BEFORE calling the service so we fail fast
    // without materializing rows we would have to discard.
    if let Some(user_id) = query.user_id.as_deref() {
        if user_id != iam.user_id {
            return Err(error::forbidden(
                "Project listing is limited to the authenticated user.",
                trace_id,
            ));
        }
    }
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .project_service
        .list_projects(
            &ctx,
            workspace_id,
            query.user_id.as_deref(),
            offset,
            page_size,
        )
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_project_error(e, trace_id)),
    }
}

pub async fn get_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .project_service
        .get_project(&ctx, &params.project_id)
        .await
    {
        Ok(project) => Ok(Json(build_data_envelope(project, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<Json<ApiDataEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    state
        .workspace_service
        .ensure_workspace_access(&workspace_context(&iam), &body.workspace_id)
        .await
        .map_err(|error| {
            error::map_workspace_error(error, request_trace_id(&web), "projects.create")
        })?;
    let request = CreateProjectRequest {
        workspace_id: body.workspace_id,
        name: body.name,
        description: body.description,
    };
    match state.project_service.create_project(&ctx, &request).await {
        Ok(project) => Ok(Json(build_data_envelope(project, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn update_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpdateProjectBody>,
) -> Result<Json<ApiDataEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let request = UpdateProjectRequest {
        name: body.name,
        description: body.description,
        status: body.status,
    };
    match state
        .project_service
        .update_project(&ctx, &params.project_id, &request)
        .await
    {
        Ok(project) => Ok(Json(build_data_envelope(project, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn delete_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiDataEnvelope<DeleteEntityPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .project_service
        .delete_project(&ctx, &params.project_id)
        .await
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Git handlers ─────────────────────────────────────────────────────

// Runtime-location handlers -------------------------------------------------

pub async fn get_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectSandboxBindingPayload>>, error::ProblemJsonBody> {
    let context = project_context(&iam);
    state
        .sandbox_binding_service
        .get_binding(&context, &params.project_id)
        .await
        .map(|binding| Json(build_data_envelope(binding, request_id(&web))))
        .map_err(|project_error| error::map_project_error(project_error, request_trace_id(&web)))
}

pub async fn upsert_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
    body: Result<Json<UpsertProjectSandboxBindingBody>, axum::extract::rejection::JsonRejection>,
) -> Result<Json<ApiDataEnvelope<ProjectSandboxBindingPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let Json(body) = body.map_err(|_| {
        error::map_validation_error(
            "Project sandbox-binding request body is invalid.",
            trace_id,
        )
    })?;
    let idempotency_key =
        required_idempotency_key(&headers, trace_id, "project sandbox-binding")?;
    let expected_version = optional_if_match(&headers, trace_id)?;
    let request = UpsertProjectSandboxBindingRequest {
        sandbox_id: body.sandbox_id,
        root_entry_id: body.root_entry_id,
        logical_path: body.logical_path,
    };
    let context = project_context(&iam);
    let audit_context = sandbox_binding_audit_context(&web);
    state
        .sandbox_binding_service
        .upsert_binding(
            &context,
            &params.project_id,
            &request,
            expected_version,
            &idempotency_key,
            &audit_context,
        )
        .await
        .map(|binding| Json(build_data_envelope(binding, request_id(&web))))
        .map_err(|project_error| error::map_project_error(project_error, trace_id))
}

pub async fn delete_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "project sandbox-binding")?;
    let context = project_context(&iam);
    let audit_context = sandbox_binding_audit_context(&web);
    state
        .sandbox_binding_service
        .delete_binding(
            &context,
            &params.project_id,
            expected_version,
            &audit_context,
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_project_runtime_locations(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .runtime_location_service
        .list_runtime_locations(&ctx, &params.project_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(project_error) => Err(error::map_project_error(
            project_error,
            request_trace_id(&web),
        )),
    }
}

pub async fn get_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .runtime_location_service
        .get_runtime_location(&ctx, &params.project_id, &params.runtime_location_id)
        .await
    {
        Ok(location) => Ok(Json(build_data_envelope(location, request_id(&web)))),
        Err(project_error) => Err(error::map_project_error(
            project_error,
            request_trace_id(&web),
        )),
    }
}

pub async fn create_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
    Json(body): Json<CreateProjectRuntimeLocationBody>,
) -> Result<
    (
        StatusCode,
        Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>,
    ),
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime-location")?;
    let request = CreateProjectRuntimeLocationRequest {
        runtime_target_id: body.runtime_target_id,
        runtime_target_kind: body.runtime_target_kind,
        location_kind: body.location_kind,
        path_flavor: body.path_flavor,
        root_locator: body.root_locator,
        absolute_path: body.absolute_path,
        display_name: body.display_name,
    };
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    match state
        .runtime_location_service
        .create_runtime_location(
            &ctx,
            &params.project_id,
            &request,
            Some(&idempotency_key),
            &audit_context,
        )
        .await
    {
        Ok(location) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(location, request_id(&web))),
        )),
        Err(project_error) => Err(error::map_project_error(project_error, trace_id)),
    }
}

pub async fn update_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
    Json(body): Json<UpdateProjectRuntimeLocationBody>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime-location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime-location")?;
    let request = UpdateProjectRuntimeLocationRequest {
        display_name: body.display_name,
    };
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    match state
        .runtime_location_service
        .update_runtime_location(
            &ctx,
            &params.project_id,
            &params.runtime_location_id,
            &request,
            RuntimeLocationMutationContext::new(
                expected_version,
                Some(&idempotency_key),
                &audit_context,
            ),
        )
        .await
    {
        Ok(location) => Ok(Json(build_data_envelope(location, request_id(&web)))),
        Err(project_error) => Err(error::map_project_error(project_error, trace_id)),
    }
}

pub async fn delete_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime-location")?;
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    state
        .runtime_location_service
        .delete_runtime_location(
            &ctx,
            &params.project_id,
            &params.runtime_location_id,
            expected_version,
            &audit_context,
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn rebind_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
    Json(body): Json<RebindProjectRuntimeLocationBody>,
) -> Result<
    Json<ApiDataEnvelope<ProjectRuntimeLocationCommandAcceptedPayload>>,
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime-location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime-location")?;
    let request = RebindProjectRuntimeLocationRequest {
        path_flavor: body.path_flavor,
        root_locator: body.root_locator,
        absolute_path: body.absolute_path,
        display_name: body.display_name,
    };
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    match state
        .runtime_location_service
        .rebind_runtime_location(
            &ctx,
            &params.project_id,
            &params.runtime_location_id,
            &request,
            RuntimeLocationMutationContext::new(
                expected_version,
                Some(&idempotency_key),
                &audit_context,
            ),
        )
        .await
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(project_error) => Err(error::map_project_error(project_error, trace_id)),
    }
}

pub async fn request_project_runtime_location_verification(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
) -> Result<
    Json<ApiDataEnvelope<ProjectRuntimeLocationVerificationAcceptedPayload>>,
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime-location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime-location")?;
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    match state
        .runtime_location_service
        .request_runtime_location_verification(
            &ctx,
            &params.project_id,
            &params.runtime_location_id,
            expected_version,
            Some(&idempotency_key),
            &audit_context,
        )
        .await
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(project_error) => Err(error::map_project_error(project_error, trace_id)),
    }
}

pub async fn list_project_runtime_location_preferences(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectRuntimeLocationPreferencePayload>>, error::ProblemJsonBody>
{
    let ctx = project_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .runtime_location_service
        .list_runtime_location_preferences(&ctx, &params.project_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(project_error) => Err(error::map_project_error(
            project_error,
            request_trace_id(&web),
        )),
    }
}

pub async fn update_project_runtime_location_preference(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPreferencePathParams>,
    headers: HeaderMap,
    Json(body): Json<SetProjectRuntimeLocationPreferenceBody>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPreferencePayload>>, error::ProblemJsonBody>
{
    let trace_id = request_trace_id(&web);
    let expected_version = optional_if_match(&headers, trace_id)?;
    let idempotency_key =
        required_idempotency_key(&headers, trace_id, "runtime-location preference")?;
    let request = SetProjectRuntimeLocationPreferenceRequest {
        capability: params.capability,
        runtime_location_id: body.runtime_location_id,
    };
    let ctx = project_context(&iam);
    let audit_context = runtime_location_audit_context(&web);
    match state
        .runtime_location_service
        .set_runtime_location_preference(
            &ctx,
            &params.project_id,
            &request,
            expected_version,
            Some(&idempotency_key),
            &audit_context,
        )
        .await
    {
        Ok(preference) => Ok(Json(build_data_envelope(preference, request_id(&web)))),
        Err(project_error) => Err(error::map_project_error(project_error, trace_id)),
    }
}

pub async fn get_project_git_overview(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Query(query): Query<ProjectGitRuntimeLocationQuery>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .project_service
        .get_project_git_overview(&ctx, &params.project_id, &query.runtime_location_id)
        .await
    {
        Ok(overview) => Ok(Json(build_data_envelope(overview, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn get_project_git_diff(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Query(query): Query<ProjectGitRuntimeLocationQuery>,
) -> Result<Json<ApiDataEnvelope<GitProjectDiff>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .project_service
        .get_project_git_diff(&ctx, &params.project_id, &query.runtime_location_id)
        .await
    {
        Ok(diff) => Ok(Json(build_data_envelope(diff, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitBranchBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = CreateProjectGitBranchRequest {
        branch_name: body.branch_name,
    };
    match state
        .project_service
        .create_project_git_branch(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn switch_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<SwitchGitBranchBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = SwitchProjectGitBranchRequest {
        branch_name: body.branch_name,
    };
    match state
        .project_service
        .switch_project_git_branch(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn commit_project_git_changes(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CommitGitChangesBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = CommitProjectGitChangesRequest {
        include_unstaged: body.include_unstaged,
        message: body.message,
    };
    match state
        .project_service
        .commit_project_git_changes(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn push_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PushGitBranchBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = PushProjectGitBranchRequest {
        branch_name: body.branch_name,
        remote_name: body.remote_name,
    };
    match state
        .project_service
        .push_project_git_branch(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitWorktreeBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = CreateProjectGitWorktreeRequest {
        branch_name: body.branch_name,
    };
    match state
        .project_service
        .create_project_git_worktree(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn remove_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<RemoveGitWorktreeBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let runtime_location_id = body.runtime_location_id;
    let request = RemoveProjectGitWorktreeRequest {
        worktree_key: body.worktree_key,
        force: body.force,
    };
    match state
        .project_service
        .remove_project_git_worktree(&ctx, &params.project_id, &runtime_location_id, &request)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn prune_project_git_worktrees(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PruneGitWorktreesBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    match state
        .project_service
        .prune_project_git_worktrees(&ctx, &params.project_id, &body.runtime_location_id)
        .await
    {
        Ok(overview) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(overview, request_id(&web))),
        )),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Collaborator handlers ────────────────────────────────────────────

pub async fn list_project_collaborators(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectCollaboratorPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let trace_id = request_trace_id(&web);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .project_service
        .list_project_collaborators(&ctx, &params.project_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_project_error(e, trace_id)),
    }
}

pub async fn upsert_project_collaborator(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpsertProjectCollaboratorBody>,
) -> Result<Json<ApiDataEnvelope<ProjectCollaboratorPayload>>, error::ProblemJsonBody> {
    let ctx = project_context(&iam);
    let request = UpsertProjectCollaboratorRequest {
        user_id: body.user_id,
        role: body.role,
        status: body.status,
    };
    match state
        .project_service
        .upsert_project_collaborator(&ctx, &params.project_id, &request)
        .await
    {
        Ok(collaborator) => Ok(Json(build_data_envelope(collaborator, request_id(&web)))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Deployment handlers ──────────────────────────────────────────────

pub async fn list_deployments(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
) -> Result<Json<ApiListEnvelope<DeploymentPayload>>, error::ProblemJsonBody> {
    let ctx = deployment_context(&iam);
    let trace_id = request_trace_id(&web);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .deployment_service
        .list_deployments(&ctx, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_deployment_error(e, trace_id)),
    }
}

pub async fn list_project_deployment_targets(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<DeploymentTargetPayload>>, error::ProblemJsonBody> {
    let ctx = deployment_context(&iam);
    let trace_id = request_trace_id(&web);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .deployment_service
        .list_deployment_targets_by_project(&ctx, &params.project_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_deployment_error(e, trace_id)),
    }
}

pub async fn publish_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PublishProjectBody>,
) -> Result<Json<ApiDataEnvelope<PublishProjectResultPayload>>, error::ProblemJsonBody> {
    let project_ctx = project_context(&iam);
    let deployment_ctx = deployment_context(&iam);
    let project = match state
        .project_service
        .get_project(&project_ctx, &params.project_id)
        .await
    {
        Ok(project) => project,
        Err(error) => return Err(error::map_project_error(error, request_trace_id(&web))),
    };
    let command = PublishProjectCommand {
        workspace_id: project.workspace_id,
        project_id: params.project_id,
        project_name: project.name,
        project_tenant_id: iam.tenant_id.clone(),
        project_organization_id: iam.organization_id.clone(),
        project_owner_id: Some(iam.user_id.clone()),
        project_created_by_user_id: Some(iam.user_id.clone()),
        current_user_id: Some(iam.user_id.clone()),
        request: DeployPublishRequest {
            endpoint_url: None,
            environment_key: body.environment_key,
            release_kind: body.release_kind,
            release_version: body.release_version,
            rollout_stage: None,
            runtime: body.runtime,
            target_id: None,
            target_name: body.target_name,
        },
    };
    match state
        .deployment_service
        .publish_project(&deployment_ctx, &command)
        .await
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(e) => Err(error::map_deployment_error(e, request_trace_id(&web))),
    }
}

pub async fn list_teams(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<TeamListQuery>,
) -> Result<Json<ApiListEnvelope<TeamPayload>>, error::ProblemJsonBody> {
    if let Some(requested_user_id) = query.user_id.as_deref() {
        if requested_user_id != iam.user_id {
            return Err(error::forbidden(
                "Team listing is limited to the authenticated user.",
                request_trace_id(&web),
            ));
        }
    }

    let ctx = workspace_context(&iam);
    let trace_id = request_trace_id(&web);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .team_service
        .list_teams(
            &ctx,
            query.workspace_id.as_deref(),
            query.user_id.as_deref(),
            offset,
            page_size,
        )
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_workspace_error(e, trace_id, "teams.list")),
    }
}

#[cfg(test)]
mod realtime_transport_tests {
    use std::sync::{Arc, RwLock};

    use super::*;

    struct StaticReplayProvider {
        events: Vec<WorkspaceRealtimeReplayEvent>,
    }

    #[derive(Clone)]
    struct MutableReplayProvider {
        events: Arc<RwLock<Vec<WorkspaceRealtimeReplayEvent>>>,
    }

    #[async_trait::async_trait]
    impl crate::realtime_replay::WorkspaceRealtimeReplayProvider for StaticReplayProvider {
        async fn load_page(
            &self,
            _scope: &WorkspaceRealtimeReplayScope,
            after_sequence: Option<usize>,
            high_watermark: Option<usize>,
            _page_size: usize,
        ) -> Result<crate::realtime_replay::WorkspaceRealtimeReplayPage, WorkspaceRealtimeReplayError>
        {
            let events = self
                .events
                .iter()
                .filter(|event| after_sequence.is_none_or(|after| event.sequence > after))
                .cloned()
                .collect::<Vec<_>>();
            Ok(crate::realtime_replay::WorkspaceRealtimeReplayPage {
                high_watermark: high_watermark
                    .or_else(|| self.events.iter().map(|event| event.sequence).max()),
                events,
                has_more: false,
            })
        }
    }

    #[async_trait::async_trait]
    impl crate::realtime_replay::WorkspaceRealtimeReplayProvider for MutableReplayProvider {
        async fn load_page(
            &self,
            _scope: &WorkspaceRealtimeReplayScope,
            after_sequence: Option<usize>,
            high_watermark: Option<usize>,
            page_size: usize,
        ) -> Result<crate::realtime_replay::WorkspaceRealtimeReplayPage, WorkspaceRealtimeReplayError>
        {
            let events = self
                .events
                .read()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let high_watermark =
                high_watermark.or_else(|| events.iter().map(|event| event.sequence).max());
            let eligible = events
                .iter()
                .filter(|event| after_sequence.is_none_or(|after| event.sequence > after))
                .filter(|event| {
                    high_watermark.is_none_or(|high_watermark| event.sequence <= high_watermark)
                })
                .cloned()
                .collect::<Vec<_>>();
            let has_more = eligible.len() > page_size;
            Ok(crate::realtime_replay::WorkspaceRealtimeReplayPage {
                events: eligible.into_iter().take(page_size).collect(),
                high_watermark,
                has_more,
            })
        }
    }

    fn durable_message(sequence: usize) -> WorkspaceRealtimeReplayEvent {
        let event_id = format!("durable-event-{sequence}");
        WorkspaceRealtimeReplayEvent {
            event_id: event_id.clone(),
            coding_session_id: "coding-session-1".to_owned(),
            sequence,
            message: serde_json::json!({
                "kind": "event",
                "event": {
                    "eventId": event_id,
                    "codingSessionId": "coding-session-1",
                    "codingSessionEventSequence": sequence.to_string()
                }
            })
            .to_string(),
        }
    }

    #[test]
    fn explicit_realtime_transport_wins_over_upgrade_detection() {
        assert_eq!(
            resolve_workspace_realtime_transport(Some("sse"), true),
            Ok(WorkspaceRealtimeTransport::Sse)
        );
        assert_eq!(
            resolve_workspace_realtime_transport(Some("websocket"), false),
            Ok(WorkspaceRealtimeTransport::WebSocket)
        );
    }

    #[test]
    fn realtime_transport_defaults_to_the_available_protocol_shape() {
        assert_eq!(
            resolve_workspace_realtime_transport(None, true),
            Ok(WorkspaceRealtimeTransport::WebSocket)
        );
        assert_eq!(
            resolve_workspace_realtime_transport(None, false),
            Ok(WorkspaceRealtimeTransport::Sse)
        );
        assert!(resolve_workspace_realtime_transport(Some("long-poll"), false).is_err());
    }

    #[test]
    fn websocket_application_protocol_accepts_one_exact_offer_with_credential_protocols() {
        let mut headers = HeaderMap::new();
        headers.append(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_static("sdkwork-auth.token"),
        );
        headers.append(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_static("sdkwork-realtime-v1, sdkwork-access.token"),
        );

        assert_eq!(
            validate_workspace_realtime_websocket_protocol(&headers),
            Ok(())
        );
    }

    #[test]
    fn websocket_application_protocol_rejects_missing_or_inexact_offers() {
        let headers = HeaderMap::new();
        assert!(validate_workspace_realtime_websocket_protocol(&headers).is_err());

        let mut headers = HeaderMap::new();
        headers.insert(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_static(
                "sdkwork-auth.token, SDKWORK-REALTIME-V1, sdkwork-access.token",
            ),
        );
        assert!(validate_workspace_realtime_websocket_protocol(&headers).is_err());

        headers.insert(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_bytes(b"\xFF").unwrap(),
        );
        assert!(validate_workspace_realtime_websocket_protocol(&headers).is_err());
    }

    #[test]
    fn websocket_application_protocol_rejects_duplicates_across_header_values() {
        let mut headers = HeaderMap::new();
        headers.append(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_static("sdkwork-realtime-v1"),
        );
        headers.append(
            header::SEC_WEBSOCKET_PROTOCOL,
            axum::http::HeaderValue::from_static(
                "sdkwork-auth.token, sdkwork-realtime-v1, sdkwork-access.token",
            ),
        );

        assert!(validate_workspace_realtime_websocket_protocol(&headers).is_err());
    }

    #[tokio::test]
    async fn sse_realtime_response_uses_event_stream_content_type() {
        let hub = WorkspaceRealtimeHub::new();
        let (public_receiver, user_inventory_receiver) = hub
            .subscribe_public_and_user_inventory(
                "tenant-sse-test",
                "user-sse-test",
                "workspace-sse-test",
            )
            .await
            .expect("subscribe test workspace");
        let response = build_workspace_realtime_sse_response(
            WorkspaceRealtimeDeliveryState::live_only(
                public_receiver,
                user_inventory_receiver,
                WorkspaceRealtimeTransport::Sse,
            ),
            "workspace-sse-test".to_owned(),
            "user-sse-test".to_owned(),
        );

        assert_eq!(
            response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("text/event-stream")
        );
        assert_eq!(
            response
                .headers()
                .get(header::CACHE_CONTROL)
                .and_then(|value| value.to_str().ok()),
            Some("no-cache, no-store, no-transform")
        );
        assert_eq!(
            response
                .headers()
                .get("x-accel-buffering")
                .and_then(|value| value.to_str().ok()),
            Some("no")
        );
        assert!(response.headers().get(header::CONTENT_ENCODING).is_none());
    }

    #[tokio::test]
    async fn live_only_delivery_merges_public_and_user_inventory_events() {
        let hub = WorkspaceRealtimeHub::new();
        let (public_receiver, user_inventory_receiver) = hub
            .subscribe_public_and_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe public and user inventory channels");
        let mut delivery = WorkspaceRealtimeDeliveryState::live_only(
            public_receiver,
            user_inventory_receiver,
            WorkspaceRealtimeTransport::WebSocket,
        );

        hub.publish("tenant-1", "workspace-1", "public-lifecycle")
            .await
            .expect("publish public lifecycle event");
        assert_eq!(
            delivery.next_message().await.as_deref(),
            Some("public-lifecycle")
        );

        hub.publish_user_inventory(
            "tenant-1",
            "user-1",
            "workspace-1",
            "coding-session-inventory-summary",
        )
        .await
        .expect("publish coding-session inventory summary");
        assert_eq!(
            delivery.next_message().await.as_deref(),
            Some("coding-session-inventory-summary")
        );
    }

    #[test]
    fn parses_and_validates_durable_sse_cursor() {
        let mut headers = HeaderMap::new();
        headers.insert("last-event-id", "coding-session-1:42".parse().unwrap());

        assert_eq!(
            parse_last_event_id_cursor(&headers, "coding-session-1"),
            Ok(Some(42))
        );
        assert!(parse_last_event_id_cursor(&headers, "coding-session-2").is_err());
    }

    #[test]
    fn rejects_non_utf8_last_event_id_and_ignores_an_empty_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "last-event-id",
            axum::http::HeaderValue::from_bytes(b"\xFF").unwrap(),
        );
        assert!(read_last_event_id(&headers).is_err());

        headers.insert("last-event-id", axum::http::HeaderValue::from_static("   "));
        assert_eq!(read_last_event_id(&headers), Ok(None));
    }

    #[test]
    fn reads_durable_cursor_from_canonical_message() {
        let message = serde_json::json!({
            "kind": "event",
            "event": {
                "eventId": "event-7",
                "codingSessionId": "coding-session-1",
                "codingSessionEventSequence": "7"
            }
        })
        .to_string();

        assert_eq!(
            parse_coding_session_message_cursor(&message),
            Some(("coding-session-1".to_owned(), 7, "event-7".to_owned()))
        );

        let zero_sequence_message = serde_json::json!({
            "kind": "event",
            "event": {
                "eventId": "event-zero",
                "codingSessionId": "coding-session-1",
                "codingSessionEventSequence": "0"
            }
        })
        .to_string();
        assert_eq!(
            parse_coding_session_message_cursor(&zero_sequence_message),
            None,
            "zero is a replay cursor, not a durable event sequence"
        );
    }

    #[tokio::test]
    async fn websocket_heartbeat_matches_the_sse_keep_alive_budget() {
        assert_eq!(WORKSPACE_REALTIME_WEBSOCKET_PROTOCOL, "sdkwork-realtime-v1");
        assert_eq!(
            REALTIME_WEBSOCKET_HEARTBEAT_INTERVAL,
            Duration::from_secs(15)
        );
        assert_eq!(REALTIME_WEBSOCKET_PONG_TIMEOUT, Duration::from_secs(10));
        let _heartbeat = workspace_realtime_heartbeat();

        let now = tokio::time::Instant::now();
        let mut state = WebSocketHeartbeatState::default();
        state.begin_ping(vec![1, 2, 3], now);
        assert_eq!(
            state.pong_deadline(),
            Some(now + REALTIME_WEBSOCKET_PONG_TIMEOUT)
        );
        assert!(!state.observe_pong(&[9, 9, 9]));
        assert!(state.is_waiting_for_pong());
        assert!(state.observe_pong(&[1, 2, 3]));
        assert!(!state.is_waiting_for_pong());
        assert_eq!(state.pong_deadline(), None);
    }

    #[tokio::test(start_paused = true)]
    async fn authorization_lease_wins_over_an_event_ready_at_the_deadline() {
        let hub = WorkspaceRealtimeHub::new();
        let (public_receiver, user_inventory_receiver) = hub
            .subscribe_public_and_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe live delivery");
        let mut delivery = WorkspaceRealtimeDeliveryState::live_only(
            public_receiver,
            user_inventory_receiver,
            WorkspaceRealtimeTransport::WebSocket,
        );
        delivery.authorization_lease_deadline =
            tokio::time::Instant::now() + Duration::from_secs(1);
        hub.publish("tenant-1", "workspace-1", "event-at-deadline")
            .await
            .expect("publish event before advancing to the lease boundary");

        tokio::time::advance(Duration::from_secs(1)).await;

        assert!(matches!(
            delivery.next_delivery().await,
            WorkspaceRealtimeDelivery::AuthorizationLeaseExpired
        ));
    }

    #[tokio::test]
    async fn rejects_replay_pages_above_the_delivery_queue_bound() {
        let hub = WorkspaceRealtimeHub::new();
        let receiver = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "coding-session-1")
            .await
            .expect("subscribe durable session channel");
        let events = (1..=REALTIME_REPLAY_PAGE_SIZE + 1)
            .map(durable_message)
            .collect::<Vec<_>>();
        let mut delivery = WorkspaceRealtimeDeliveryState::durable(
            receiver,
            Arc::new(StaticReplayProvider { events }),
            WorkspaceRealtimeReplayScope {
                tenant_id: "tenant-1".to_owned(),
                organization_id: "organization-1".to_owned(),
                user_id: "user-1".to_owned(),
                iam_session_id: "iam-session-1".to_owned(),
                workspace_id: "workspace-1".to_owned(),
                coding_session_id: "coding-session-1".to_owned(),
            },
            Some(0),
            WorkspaceRealtimeTransport::WebSocket,
        );

        assert!(matches!(
            delivery.prime().await,
            Err(WorkspaceRealtimeReplayError::Unavailable(message))
                if message.contains("bounded page size")
        ));
        assert!(delivery.pending_replay.is_empty());
    }

    #[test]
    fn rejects_a_replay_gap_before_the_first_durable_event() {
        let scope = WorkspaceRealtimeReplayScope {
            tenant_id: "tenant-1".to_owned(),
            organization_id: "organization-1".to_owned(),
            user_id: "user-1".to_owned(),
            iam_session_id: "iam-session-1".to_owned(),
            workspace_id: "workspace-1".to_owned(),
            coding_session_id: "coding-session-1".to_owned(),
        };

        assert!(matches!(
            validate_replay_event(&scope, None, Some(2), &durable_message(2)),
            Err(WorkspaceRealtimeReplayError::Unavailable(message))
                if message.contains("non-contiguous")
        ));
    }

    #[tokio::test]
    async fn durable_delivery_replays_then_deduplicates_live_handoff() {
        let hub = WorkspaceRealtimeHub::new();
        let receiver = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "coding-session-1")
            .await
            .expect("subscribe durable session channel");
        let replayed = durable_message(1);
        let live = durable_message(2);
        let mut delivery = WorkspaceRealtimeDeliveryState::durable(
            receiver,
            Arc::new(StaticReplayProvider {
                events: vec![replayed.clone()],
            }),
            WorkspaceRealtimeReplayScope {
                tenant_id: "tenant-1".to_owned(),
                organization_id: "organization-1".to_owned(),
                user_id: "user-1".to_owned(),
                iam_session_id: "iam-session-1".to_owned(),
                workspace_id: "workspace-1".to_owned(),
                coding_session_id: "coding-session-1".to_owned(),
            },
            None,
            WorkspaceRealtimeTransport::WebSocket,
        );
        delivery.prime().await.expect("prime replay");
        hub.publish_session(
            "tenant-1",
            "user-1",
            "workspace-1",
            "coding-session-1",
            &replayed.message,
        )
        .await
        .expect("publish duplicate handoff event");
        hub.publish_session(
            "tenant-1",
            "user-1",
            "workspace-1",
            "coding-session-1",
            &live.message,
        )
        .await
        .expect("publish next live event");

        assert_eq!(delivery.next_message().await, Some(replayed.message));
        assert_eq!(delivery.next_message().await, Some(live.message));
    }

    #[tokio::test]
    async fn durable_session_delivery_recovers_channel_lag_by_replay() {
        let hub = WorkspaceRealtimeHub::new();
        let receiver = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "coding-session-1")
            .await
            .expect("subscribe durable session channel");
        let events = Arc::new(RwLock::new(vec![durable_message(1)]));
        let mut delivery = WorkspaceRealtimeDeliveryState::durable(
            receiver,
            Arc::new(MutableReplayProvider {
                events: events.clone(),
            }),
            WorkspaceRealtimeReplayScope {
                tenant_id: "tenant-1".to_owned(),
                organization_id: "organization-1".to_owned(),
                user_id: "user-1".to_owned(),
                iam_session_id: "iam-session-1".to_owned(),
                workspace_id: "workspace-1".to_owned(),
                coding_session_id: "coding-session-1".to_owned(),
            },
            None,
            WorkspaceRealtimeTransport::WebSocket,
        );
        delivery.prime().await.expect("prime initial replay");
        assert_eq!(
            delivery.next_message().await,
            Some(durable_message(1).message)
        );

        *events
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner) =
            (1..=300).map(durable_message).collect();
        for sequence in 2..=300 {
            hub.publish_session(
                "tenant-1",
                "user-1",
                "workspace-1",
                "coding-session-1",
                &durable_message(sequence).message,
            )
            .await
            .expect("publish durable session event");
        }

        assert_eq!(
            delivery.next_message().await,
            Some(durable_message(2).message),
            "lag must recover from the owner-scoped durable cursor"
        );
    }
}
