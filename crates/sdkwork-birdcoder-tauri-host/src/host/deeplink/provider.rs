//! Provider channel import: writes a confirmed deep link import into the
//! client-local user model configuration store.
//!
//! The imported channel is written straight into the same store the
//! Settings → Model Access panel edits, as a `UserModelChannel` of the
//! requested kind (`official` / `relay` / `custom`) plus its API key. The
//! channel is created without engine bindings; the user binds it to Agent
//! engines in Settings → Model Access.

use sdkwork_models_user_config_repository_sqlx::{
    UserModelApiKey, UserModelChannel, UserModelChannelModel, UserModelChannelOffering,
    UserModelConfigStore,
};

use super::catalog::fetch_vendor_catalog;
use super::parser::{validate_provider_import_request, DeepLinkImportRequest, SUPPORTED_KINDS};
use super::super::user_model_config::initialize_user_model_config_store;
use super::vendors::vendor_display_name;
use super::DeepLinkImportSnapshot;

/// Monotonic sequence making channel codes unique even for imports processed
/// within the same millisecond (one deep link event can carry several URLs).
static CHANNEL_CODE_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

pub async fn import_provider_from_request(
    request: &DeepLinkImportRequest,
) -> Result<DeepLinkImportSnapshot, String> {
    // Re-validate: the confirm dialog is the consent surface, but the import
    // command is reachable from the webview with arbitrary payloads.
    validate_provider_import_request(request)?;

    let code = channel_code_for(&request.name, &request.kind);
    // Vendors and models come from the gateway itself when the link carries
    // the OpenAI-compatible base URL: the key-scoped `/v1/vendors` endpoint
    // returns exactly what the key can reach, and those offerings (with
    // their models) are written straight into the channel — no vendor
    // selection needed at link time. When the link has no base URL or the
    // query fails, fall back to the legacy `vendor` parameters, then to a
    // bare channel. Either way the channel is usable right away or after a
    // manual vendor pick in Settings → Model Access.
    let offerings = match resolve_offerings_from_gateway(request).await {
        Some(offerings) if !offerings.is_empty() => offerings,
        _ => legacy_offerings_from_vendor_codes(&request.vendors),
    };
    let channel = UserModelChannel {
        code: code.clone(),
        name: request.name.clone(),
        kind: request.kind.clone(),
        base_url: request.endpoint.clone(),
        description: provider_import_description(&request.kind),
        default_vendor_code: offerings
            .first()
            .map(|offering| offering.vendor_code.clone())
            .unwrap_or_default(),
        default_model_id: request.model.clone(),
        api_key_configured: true,
        sort_order: None,
        offerings,
    };
    import_channel(&channel, &request.api_key).await?;
    Ok(DeepLinkImportSnapshot {
        code,
        name: channel.name.clone(),
        kind: channel.kind.clone(),
        message: format!(
            "Imported {kind} channel \"{name}\" from deep link. It can be bound to Agent engines in Settings → Model Access.",
            kind = channel.kind,
            name = channel.name,
        ),
    })
}

fn provider_import_description(kind: &str) -> String {
    match kind {
        "official" => "Official channel imported via deep link".to_owned(),
        "custom" => "Custom channel imported via deep link".to_owned(),
        _ => "Imported from Cloud Router via deep link".to_owned(),
    }
}

/// Queries the gateway's key-scoped vendor catalog (`GET {base}/vendors`)
/// and maps it to channel offerings. Returns None when the link has no
/// `modelsBaseUrl` or the query fails (non-2xx, network, unparseable) so the
/// import can fall back instead of aborting.
async fn resolve_offerings_from_gateway(
    request: &DeepLinkImportRequest,
) -> Option<Vec<UserModelChannelOffering>> {
    if request.models_base_url.trim().is_empty() {
        return None;
    }
    let entries = fetch_vendor_catalog(&request.models_base_url, &request.api_key)
        .await
        .ok()
        .filter(|entries| !entries.is_empty())?;
    Some(
        entries
            .into_iter()
            .map(|entry| UserModelChannelOffering {
                vendor_code: entry.code,
                vendor_name: entry.name,
                models: entry
                    .models
                    .into_iter()
                    .map(|model| UserModelChannelModel {
                        model_id: model.id,
                        display_name: model.display_name,
                        context_tokens: model.context_tokens,
                        max_output_tokens: model.max_output_tokens,
                        tool_call_rounds: None,
                        supports_multimodal: false,
                    })
                    .collect(),
            })
            .collect(),
    )
}

