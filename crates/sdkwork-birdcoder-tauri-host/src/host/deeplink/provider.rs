//! Provider channel import: writes a confirmed deep link import into the
//! client-local user model configuration store.
//!
//! The imported channel is written straight into the same store the
//! Settings → Model Access panel edits, as a `UserModelChannel` of the
//! requested kind (`official` / `relay` / `custom`) plus its API key. The
//! channel is created without engine bindings; the user binds it to Agent
//! engines in Settings → Model Access.

use sdkwork_models_user_config_repository_sqlx::{
    UserModelApiKey, UserModelChannel, UserModelConfigStore,
};

use super::parser::{validate_provider_import_request, DeepLinkImportRequest, SUPPORTED_KINDS};
use super::super::user_model_config::initialize_user_model_config_store;
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
    let channel = UserModelChannel {
        code: code.clone(),
        name: request.name.clone(),
        kind: request.kind.clone(),
        base_url: request.endpoint.clone(),
        description: provider_import_description(&request.kind),
        default_vendor_code: String::new(),
        default_model_id: request.model.clone(),
        api_key_configured: true,
        sort_order: None,
        offerings: Vec::new(),
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
    use sdkwork_models_user_config_repository_sqlx::UserModelConfigStore;
    use tauri::Url;

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
            crate::host::user_model_config::initialize_user_model_config_store(),
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
