use crate::context::CodingSessionContext;
use crate::error::CodingSessionError;

#[derive(Clone, Debug)]
pub struct CodingSessionRealtimeEventInput {
    pub event_kind: String,
    pub source_surface: String,
    pub workspace_id: String,
    pub project_id: String,
    pub coding_session_id: String,
    pub coding_session_title: String,
    pub coding_session_status: String,
    pub coding_session_host_mode: String,
    pub coding_session_engine_id: String,
    pub coding_session_model_id: String,
    pub coding_session_runtime_status: Option<String>,
    pub native_session_id: Option<String>,
    pub coding_session_updated_at: Option<String>,
    pub turn_id: Option<String>,
}

#[async_trait::async_trait]
pub trait RealtimeEventPublisher: Send + Sync {
    async fn publish_workspace_event(
        &self,
        ctx: &CodingSessionContext,
        workspace_id: &str,
        event_kind: &str,
        payload_json: &str,
    ) -> Result<(), CodingSessionError>;

    async fn publish_coding_session_event(
        &self,
        ctx: &CodingSessionContext,
        event: &CodingSessionRealtimeEventInput,
    ) -> Result<(), CodingSessionError>;
}