/// Legacy fallback: one bare offering per link-carried vendor code, without
/// models. Kept for links that still carry `vendor` parameters.
fn legacy_offerings_from_vendor_codes(vendors: &[String]) -> Vec<UserModelChannelOffering> {
    vendors
        .iter()
        .map(|vendor_code| UserModelChannelOffering {
            vendor_code: vendor_code.clone(),
            vendor_name: vendor_display_name(vendor_code),
            models: Vec::new(),
        })
        .collect()
}

async fn import_channel(channel: &UserModelChannel, api_key: &str) -> Result<(), String> {
    let store = initialize_user_model_config_store().await?;
    store
        .upsert_channel(channel)
        .await
        .map_err(|error| error.to_string())?;
    if let Err(error) = store
        .upsert_api_key(&UserModelApiKey {
            channel_code: channel.code.clone(),
            api_key: api_key.to_owned(),
        })
        .await
    {
        // Compensate: a channel marked as key-configured without its API key
        // is a half-imported state, so roll the channel back instead of
        // leaving a broken entry the Settings panel would show.
        let _ = store.delete_channel(&channel.code).await;
        return Err(error.to_string());
    }
    Ok(())
}

/// Channel code derived from the display name, the channel kind and a
/// millisecond timestamp (`{kind}-{slug}-{timestamp}-{sequence}`), mirroring
/// the CC Switch deep link import (`{sanitized_name}-{timestamp}`): every
/// import gets a unique code so re-importing the same provider creates a new
/// channel instead of silently overwriting an existing one.
fn channel_code_for(name: &str, kind: &str) -> String {
    let prefix = if SUPPORTED_KINDS.contains(&kind) {
        kind
    } else {
        "relay"
    };
    let mut slug = String::new();
    for ch in name.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
        } else if !slug.is_empty() && !slug.ends_with('-') {
            slug.push('-');
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        slug.push_str("cloud-router");
    }
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let sequence = CHANNEL_CODE_SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("{prefix}-{slug}-{timestamp}-{sequence}")
}

#[cfg(test)]
mod tests {
    use super::{channel_code_for, import_provider_from_request};
    use crate::host::deeplink::parser::{
        parse_deeplink_url, DeepLinkImportRequest, SUPPORTED_APPS, SUPPORTED_KINDS,
    };
    use sdkwork_models_user_config_repository_sqlx::{
        UserModelChannelModel, UserModelChannelOffering, UserModelConfigStore,
    };
    use tauri::Url;

