use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use serde::Deserialize;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsQuery {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
}

impl ListSessionsQuery {
    /// Combines domain filters with pagination already validated by the route.
    /// The same values must be used for SQL push-down and response `pageInfo`.
    pub fn into_service_query(self, offset: usize, page_size: usize) -> CodingSessionListQuery {
        CodingSessionListQuery {
            workspace_id: self.workspace_id,
            project_id: self.project_id,
            engine_id: self.engine_id,
            page_size: Some(page_size),
            offset: Some(offset),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn list_sessions_query_maps_validated_pagination_to_the_service_query() {
        let query: ListSessionsQuery = serde_json::from_value(json!({
            "workspaceId": "workspace-1",
            "projectId": "project-1",
            "engineId": "engine-1"
        }))
        .expect("deserialize query");

        let service_query = query.into_service_query(30, 15);

        assert_eq!(service_query.workspace_id.as_deref(), Some("workspace-1"));
        assert_eq!(service_query.project_id.as_deref(), Some("project-1"));
        assert_eq!(service_query.engine_id.as_deref(), Some("engine-1"));
        assert_eq!(service_query.offset, Some(30));
        assert_eq!(service_query.page_size, Some(15));
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
