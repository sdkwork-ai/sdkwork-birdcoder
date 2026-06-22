use serde::Serialize;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

pub const BIRDCODER_CODING_SERVER_API_VERSION: &str = "v1";

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDataEnvelope<T: Serialize> {
    pub data: T,
    pub meta: ApiMeta,
    pub request_id: String,
    pub timestamp: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiListEnvelope<T: Serialize> {
    pub items: Vec<T>,
    pub meta: ApiListMeta,
    pub request_id: String,
    pub timestamp: String,
}

fn current_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn offset_limit_to_page(offset: usize, page_size: usize) -> usize {
    if page_size == 0 {
        1
    } else {
        offset / page_size + 1
    }
}

pub fn build_data_envelope<T: Serialize>(data: T, request_id: &str) -> ApiDataEnvelope<T> {
    ApiDataEnvelope {
        data,
        meta: ApiMeta {
            version: BIRDCODER_CODING_SERVER_API_VERSION,
        },
        request_id: request_id.to_owned(),
        timestamp: current_timestamp(),
    }
}

pub fn build_list_envelope<T: Serialize>(
    items: Vec<T>,
    total: usize,
    request_id: &str,
) -> ApiListEnvelope<T> {
    let page_size = items.len().max(1);
    build_offset_list_envelope(items, 0, page_size, total, request_id)
}

pub fn build_offset_list_envelope<T: Serialize>(
    items: Vec<T>,
    offset: usize,
    page_size: usize,
    total: usize,
    request_id: &str,
) -> ApiListEnvelope<T> {
    ApiListEnvelope {
        items,
        meta: ApiListMeta {
            page: offset_limit_to_page(offset, page_size),
            page_size,
            total,
            version: BIRDCODER_CODING_SERVER_API_VERSION,
        },
        request_id: request_id.to_owned(),
        timestamp: current_timestamp(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_envelope_uses_items_and_meta_fields() {
        let envelope = build_offset_list_envelope(
            vec!["alpha".to_owned()],
            20,
            20,
            41,
            "req-list-envelope",
        );
        let json = serde_json::to_value(envelope).expect("serialize list envelope");
        assert_eq!(json["items"][0], "alpha");
        assert_eq!(json["meta"]["page"], 2);
        assert_eq!(json["meta"]["pageSize"], 20);
        assert_eq!(json["meta"]["total"], 41);
        assert_eq!(json["meta"]["version"], "v1");
        assert_eq!(json["requestId"], "req-list-envelope");
        assert!(json["timestamp"].is_string());
    }

    #[test]
    fn data_envelope_uses_data_and_meta_fields() {
        let envelope = build_data_envelope(serde_json::json!({ "id": "session-1" }), "req-data-envelope");
        let json = serde_json::to_value(envelope).expect("serialize data envelope");
        assert_eq!(json["data"]["id"], "session-1");
        assert_eq!(json["meta"]["version"], "v1");
        assert_eq!(json["requestId"], "req-data-envelope");
        assert!(json["timestamp"].is_string());
    }
}
