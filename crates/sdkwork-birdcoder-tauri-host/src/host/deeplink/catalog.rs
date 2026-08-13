//! Key-scoped vendor/model catalog fetch from the Cloud Router gateway.
//!
//! Import links carry the gateway's OpenAI-compatible base URL
//! (`modelsBaseUrl`). During the import the host queries the Cloud Router
//! `GET {base}/vendors` extension with the same API key; the response lists
//! the vendors the key can actually reach, each with its models. The import
//! writes those offerings straight into the channel, so no vendor selection
//! is needed at link time and the Settings → Model Access panel shows
//! usable vendors and models right away.

use serde::Deserialize;
use std::time::Duration;

/// Wall-clock budget for the gateway vendor catalog fetch so a hung or
/// malicious gateway can never pin the import task indefinitely.
const VENDOR_CATALOG_FETCH_TIMEOUT: Duration = Duration::from_secs(10);
/// Upper bound on the vendor catalog response body so a malicious gateway can
/// never force the host to materialize an unbounded payload (OOM guard).
const VENDOR_CATALOG_MAX_RESPONSE_BYTES: u64 = 2 * 1024 * 1024;

/// One vendor entry fetched from the gateway.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VendorCatalogEntry {
    pub code: String,
    pub name: String,
    pub models: Vec<VendorCatalogModel>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VendorCatalogModel {
    pub id: String,
    pub display_name: String,
    pub context_tokens: Option<i64>,
    pub max_output_tokens: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VendorCatalogPayload {
    data: Vec<VendorPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VendorPayload {
    code: String,
    name: Option<String>,
    #[serde(default)]
    models: Vec<VendorModelPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VendorModelPayload {
    id: String,
    display_name: Option<String>,
    context_tokens: Option<i64>,
    max_output_tokens: Option<i64>,
}

/// Rejects link-local and cloud-metadata targets for the outbound vendor
/// catalog fetch while keeping loopback reachable (local self-hosted
/// gateways are a supported import target). Literal IPv4/6 addresses in
/// reserved metadata ranges must never receive the caller's API key.
fn reject_link_local_target(base_url: &str) -> Result<(), String> {
    let parsed = tauri::Url::parse(base_url)
        .map_err(|_| "gateway vendor catalog base URL is invalid".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("gateway vendor catalog base URL must use http or https".to_string());
    }
    // `host_str` keeps the brackets for IPv6 hosts; strip them before the
    // reserved-address checks. An unbracketed IPv6 literal does not parse as
    // a URL host and is rejected by the parse above.
    let host = parsed
        .host_str()
        .ok_or_else(|| "gateway vendor catalog base URL must include a host".to_string())?
        .trim_start_matches('[')
        .trim_end_matches(']');
    if host.eq_ignore_ascii_case("0.0.0.0") || host.eq_ignore_ascii_case("::") {
        return Err("gateway vendor catalog target is a reserved address".to_string());
    }
    let octets: Vec<u8> = host
        .split('.')
        .filter_map(|part| part.parse::<u8>().ok())
        .collect();
    if octets.len() == 4 && octets[0] == 169 && octets[1] == 254 {
        // 169.254.0.0/16 includes the cloud metadata endpoint 169.254.169.254.
        return Err("gateway vendor catalog target is a link-local address".to_string());
    }
    if host.to_ascii_lowercase().starts_with("fe80:") {
        return Err("gateway vendor catalog target is a link-local address".to_string());
    }
    Ok(())
}

/// Fetches the vendor catalog the gateway key can reach. Non-2xx responses
/// and unparseable bodies fail so the import can fall back to the legacy
/// `vendor` parameters instead of importing a silently empty channel.
pub async fn fetch_vendor_catalog(
    models_base_url: &str,
    api_key: &str,
) -> Result<Vec<VendorCatalogEntry>, String> {
    let base_url = models_base_url.trim().trim_end_matches('/');
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err("gateway vendor catalog base URL must use http or https".to_string());
    }
    reject_link_local_target(base_url)?;
    let url = format!("{base_url}/vendors");
    // The gateway is the user's own relay (often local/self-hosted); bypass
    // the system proxy so the request always reaches the configured host.
    // The overall fetch is wall-clock bounded and the response body is
    // streamed under a hard byte cap.
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(VENDOR_CATALOG_FETCH_TIMEOUT)
        .build()
        .map_err(|error| format!("failed to build gateway http client: {error}"))?;
    let mut response = client
        .get(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .send()
        .await
        .map_err(|error| format!("failed to query gateway vendor catalog: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "gateway vendor catalog query failed with status {}",
            response.status()
        ));
    }
    let mut body = Vec::new();
    loop {
        let chunk = response
            .chunk()
            .await
            .map_err(|error| format!("failed to read gateway vendor catalog response: {error}"))?;
        let Some(chunk) = chunk else {
            break;
        };
        if body.len() + chunk.len() > VENDOR_CATALOG_MAX_RESPONSE_BYTES as usize {
            return Err("gateway vendor catalog response exceeds the size limit".to_string());
        }
        body.extend_from_slice(&chunk);
    }
    let payload: VendorCatalogPayload = serde_json::from_slice(&body)
        .map_err(|error| format!("gateway vendor catalog response is invalid: {error}"))?;
    let mut entries = Vec::new();
    for vendor in payload.data {
        let code = vendor.code.trim().to_lowercase();
        if code.is_empty() {
            continue;
        }
        let models = vendor
            .models
            .into_iter()
            .filter(|model| !model.id.trim().is_empty())
            .map(|model| VendorCatalogModel {
                id: model.id,
                display_name: model.display_name.unwrap_or_default(),
                context_tokens: model.context_tokens,
                max_output_tokens: model.max_output_tokens,
            })
            .collect();
        let name = vendor
            .name
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| code.clone());
        entries.push(VendorCatalogEntry { code, name, models });
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::{fetch_vendor_catalog, VendorCatalogEntry, VendorCatalogModel};
    use axum::http::{header, HeaderValue, StatusCode};
    use axum::response::{IntoResponse, Response};
    use axum::routing::get;
    use axum::Router;
    use tokio::net::TcpListener;

    fn vendor_response() -> Response {
        axum::response::Json(serde_json::json!({
            "object": "list",
            "data": [
                {
                    "code": "openai",
                    "name": "OpenAI",
                    "models": [
                        {
                            "id": "gpt-5.4",
                            "displayName": "GPT-5.4",
                            "contextTokens": 400000,
                            "maxOutputTokens": 128000
                        },
                        { "id": "gpt-5.4-mini", "displayName": "GPT-5.4 Mini" }
                    ]
                },
                {
                    "code": "anthropic",
                    "name": "Anthropic",
                    "models": [
                        { "id": "claude-fable-5", "displayName": "Claude Fable 5" }
                    ]
                }
            ]
        }))
        .into_response()
    }

    fn error_response() -> Response {
        (StatusCode::UNAUTHORIZED, "unauthorized").into_response()
    }

    async fn mock_gateway(handler: fn() -> Response) -> String {
        let app = Router::new()
            .route(
                "/v1/vendors",
                get(move |headers: axum::http::HeaderMap| async move {
                    match headers.get(header::AUTHORIZATION) {
                        Some(value) if value == HeaderValue::from_static("Bearer sk-gateway-key") => {
                            handler()
                        }
                        _ => error_response(),
                    }
                }),
            )
            .route(
                "/healthz",
                get(|| async { "ok" }),
            );
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{address}/v1")
    }

    fn expected_entries() -> Vec<VendorCatalogEntry> {
        vec![
            VendorCatalogEntry {
                code: "openai".to_owned(),
                name: "OpenAI".to_owned(),
                models: vec![
                    VendorCatalogModel {
                        id: "gpt-5.4".to_owned(),
                        display_name: "GPT-5.4".to_owned(),
                        context_tokens: Some(400_000),
                        max_output_tokens: Some(128_000),
                    },
                    VendorCatalogModel {
                        id: "gpt-5.4-mini".to_owned(),
                        display_name: "GPT-5.4 Mini".to_owned(),
                        context_tokens: None,
                        max_output_tokens: None,
                    },
                ],
            },
            VendorCatalogEntry {
                code: "anthropic".to_owned(),
                name: "Anthropic".to_owned(),
                models: vec![VendorCatalogModel {
                    id: "claude-fable-5".to_owned(),
                    display_name: "Claude Fable 5".to_owned(),
                    context_tokens: None,
                    max_output_tokens: None,
                }],
            },
        ]
    }

    #[test]
    fn rejects_link_local_and_reserved_catalog_targets() {
        use super::reject_link_local_target;
        for url in [
            "http://169.254.169.254/latest/meta-data",
            "http://169.254.1.1/vendors",
            "http://0.0.0.0/vendors",
            "http://[fe80::1]/vendors",
            "http://fe80::1/vendors",
        ] {
            assert!(
                reject_link_local_target(url).is_err(),
                "link-local/reserved target must be rejected: {url}"
            );
        }
        for url in [
            "http://127.0.0.1:8080",
            "http://localhost:8080",
            "https://gateway.example.com",
            "http://192.168.1.10:3000",
            "http://10.0.0.5:8080",
        ] {
            assert!(
                reject_link_local_target(url).is_ok(),
                "loopback/private/public target must be allowed: {url}"
            );
        }
        // A non-URL string is invalid and must fail closed, never reach a
        // fetch target.
        assert!(reject_link_local_target("not-a-url").is_err());
    }

    #[test]
    fn parses_vendor_catalog_response_shape() {
        let payload: super::VendorCatalogPayload =
            serde_json::from_value(serde_json::json!({
                "object": "list",
                "data": [{
                    "code": "openai",
                    "name": "OpenAI",
                    "models": [{
                        "id": "gpt-5.4",
                        "displayName": "GPT-5.4",
                        "contextTokens": 400000,
                        "maxOutputTokens": 128000
                    }]
                }]
            }))
            .expect("camelCase payload should parse");
        assert_eq!(payload.data.len(), 1);
        assert_eq!(payload.data[0].code, "openai");
        assert_eq!(payload.data[0].models[0].context_tokens, Some(400_000));
    }

    #[tokio::test]
    async fn fetches_and_parses_gateway_vendor_catalog() {
        let base = mock_gateway(vendor_response).await;
        let entries = fetch_vendor_catalog(&base, "sk-gateway-key").await.expect("fetch");
        assert_eq!(entries, expected_entries());
    }

    #[tokio::test]
    async fn rejects_wrong_api_key_and_non_success_status() {
        let base = mock_gateway(vendor_response).await;
        let error = fetch_vendor_catalog(&base, "sk-wrong-key").await.unwrap_err();
        assert!(error.contains("status 401"), "{error}");
    }

    #[tokio::test]
    async fn rejects_unreachable_gateway() {
        let error = fetch_vendor_catalog("http://127.0.0.1:1", "sk-gateway-key")
            .await
            .unwrap_err();
        assert!(error.contains("failed to query"), "{error}");
    }

    #[tokio::test]
    async fn drops_unknown_fields_and_empty_entries() {
        let base = mock_gateway(|| {
            axum::response::Json(serde_json::json!({
                "object": "list",
                "data": [
                    {
                        "code": " openai ",
                        "name": "",
                        "models": [{ "id": "gpt-5.4", "displayName": null, "extraField": 1 }]
                    },
                    { "code": "", "name": "Empty", "models": [] }
                ]
            }))
            .into_response()
        })
        .await;
        let entries = fetch_vendor_catalog(&base, "sk-gateway-key").await.expect("fetch");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].code, "openai");
        // Empty display name falls back to the code; unknown fields ignored.
        assert_eq!(entries[0].name, "openai");
        assert_eq!(entries[0].models[0].display_name, "");
    }
}