    /// Mock Cloud Router gateway: `GET /v1/vendors` answers only when the
    /// Bearer key matches, mirroring the real endpoint's key scoping.
    async fn mock_gateway() -> String {
        use axum::http::{header, HeaderValue};
        use axum::response::IntoResponse;
        let app = axum::Router::new().route(
            "/v1/vendors",
            axum::routing::get(|headers: axum::http::HeaderMap| async move {
                if headers.get(header::AUTHORIZATION)
                    == Some(&HeaderValue::from_static("Bearer sk-gateway-key"))
                {
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
                } else {
                    (axum::http::StatusCode::UNAUTHORIZED, "unauthorized").into_response()
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{address}/v1")
    }

    fn sample_request(kind: &str) -> DeepLinkImportRequest {
        let url = Url::parse(&format!(
            "birdcoder://v1/import?resource=provider&kind={kind}&app=codex&name=Cloud%20Router&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-test-123&model=gpt-5"
        ))
        .unwrap();
        parse_deeplink_url(&url).unwrap()
    }

    #[test]
    fn slugifies_channel_code_with_kind_prefix() {
        // Every import is unique (timestamp + monotonic sequence suffix),
        // mirroring cc-switch's `{sanitized_name}-{timestamp}` provider id so
        // re-imports never overwrite an existing channel.
        assert!(channel_code_for("Cloud Router Relay", "relay").starts_with("relay-cloud-router-relay-"));
        assert!(channel_code_for("My Official", "official").starts_with("official-my-official-"));
        assert!(channel_code_for("My Custom", "custom").starts_with("custom-my-custom-"));
        assert!(channel_code_for("---", "relay").starts_with("relay-cloud-router-"));
        assert!(channel_code_for("My_API 站点", "relay").starts_with("relay-my-api-"));
        assert!(channel_code_for("Unknown Kind", "proxy").starts_with("relay-unknown-kind-"));
        assert_ne!(channel_code_for("Cloud Router", "relay"), channel_code_for("Cloud Router", "relay"));
    }

    #[test]
    fn imports_provider_channels_and_rejects_tampered_requests() {
        // Single test owning the store: the store is once-initialized from
        // `SDKWORK_USER_MODEL_CONFIG_SQLITE_URL`, so only one test may set it
        // and run imports. Uses a throwaway client-local database.
        let dir = std::env::temp_dir().join(format!(
            "birdcoder-deeplink-import-test-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let database_url = format!("sqlite:{}", dir.join("test-user-config.sqlite3").display());
        std::env::set_var("SDKWORK_USER_MODEL_CONFIG_SQLITE_URL", &database_url);

        // Every supported kind imports with its own code prefix.
        let mut expected = Vec::new();
        for kind in SUPPORTED_KINDS {
            let request = sample_request(kind);
            let snapshot = tauri::async_runtime::block_on(import_provider_from_request(&request))
                .expect("provider import should succeed");
            assert_eq!(snapshot.kind, *kind);
            assert!(snapshot.code.starts_with(&format!("{kind}-cloud-router-")), "{}", snapshot.code);
            expected.push(snapshot);
        }

        let store = tauri::async_runtime::block_on(
            crate::host::user_model_config::initialize_user_model_config_store_for_tests(),
        )
        .expect("store should initialize");
        let channels = tauri::async_runtime::block_on(store.list_channels()).expect("list channels");
        assert_eq!(channels.len(), SUPPORTED_KINDS.len(), "one imported channel per kind");
        for snapshot in &expected {
            let channel = channels.iter().find(|channel| channel.code == snapshot.code).expect("imported channel present");
            assert_eq!(channel.kind, snapshot.kind);
            assert_eq!(channel.name, "Cloud Router");
            assert_eq!(channel.base_url, "https://gateway.example.com");
            assert_eq!(channel.default_model_id, "gpt-5");
            assert!(channel.api_key_configured);
            let api_key = tauri::async_runtime::block_on(store.get_api_key(&channel.code))
                .expect("read api key")
                .expect("imported channel has an api key");
            assert_eq!(api_key, "sk-test-123");
        }

        // A link carrying vendor selections imports a channel with one
        // offering per vendor and the first vendor as the default; unknown
        // vendor codes fall back to the code as the display name.
        let vendor_request = parse_deeplink_url(&Url::parse(
            "birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=Multi%20Vendor&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-test-123&vendor=openai&vendor=deepseek&vendor=unknown-vendor",
        ).unwrap())
        .expect("vendor link should parse");
        let vendor_snapshot =
            tauri::async_runtime::block_on(import_provider_from_request(&vendor_request))
                .expect("vendor import should succeed");
        let channels = tauri::async_runtime::block_on(store.list_channels()).expect("list channels");
        let vendor_channel = channels
            .iter()
            .find(|channel| channel.code == vendor_snapshot.code)
            .expect("vendor channel present");
        assert_eq!(vendor_channel.default_vendor_code, "openai");
        assert_eq!(
            vendor_channel.offerings,
            vec![
                UserModelChannelOffering {
                    vendor_code: "openai".to_owned(),
                    vendor_name: "OpenAI".to_owned(),
                    models: Vec::new(),
                },
                UserModelChannelOffering {
                    vendor_code: "deepseek".to_owned(),
                    vendor_name: "DeepSeek".to_owned(),
                    models: Vec::new(),
                },
                UserModelChannelOffering {
                    vendor_code: "unknown-vendor".to_owned(),
                    vendor_name: "unknown-vendor".to_owned(),
                    models: Vec::new(),
                },
            ]
        );
        // Links without vendors keep importing bare channels.
        let bare_request = sample_request("relay");
        let bare_snapshot =
            tauri::async_runtime::block_on(import_provider_from_request(&bare_request))
                .expect("bare import should succeed");
        let channels = tauri::async_runtime::block_on(store.list_channels()).expect("list channels");
        let bare_channel = channels
            .iter()
            .find(|channel| channel.code == bare_snapshot.code)
            .expect("bare channel present");
        assert_eq!(bare_channel.default_vendor_code, "");
        assert!(bare_channel.offerings.is_empty());

        // A link carrying the gateway base URL imports offerings resolved
        // from the gateway's key-scoped `/v1/vendors` endpoint (mocked by a
        // local axum server): vendors with their models are written into the
        // channel and the first vendor becomes the default.
        let gateway_base = tauri::async_runtime::block_on(mock_gateway());
        let gateway_request = parse_deeplink_url(&Url::parse(&format!(
            "birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=Gateway%20Channel&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-gateway-key&modelsBaseUrl={gateway_base}"
        )).unwrap())
        .expect("gateway link should parse");
        let gateway_snapshot =
            tauri::async_runtime::block_on(import_provider_from_request(&gateway_request))
                .expect("gateway import should succeed");
        let channels = tauri::async_runtime::block_on(store.list_channels()).expect("list channels");
        let gateway_channel = channels
            .iter()
            .find(|channel| channel.code == gateway_snapshot.code)
            .expect("gateway channel present");
        assert_eq!(gateway_channel.default_vendor_code, "openai");
        assert_eq!(gateway_channel.offerings.len(), 2);
        let openai_offering = gateway_channel
            .offerings
            .iter()
            .find(|offering| offering.vendor_code == "openai")
            .expect("openai offering present");
        assert_eq!(openai_offering.vendor_name, "OpenAI");
        assert_eq!(
            openai_offering.models,
            vec![
                UserModelChannelModel {
                    model_id: "gpt-5.4".to_owned(),
                    display_name: "GPT-5.4".to_owned(),
                    context_tokens: Some(400_000),
                    max_output_tokens: Some(128_000),
                    tool_call_rounds: None,
                    supports_multimodal: false,
                },
                UserModelChannelModel {
                    model_id: "gpt-5.4-mini".to_owned(),
                    display_name: "GPT-5.4 Mini".to_owned(),
                    context_tokens: None,
                    max_output_tokens: None,
                    tool_call_rounds: None,
                    supports_multimodal: false,
                },
            ]
        );
        let anthropic_offering = gateway_channel
            .offerings
            .iter()
            .find(|offering| offering.vendor_code == "anthropic")
            .expect("anthropic offering present");
        assert_eq!(anthropic_offering.models.len(), 1);

        // When the gateway query fails (wrong key), the import falls back to
        // the legacy `vendor` parameters carried by the link instead of
        // aborting.
        let fallback_request = parse_deeplink_url(&Url::parse(&format!(
            "birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=Fallback%20Channel&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-wrong-key&modelsBaseUrl={gateway_base}&vendor=openai&vendor=deepseek"
        )).unwrap())
        .expect("fallback link should parse");
        let fallback_snapshot =
            tauri::async_runtime::block_on(import_provider_from_request(&fallback_request))
                .expect("fallback import should succeed");
        let channels = tauri::async_runtime::block_on(store.list_channels()).expect("list channels");
        let fallback_channel = channels
            .iter()
            .find(|channel| channel.code == fallback_snapshot.code)
            .expect("fallback channel present");
        assert_eq!(fallback_channel.default_vendor_code, "openai");
        assert_eq!(
            fallback_channel.offerings,
            vec![
                UserModelChannelOffering {
                    vendor_code: "openai".to_owned(),
                    vendor_name: "OpenAI".to_owned(),
                    models: Vec::new(),
                },
                UserModelChannelOffering {
                    vendor_code: "deepseek".to_owned(),
                    vendor_name: "DeepSeek".to_owned(),
                    models: Vec::new(),
                },
            ]
        );

        // The import handler must not trust webview-supplied payloads.
        let mut tampered = sample_request("relay");
        tampered.app = "notepad".to_owned();
        let error = tauri::async_runtime::block_on(import_provider_from_request(&tampered))
            .expect_err("tampered app must be rejected");
        assert!(error.contains("unsupported deep link app"), "{error}");
        let mut tampered = sample_request("relay");
        tampered.kind = "proxy".to_owned();
        assert!(tauri::async_runtime::block_on(import_provider_from_request(&tampered)).is_err());
        // Every CC Switch app value passes the whitelist.
        for app in SUPPORTED_APPS {
            let mut request = sample_request("relay");
            request.app = (*app).to_owned();
            assert!(tauri::async_runtime::block_on(import_provider_from_request(&request)).is_ok());
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
