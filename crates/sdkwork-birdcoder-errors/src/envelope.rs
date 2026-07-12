use sdkwork_utils_rust::{
    offset_list_page_data, offset_list_page_params_from_values, SdkWorkApiResponse,
    SdkWorkPageData, SdkWorkResourceData, DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE,
};
use serde::Serialize;

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

fn normalize_offset_page_size(page_size: usize) -> i64 {
    i64::try_from(page_size)
        .ok()
        .filter(|value| (1..=i64::from(MAX_LIST_PAGE_SIZE)).contains(value))
        .unwrap_or(i64::from(DEFAULT_LIST_PAGE_SIZE))
}

fn offset_page_params(offset: usize, page_size: usize) -> sdkwork_utils_rust::OffsetListPageParams {
    let page_size = normalize_offset_page_size(page_size);
    let offset = i64::try_from(offset).unwrap_or(i64::MAX);
    let max_page = i64::MAX / page_size;
    let page = offset
        .saturating_div(page_size)
        .saturating_add(1)
        .min(max_page);
    offset_list_page_params_from_values(page, page_size)
}

fn normalize_total_items(total: usize) -> i64 {
    i64::try_from(total).unwrap_or(i64::MAX - i64::from(MAX_LIST_PAGE_SIZE))
}

pub fn build_data_envelope<T: Serialize>(data: T, trace_id: &str) -> ApiDataEnvelope<T> {
    SdkWorkApiResponse::success(SdkWorkResourceData { item: data }, trace_id)
}

pub fn build_list_envelope<T: Serialize>(
    items: Vec<T>,
    offset: usize,
    page_size: usize,
    total: usize,
    trace_id: &str,
) -> ApiListEnvelope<T> {
    build_offset_list_envelope(items, offset, page_size, total, trace_id)
}

/// Lists with bounded cardinality (PAGINATION_SPEC.md §11) that return the full
/// set in one response still emit accurate `pageInfo` metadata.
pub fn build_unbounded_list_envelope<T: Serialize>(
    items: Vec<T>,
    trace_id: &str,
) -> ApiListEnvelope<T> {
    let total = items.len();
    build_offset_list_envelope(items, 0, total.max(1), total, trace_id)
}

pub fn build_offset_list_envelope<T: Serialize>(
    items: Vec<T>,
    offset: usize,
    page_size: usize,
    total: usize,
    trace_id: &str,
) -> ApiListEnvelope<T> {
    SdkWorkApiResponse::success(
        offset_list_page_data(
            items,
            normalize_total_items(total),
            offset_page_params(offset, page_size),
        ),
        trace_id,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_envelope_uses_sdkwork_page_data() {
        let envelope =
            build_offset_list_envelope(vec!["alpha".to_owned()], 20, 20, 41, "trace-list-envelope");
        let json = serde_json::to_value(envelope).expect("serialize list envelope");
        assert_eq!(json["code"], 0);
        assert_eq!(json["traceId"], "trace-list-envelope");
        assert_eq!(json["data"]["items"][0], "alpha");
        assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
        assert_eq!(json["data"]["pageInfo"]["page"], 2);
        assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
        assert_eq!(json["data"]["pageInfo"]["totalItems"], "41");
        assert_eq!(json["data"]["pageInfo"]["totalPages"], 3);
        assert_eq!(json["data"]["pageInfo"]["hasMore"], true);
    }

    #[test]
    fn empty_offset_list_envelope_reports_zero_pages_and_no_next_page() {
        let envelope =
            build_offset_list_envelope::<String>(Vec::new(), 0, 20, 0, "trace-empty-list-envelope");
        let json = serde_json::to_value(envelope).expect("serialize empty list envelope");

        assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
        assert_eq!(json["data"]["pageInfo"]["page"], 1);
        assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
        assert_eq!(json["data"]["pageInfo"]["totalItems"], "0");
        assert_eq!(json["data"]["pageInfo"]["totalPages"], 0);
        assert_eq!(json["data"]["pageInfo"]["hasMore"], false);
    }

    #[test]
    fn final_exact_offset_list_page_reports_no_next_page() {
        let envelope = build_offset_list_envelope(
            vec!["omega".to_owned()],
            20,
            20,
            40,
            "trace-final-list-envelope",
        );
        let json = serde_json::to_value(envelope).expect("serialize final list envelope");

        assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
        assert_eq!(json["data"]["pageInfo"]["page"], 2);
        assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
        assert_eq!(json["data"]["pageInfo"]["totalItems"], "40");
        assert_eq!(json["data"]["pageInfo"]["totalPages"], 2);
        assert_eq!(json["data"]["pageInfo"]["hasMore"], false);
    }

    #[test]
    fn data_envelope_uses_sdkwork_resource_data() {
        let envelope = build_data_envelope(
            serde_json::json!({ "id": "session-1" }),
            "trace-data-envelope",
        );
        let json = serde_json::to_value(envelope).expect("serialize data envelope");
        assert_eq!(json["code"], 0);
        assert_eq!(json["traceId"], "trace-data-envelope");
        assert_eq!(json["data"]["item"]["id"], "session-1");
    }
}
