use serde::Deserialize;
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;

pub const MAX_LIST_PAGE_SIZE: usize = 100;

fn clamp_list_limit(limit: Option<usize>) -> Option<usize> {
    limit.map(|value| value.clamp(1, MAX_LIST_PAGE_SIZE))
}

fn clamp_list_offset(offset: Option<usize>) -> Option<usize> {
    offset.map(|value| value.min(10_000))
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

impl From<ListSessionsQuery> for CodingSessionListQuery {
    fn from(q: ListSessionsQuery) -> Self {
        Self {
            workspace_id: q.workspace_id,
            project_id: q.project_id,
            engine_id: q.engine_id,
            limit: clamp_list_limit(q.limit),
            offset: clamp_list_offset(q.offset),
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

