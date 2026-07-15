use std::{
    collections::BTreeMap,
    env,
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    session_id_targets_engine, standard_native_session_provider_registry,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord,
};

const NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS: u128 = 10_000;
const NATIVE_SESSION_CATALOG_ENVIRONMENT_KEYS: &[&str] = &[
    "BIRDCODER_CODEENGINE_HOME",
    "BIRDCODER_CODEENGINE_SDK_BRIDGE_HOME",
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
    "GEMINI_CLI_HOME",
    "GEMINI_HOME",
    "HOME",
    "OPENCODE_SERVER_URL",
    "USERPROFILE",
];

#[derive(Clone)]
struct CachedNativeProviderSessionSnapshot {
    environment_signature: String,
    refreshed_at_millis: u128,
    sessions: Vec<CodeEngineSessionSummaryRecord>,
}

#[derive(Clone)]
struct CachedNativeProviderFailure {
    environment_signature: String,
    refreshed_at_millis: u128,
    error: String,
}

#[derive(Default)]
struct NativeSessionCatalogCache {
    failures: BTreeMap<String, CachedNativeProviderFailure>,
    providers: BTreeMap<String, CachedNativeProviderSessionSnapshot>,
}

struct CachedNativeProviderRead {
    sessions: Vec<CodeEngineSessionSummaryRecord>,
    stale_error: Option<String>,
}

static NATIVE_SESSION_CATALOG_CACHE: OnceLock<Mutex<NativeSessionCatalogCache>> = OnceLock::new();

pub fn list_codeengine_native_session_summaries(
    engine_id: Option<&str>,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let registry = standard_native_session_provider_registry();
    let providers = registry.resolve_provider(engine_id)?;
    let environment_signature = native_session_catalog_environment_signature();
    // Keep the cache lock while a stale provider snapshot is refreshed. Native
    // project hydration fans out several scoped HTTP reads concurrently; a
    // single refresh owner prevents every project from rescanning the same
    // provider histories at startup or on one Show more click.
    let mut cache = native_session_catalog_cache()
        .lock()
        .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
    let now_millis = current_system_millis();
    let mut sessions = Vec::new();
    let mut provider_errors = Vec::new();
    for provider in providers {
        let provider_id = provider.registration().engine_id.as_str();
        match resolve_cached_native_provider_sessions(
            &mut cache,
            provider_id,
            environment_signature.as_str(),
            now_millis,
            || provider.list_sessions(),
        ) {
            Ok(provider_read) => {
                if let Some(error) = provider_read.stale_error {
                    tracing::warn!(
                        provider_id,
                        error = %error,
                        "native session provider refresh failed; retaining its last successful snapshot"
                    );
                }
                sessions.extend(provider_read.sessions);
            }
            Err(error) => {
                provider_errors.push(format!("{provider_id}: {error}"));
                tracing::warn!(
                    provider_id,
                    error = %error,
                    "native session provider inventory is temporarily unavailable"
                );
            }
        }
    }
    if !provider_errors.is_empty() {
        return Err(format!(
            "failed to build a complete native session inventory: {}",
            provider_errors.join("; ")
        ));
    }
    sessions.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(sessions)
}

fn native_session_catalog_cache() -> &'static Mutex<NativeSessionCatalogCache> {
    NATIVE_SESSION_CATALOG_CACHE.get_or_init(|| Mutex::new(NativeSessionCatalogCache::default()))
}

fn current_system_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn native_session_catalog_environment_signature() -> String {
    let mut signature = String::new();
    for key in NATIVE_SESSION_CATALOG_ENVIRONMENT_KEYS {
        let value = env::var_os(key)
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default();
        signature.push_str(key);
        signature.push('=');
        signature.push_str(value.len().to_string().as_str());
        signature.push(':');
        signature.push_str(value.as_str());
        signature.push(';');
    }
    signature
}

fn resolve_cached_native_provider_sessions(
    cache: &mut NativeSessionCatalogCache,
    provider_id: &str,
    environment_signature: &str,
    now_millis: u128,
    load: impl FnOnce() -> Result<Vec<CodeEngineSessionSummaryRecord>, String>,
) -> Result<CachedNativeProviderRead, String> {
    if let Some(failure) = cache.failures.get(provider_id).filter(|failure| {
        failure.environment_signature == environment_signature
            && now_millis.saturating_sub(failure.refreshed_at_millis)
                <= NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS
    }) {
        return Err(failure.error.clone());
    }

    let stale_sessions = cache
        .providers
        .get(provider_id)
        .filter(|snapshot| snapshot.environment_signature == environment_signature)
        .map(|snapshot| snapshot.sessions.clone());
    if let Some(snapshot) = cache.providers.get(provider_id).filter(|snapshot| {
        snapshot.environment_signature == environment_signature
            && now_millis.saturating_sub(snapshot.refreshed_at_millis)
                <= NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS
    }) {
        return Ok(CachedNativeProviderRead {
            sessions: snapshot.sessions.clone(),
            stale_error: None,
        });
    }

    match load() {
        Ok(sessions) => {
            cache.failures.remove(provider_id);
            cache.providers.insert(
                provider_id.to_owned(),
                CachedNativeProviderSessionSnapshot {
                    environment_signature: environment_signature.to_owned(),
                    refreshed_at_millis: now_millis,
                    sessions: sessions.clone(),
                },
            );
            Ok(CachedNativeProviderRead {
                sessions,
                stale_error: None,
            })
        }
        Err(error) => {
            if let Some(sessions) = stale_sessions {
                if let Some(snapshot) = cache.providers.get_mut(provider_id).filter(|snapshot| {
                    snapshot.environment_signature == environment_signature
                }) {
                    // Back off repeated provider retries for the same TTL
                    // window while retaining the last complete snapshot.
                    snapshot.refreshed_at_millis = now_millis;
                }
                return Ok(CachedNativeProviderRead {
                    sessions,
                    stale_error: Some(error),
                });
            }
            cache.failures.insert(
                provider_id.to_owned(),
                CachedNativeProviderFailure {
                    environment_signature: environment_signature.to_owned(),
                    refreshed_at_millis: now_millis,
                    error: error.clone(),
                },
            );
            Err(error)
        }
    }
}

