use std::{
    collections::BTreeMap,
    env,
    sync::{Arc, Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    session_id_targets_engine, standard_native_session_provider_registry,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin,
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
    refresh_gates: BTreeMap<String, Arc<Mutex<()>>>,
}

struct CachedNativeProviderRead {
    sessions: Vec<CodeEngineSessionSummaryRecord>,
    stale_error: Option<String>,
}

enum CachedNativeProviderCacheState {
    Fresh(CachedNativeProviderRead),
    Refresh {
        stale_sessions: Option<Vec<CodeEngineSessionSummaryRecord>>,
    },
}

static NATIVE_SESSION_CATALOG_CACHE: OnceLock<Mutex<NativeSessionCatalogCache>> = OnceLock::new();

pub fn list_codeengine_native_session_summaries(
    engine_id: Option<&str>,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let registry = standard_native_session_provider_registry();
    let providers = registry.resolve_provider(engine_id)?;
    let is_explicit_provider_request = matches!(engine_id, Some(value) if !value.trim().is_empty());
    let environment_signature = native_session_catalog_environment_signature();
    list_native_session_summaries_from_providers(
        native_session_catalog_cache(),
        providers.as_slice(),
        is_explicit_provider_request,
        environment_signature.as_str(),
        current_system_millis(),
    )
}

fn list_native_session_summaries_from_providers(
    cache: &Mutex<NativeSessionCatalogCache>,
    providers: &[&dyn NativeSessionProviderPlugin],
    is_explicit_provider_request: bool,
    environment_signature: &str,
    now_millis: u128,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let mut sessions = Vec::new();
    for provider in providers {
        let provider_id = provider.registration().engine_id.as_str();
        match resolve_cached_native_provider_sessions(
            cache,
            provider_id,
            environment_signature,
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
                tracing::warn!(
                    provider_id,
                    error = %error,
                    "native session provider inventory is temporarily unavailable"
                );
                if is_explicit_provider_request {
                    return Err(format!(
                        "failed to list native sessions for provider \"{provider_id}\": {error}"
                    ));
                }
            }
        }
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
    cache: &Mutex<NativeSessionCatalogCache>,
    provider_id: &str,
    environment_signature: &str,
    now_millis: u128,
    load: impl FnOnce() -> Result<Vec<CodeEngineSessionSummaryRecord>, String>,
) -> Result<CachedNativeProviderRead, String> {
    let refresh_gate = native_session_provider_refresh_gate(cache, provider_id)?;
    // This gate serializes only one Provider's refresh. The global catalog
    // mutex is released before calling the external Provider implementation.
    let _refresh_guard = refresh_gate
        .lock()
        .map_err(|_| "lock native session provider refresh gate failed.".to_owned())?;
    let cache_state = {
        let cache = cache
            .lock()
            .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
        inspect_cached_native_provider_sessions(
            &cache,
            provider_id,
            environment_signature,
            now_millis,
        )?
    };
    let stale_sessions = match cache_state {
        CachedNativeProviderCacheState::Fresh(provider_read) => return Ok(provider_read),
        CachedNativeProviderCacheState::Refresh { stale_sessions } => stale_sessions,
    };

    // Provider I/O deliberately happens after the global cache guard above is
    // dropped. A slow or unavailable provider must not block unrelated cache
    // hits or Provider refreshes.
    match load() {
        Ok(sessions) => {
            let mut cache = cache
                .lock()
                .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
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
                let mut cache = cache
                    .lock()
                    .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
                if let Some(snapshot) = cache
                    .providers
                    .get_mut(provider_id)
                    .filter(|snapshot| snapshot.environment_signature == environment_signature)
                {
                    // Back off repeated provider retries for the same TTL
                    // window while retaining the last complete snapshot.
                    snapshot.refreshed_at_millis = now_millis;
                }
                cache.failures.remove(provider_id);
                return Ok(CachedNativeProviderRead {
                    sessions,
                    stale_error: Some(error),
                });
            }
            let mut cache = cache
                .lock()
                .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
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

fn native_session_provider_refresh_gate(
    cache: &Mutex<NativeSessionCatalogCache>,
    provider_id: &str,
) -> Result<Arc<Mutex<()>>, String> {
    let mut cache = cache
        .lock()
        .map_err(|_| "lock native session catalog cache failed.".to_owned())?;
    Ok(cache
        .refresh_gates
        .entry(provider_id.to_owned())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone())
}

fn inspect_cached_native_provider_sessions(
    cache: &NativeSessionCatalogCache,
    provider_id: &str,
    environment_signature: &str,
    now_millis: u128,
) -> Result<CachedNativeProviderCacheState, String> {
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
        return Ok(CachedNativeProviderCacheState::Fresh(
            CachedNativeProviderRead {
                sessions: snapshot.sessions.clone(),
                stale_error: None,
            },
        ));
    }

    Ok(CachedNativeProviderCacheState::Refresh { stale_sessions })
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
        list_native_session_summaries_from_providers, resolve_cached_native_provider_sessions,
        NativeSessionCatalogCache, NATIVE_SESSION_CATALOG_CACHE_TTL_MILLIS,
    };
    use crate::{
        known_standard_provider_registration, CodeEngineSessionDetailRecord,
        CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin,
        NativeSessionProviderRegistration,
    };
    use std::sync::Mutex;

    #[test]
    fn provider_catalog_reuses_fresh_snapshot_and_retains_stale_snapshot_on_error() {
        let cache = Mutex::new(NativeSessionCatalogCache::default());
        let mut loads = 0usize;
        let first =
            resolve_cached_native_provider_sessions(&cache, "codex", "environment-a", 100, || {
                assert!(
                    cache.try_lock().is_ok(),
                    "provider I/O must not hold the global catalog cache mutex"
                );
                loads += 1;
                Ok(vec![summary("session-1", 10)])
            })
            .expect("initial provider snapshot");
        assert_eq!(first.sessions.len(), 1);
        assert!(first.stale_error.is_none());

        let cached =
            resolve_cached_native_provider_sessions(&cache, "codex", "environment-a", 101, || {
                loads += 1;
                Err("fresh cache must skip this loader".to_owned())
            })
            .expect("fresh provider snapshot");
        assert_eq!(loads, 1);
        assert_eq!(cached.sessions[0].id, "session-1");
        assert!(cached.stale_error.is_none());

        let stale = resolve_cached_native_provider_sessions(
            &cache,
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
            &cache,
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
        let cache = Mutex::new(NativeSessionCatalogCache::default());
        resolve_cached_native_provider_sessions(&cache, "gemini", "environment-a", 100, || {
            Ok(vec![summary("session-a", 10)])
        })
        .expect("initial Gemini provider snapshot");

        let error =
            resolve_cached_native_provider_sessions(&cache, "gemini", "environment-b", 101, || {
                Err("new environment is unavailable".to_owned())
            })
            .err()
            .expect("changed environment must not reuse stale provider data");
        assert_eq!(error, "new environment is unavailable");
    }

    #[test]
    fn provider_catalog_throttles_repeated_failures_without_a_snapshot() {
        let cache = Mutex::new(NativeSessionCatalogCache::default());
        let mut loads = 0usize;
        for now_millis in [100, 101] {
            let error = resolve_cached_native_provider_sessions(
                &cache,
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

    #[test]
    fn global_provider_inventory_keeps_successful_results_when_another_provider_fails() {
        let cache = Mutex::new(NativeSessionCatalogCache::default());
        let unavailable_provider = TestNativeSessionProvider {
            registration: known_standard_provider_registration("claude-code"),
            list_result: Err("Claude history is unavailable".to_owned()),
        };
        let successful_provider = TestNativeSessionProvider {
            registration: known_standard_provider_registration("gemini"),
            list_result: Ok(vec![summary("session-z", 20), summary("session-a", 20)]),
        };
        let providers: [&dyn NativeSessionProviderPlugin; 2] =
            [&unavailable_provider, &successful_provider];

        let sessions = list_native_session_summaries_from_providers(
            &cache,
            &providers,
            false,
            "environment-a",
            100,
        )
        .expect("global inventory should retain successful provider sessions");

        let ids = sessions
            .iter()
            .map(|session| session.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(ids, vec!["session-a", "session-z"]);
    }

    #[test]
    fn explicit_provider_inventory_surfaces_that_provider_failure() {
        let cache = Mutex::new(NativeSessionCatalogCache::default());
        let unavailable_provider = TestNativeSessionProvider {
            registration: known_standard_provider_registration("opencode"),
            list_result: Err("OpenCode service is unavailable".to_owned()),
        };
        let providers: [&dyn NativeSessionProviderPlugin; 1] = [&unavailable_provider];

        let error = list_native_session_summaries_from_providers(
            &cache,
            &providers,
            true,
            "environment-a",
            100,
        )
        .expect_err("explicit Provider inventory must surface the Provider failure");

        assert!(error.contains("opencode"));
        assert!(error.contains("OpenCode service is unavailable"));
    }

    struct TestNativeSessionProvider {
        registration: &'static NativeSessionProviderRegistration,
        list_result: Result<Vec<CodeEngineSessionSummaryRecord>, String>,
    }

    impl NativeSessionProviderPlugin for TestNativeSessionProvider {
        fn registration(&self) -> &'static NativeSessionProviderRegistration {
            self.registration
        }

        fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
            self.list_result.clone()
        }

        fn get_session(
            &self,
            _session_id: &str,
        ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
            Ok(None)
        }
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
