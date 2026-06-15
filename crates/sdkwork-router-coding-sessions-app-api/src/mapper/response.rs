use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T: Serialize> {
    pub data: T,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn new(data: T) -> Self {
        Self { data }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiListResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: usize,
}

impl<T: Serialize> ApiListResponse<T> {
    pub fn new(data: Vec<T>) -> Self {
        let total = data.len();
        Self { data, total }
    }

    pub fn with_total(data: Vec<T>, total: usize) -> Self {
        Self { data, total }
    }
}

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