pub fn get_codeengine_native_session_detail(
    session_id: &str,
    engine_id: Option<&str>,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let registry = standard_native_session_provider_registry();
    if let Some(engine_id) = engine_id.filter(|value| !value.trim().is_empty()) {
        let providers = registry.resolve_provider(Some(engine_id))?;
        if let Some(provider) = providers.first() {
            return provider.get_session(session_id);
        }
    }

    for provider in registry.resolve_provider(None)? {
        if !session_id_targets_engine(session_id, provider.registration().engine_id.as_str()) {
            continue;
        }
        if let Some(detail) = provider.get_session(session_id)? {
            return Ok(Some(detail));
        }
    }
    Ok(None)
}

pub fn get_codeengine_native_session_summary(
    session_id: &str,
    engine_id: Option<&str>,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    Ok(get_codeengine_native_session_detail(session_id, engine_id)?.map(|detail| detail.summary))
}

#[cfg(test)]
mod tests {
    use super::{
        resolve_cached_native_provider_sessions, NativeSessionCatalogCache,
        NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS,
    };
    use crate::CodeEngineSessionSummaryRecord;

    #[test]
    fn provider_catalog_reuses_fresh_snapshot_and_retains_stale_snapshot_on_error() {
        let mut cache = NativeSessionCatalogCache::default();
        let mut loads = 0usize;
        let first = resolve_cached_native_provider_sessions(
            &mut cache,
            "codex",
            "environment-a",
            100,
            || {
                loads += 1;
                Ok(vec![summary("session-1", 10)])
            },
        )
        .expect("initial provider snapshot");
        assert_eq!(first.sessions.len(), 1);
        assert!(first.stale_error.is_none());

        let cached = resolve_cached_native_provider_sessions(
            &mut cache,
            "codex",
            "environment-a",
            101,
            || {
                loads += 1;
                Err("fresh cache must skip this loader".to_owned())
            },
        )
        .expect("fresh provider snapshot");
        assert_eq!(loads, 1);
        assert_eq!(cached.sessions[0].id, "session-1");
        assert!(cached.stale_error.is_none());

        let stale = resolve_cached_native_provider_sessions(
            &mut cache,
            "codex",
            "environment-a",
            101 + NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS,
            || {
                loads += 1;
                Err("temporary provider failure".to_owned())
            },
        )
        .expect("stale provider fallback");
        assert_eq!(loads, 2);
        assert_eq!(stale.sessions[0].id, "session-1");
        assert_eq!(
            stale.stale_error.as_deref(),
            Some("temporary provider failure")
        );

        let backed_off = resolve_cached_native_provider_sessions(
            &mut cache,
            "codex",
            "environment-a",
            102 + NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS,
            || {
                loads += 1;
                Err("stale retry must be throttled".to_owned())
            },
        )
        .expect("provider retry backoff snapshot");
        assert_eq!(loads, 2);
        assert_eq!(backed_off.sessions[0].id, "session-1");
        assert!(backed_off.stale_error.is_none());
    }

    #[test]
    fn provider_catalog_does_not_reuse_snapshot_from_another_environment() {
        let mut cache = NativeSessionCatalogCache::default();
        resolve_cached_native_provider_sessions(&mut cache, "gemini", "environment-a", 100, || {
            Ok(vec![summary("session-a", 10)])
        })
        .expect("initial Gemini provider snapshot");

        let error = resolve_cached_native_provider_sessions(
            &mut cache,
            "gemini",
            "environment-b",
            101,
            || Err("new environment is unavailable".to_owned()),
        )
        .err()
        .expect("changed environment must not reuse stale provider data");
        assert_eq!(error, "new environment is unavailable");
    }

    #[test]
    fn provider_catalog_throttles_repeated_failures_without_a_snapshot() {
        let mut cache = NativeSessionCatalogCache::default();
        let mut loads = 0usize;
        for now_millis in [100, 101] {
            let error = resolve_cached_native_provider_sessions(
                &mut cache,
                "claude-code",
                "environment-a",
                now_millis,
                || {
                    loads += 1;
                    Err("provider unavailable".to_owned())
                },
            )
            .err()
            .expect("provider failure");
            assert_eq!(error, "provider unavailable");
        }
        assert_eq!(loads, 1);
    }

    fn summary(id: &str, sort_timestamp: i64) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T00:00:00Z".to_owned(),
            id: id.to_owned(),
            title: id.to_owned(),
            status: "completed".to_owned(),
            runtime_status: Some("completed".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5".to_owned(),
            updated_at: "2026-07-15T00:00:00Z".to_owned(),
            last_turn_at: Some("2026-07-15T00:00:00Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some("E:/project".to_owned()),
            sort_timestamp,
            transcript_updated_at: Some("2026-07-15T00:00:00Z".to_owned()),
            workspace_id: None,
            project_id: None,
            native_attributes: Default::default(),
        }
    }
}
