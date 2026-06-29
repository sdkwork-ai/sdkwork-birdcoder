use serde::Serialize;
use sdkwork_utils_rust::{
    PageInfo, PageMode, SdkWorkApiResponse, SdkWorkPageData, SdkWorkResourceData,
};

pub const BIRDCODER_CODING_SERVER_API_VERSION: &str = "v1";

pub type ApiDataEnvelope<T> = SdkWorkApiResponse<SdkWorkResourceData<T>>;
pub type ApiListEnvelope<T> = SdkWorkApiResponse<SdkWorkPageData<T>>;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMeta {
    pub version: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiListMeta {
    pub page: usize,
    pub page_size: usize,
    pub total: usize,
    pub version: &'static str,
}

fn offset_limit_to_page(offset: usize, page_size: usize) -> usize {
    if page_size == 0 {
        1
    } else {
        offset / page_size + 1
    }
}

fn build_page_info(offset: usize, page_size: usize, total: usize) -> PageInfo {
    PageInfo {
        mode: PageMode::Offset,
        page: Some(offset_limit_to_page(offset, page_size) as i32),
        page_size: Some(page_size as i32),
        total_items: Some(total.to_string()),
        total_pages: None,
        next_cursor: None,
        has_more: None,
    }
}

pub fn build_data_envelope<T: Serialize>(data: T, trace_id: &str) -> ApiDataEnvelope<T> {
    SdkWorkApiResponse::success(SdkWorkResourceData { item: data }, trace_id)
}

pub fn build_list_envelope<T: Serialize>(
    items: Vec<T>,
    total: usize,
    trace_id: &str,
) -> ApiListEnvelope<T> {
    let page_size = items.len().max(1);
    build_offset_list_envelope(items, 0, page_size, total, trace_id)
}

pub fn build_offset_list_envelope<T: Serialize>(
    items: Vec<T>,
    offset: usize,
    page_size: usize,
    total: usize,
    trace_id: &str,
) -> ApiListEnvelope<T> {
    SdkWorkApiResponse::success(
        SdkWorkPageData {
            items,
            page_info: build_page_info(offset, page_size, total),
        },
        trace_id,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_envelope_uses_sdkwork_page_data() {
        let envelope = build_offset_list_envelope(
            vec!["alpha".to_owned()],
            20,
            20,
            41,
            "trace-list-envelope",
        );
        let json = serde_json::to_value(envelope).expect("serialize list envelope");
        assert_eq!(json["code"], 0);
        assert_eq!(json["traceId"], "trace-list-envelope");
        assert_eq!(json["data"]["items"][0], "alpha");
        assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
        assert_eq!(json["data"]["pageInfo"]["page"], 2);
        assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
        assert_eq!(json["data"]["pageInfo"]["totalItems"], "41");
    }

    #[test]
    fn data_envelope_uses_sdkwork_resource_data() {
        let envelope = build_data_envelope(serde_json::json!({ "id": "session-1" }), "trace-data-envelope");
        let json = serde_json::to_value(envelope).expect("serialize data envelope");
        assert_eq!(json["code"], 0);
        assert_eq!(json["traceId"], "trace-data-envelope");
        assert_eq!(json["data"]["item"]["id"], "session-1");
    }
}
