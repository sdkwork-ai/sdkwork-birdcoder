use serde::Deserialize;
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;

// Per PAGINATION_SPEC.md §3: route layer normalizes page_size into [1, 200]
// and pushes LIMIT/OFFSET to SQL at the repository layer (§2/§5). The local
// constants previously declared here (MAX_LIST_PAGE_SIZE = 100) silently
// diverged from the canonical `clamp_list_page_size` cap of 200; route
// handlers now delegate to the shared helper to keep a single source of
// truth.

pub(crate) fn normalize_list_pagination(
    offset: Option<usize>,
    limit: Option<usize>,
) -> (usize, usize) {
    clamp_list_page_size(offset, limit)
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionChildListQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl SessionChildListQuery {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_list_pagination(self.offset, self.limit)
    }
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl ListSessionsQuery {
    /// Returns `(offset, limit)` after normalization through
    /// [`clamp_list_page_size`]. Use this for both the SQL push-down and the
    /// envelope's `pageInfo` so the values reported to clients match the
    /// values actually used in the query.
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_list_pagination(self.offset, self.limit)
    }
}

impl From<ListSessionsQuery> for CodingSessionListQuery {
    fn from(q: ListSessionsQuery) -> Self {
        let (offset, limit) = q.normalized_pagination();
        Self {
            workspace_id: q.workspace_id,
            project_id: q.project_id,
            engine_id: q.engine_id,
            limit: Some(limit),
            offset: Some(offset),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCodingSessionRequest {
    pub workspace_id: String,
    pub project_id: String,
    pub title: Option<String>,
    pub host_mode: Option<String>,
    pub engine_id: Option<String>,
    pub model_id: Option<String>,
}

impl From<CreateCodingSessionRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::CreateCodingSessionRequest
{
    fn from(r: CreateCodingSessionRequest) -> Self {
        Self {
            workspace_id: r.workspace_id,
            project_id: r.project_id,
            title: r.title,
            host_mode: r.host_mode,
            engine_id: r.engine_id,
            model_id: r.model_id,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCodingSessionRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub host_mode: Option<String>,
    pub engine_id: Option<String>,
    pub model_id: Option<String>,
}

impl From<UpdateCodingSessionRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::UpdateCodingSessionRequest
{
    fn from(r: UpdateCodingSessionRequest) -> Self {
        Self {
            title: r.title,
            status: r.status,
            host_mode: r.host_mode,
            engine_id: r.engine_id,
            model_id: r.model_id,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkCodingSessionRequest {
    pub title: Option<String>,
}

impl From<ForkCodingSessionRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::ForkCodingSessionRequest
{
    fn from(r: ForkCodingSessionRequest) -> Self {
        Self { title: r.title }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditCodingSessionMessageRequest {
    pub content: String,
}

impl From<EditCodingSessionMessageRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::EditCodingSessionMessageRequest
{
    fn from(r: EditCodingSessionMessageRequest) -> Self {
        Self { content: r.content }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCodingSessionTurnRequest {
    pub runtime_id: Option<String>,
    pub engine_id: Option<String>,
    pub model_id: Option<String>,
    pub request_kind: String,
    pub input_summary: String,
    pub stream: Option<bool>,
    pub ide_context:
        Option<sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionTurnIdeContextPayload>,
    pub options:
        Option<sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionTurnOptionsPayload>,
}

impl From<CreateCodingSessionTurnRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::CreateCodingSessionTurnRequest
{
    fn from(r: CreateCodingSessionTurnRequest) -> Self {
        Self {
            runtime_id: r.runtime_id,
            engine_id: r.engine_id,
            model_id: r.model_id,
            request_kind: r.request_kind,
            input_summary: r.input_summary,
            stream: r.stream,
            ide_context: r.ide_context,
            options: r.options,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitApprovalDecisionRequest {
    pub decision: String,
    pub reason: Option<String>,
}

impl From<SubmitApprovalDecisionRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::SubmitApprovalDecisionRequest
{
    fn from(r: SubmitApprovalDecisionRequest) -> Self {
        Self {
            decision: r.decision,
            reason: r.reason,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitUserQuestionAnswerRequest {
    pub answer: Option<String>,
    pub option_id: Option<String>,
    pub option_label: Option<String>,
    pub rejected: Option<bool>,
}

impl From<SubmitUserQuestionAnswerRequest>
    for sdkwork_birdcoder_coding_sessions_service::domain::commands::SubmitUserQuestionAnswerRequest
{
    fn from(r: SubmitUserQuestionAnswerRequest) -> Self {
        Self {
            answer: r.answer,
            option_id: r.option_id,
            option_label: r.option_label,
            rejected: r.rejected,
        }
    }
}

