use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub id: String,
}

impl From<sdkwork_birdcoder_coding_sessions_service::domain::results::DeleteEntityPayload>
    for DeleteResponse
{
    fn from(
        payload: sdkwork_birdcoder_coding_sessions_service::domain::results::DeleteEntityPayload,
    ) -> Self {
        Self { id: payload.id }
    }
}
