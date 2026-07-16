use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct WorkspaceRealtimeReplayScope {
    pub tenant_id: String,
    pub organization_id: String,
    pub user_id: String,
    pub iam_session_id: String,
    pub workspace_id: String,
    pub coding_session_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceRealtimeReplayEvent {
    pub event_id: String,
    pub coding_session_id: String,
    pub sequence: usize,
    pub message: String,
}

#[derive(Clone, Debug, Default)]
pub struct WorkspaceRealtimeReplayPage {
    pub events: Vec<WorkspaceRealtimeReplayEvent>,
    pub high_watermark: Option<usize>,
    pub has_more: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkspaceRealtimeReplayError {
    InvalidCursor(String),
    NotFound(String),
    Unavailable(String),
}

#[async_trait::async_trait]
pub trait WorkspaceRealtimeReplayProvider: Send + Sync {
    async fn load_page(
        &self,
        scope: &WorkspaceRealtimeReplayScope,
        after_sequence: Option<usize>,
        high_watermark: Option<usize>,
        page_size: usize,
    ) -> Result<WorkspaceRealtimeReplayPage, WorkspaceRealtimeReplayError>;
}

pub type SharedWorkspaceRealtimeReplayProvider = Arc<dyn WorkspaceRealtimeReplayProvider>;
