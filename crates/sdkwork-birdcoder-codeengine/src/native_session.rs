use crate::native_session_provider_catalog_entries;
use crate::NativeSessionProviderRegistration;

pub fn standard_native_session_provider_registrations(
) -> &'static [NativeSessionProviderRegistration] {
    native_session_provider_catalog_entries()
}

pub fn lookup_standard_native_session_provider_registration(
    engine_id: &str,
) -> Option<&'static NativeSessionProviderRegistration> {
    crate::find_native_session_provider_catalog_entry(engine_id)
}

pub fn resolved_native_session_provider_registration(
    engine_id: &str,
) -> Result<&'static NativeSessionProviderRegistration, String> {
    lookup_standard_native_session_provider_registration(engine_id)
        .ok_or_else(|| format_missing_native_session_provider_error(engine_id))
}

/// Returns the catalog registration for a built-in provider implementation.
///
/// When the embedded catalog is temporarily unavailable, this returns a
/// deterministic degraded registration instead of panicking so host startup
/// and contract tests remain structured.
pub fn known_standard_provider_registration(
    engine_id: &'static str,
) -> &'static NativeSessionProviderRegistration {
    if let Some(registration) = lookup_standard_native_session_provider_registration(engine_id) {
        return registration;
    }

    tracing::error!(
        engine_id,
        "native session provider catalog entry missing; using degraded registration"
    );
    degraded_provider_registration(engine_id)
}

fn degraded_provider_registration(
    engine_id: &'static str,
) -> &'static NativeSessionProviderRegistration {
    use std::sync::OnceLock;

    static CODEX: OnceLock<NativeSessionProviderRegistration> = OnceLock::new();
    static CLAUDE_CODE: OnceLock<NativeSessionProviderRegistration> = OnceLock::new();
    static GEMINI: OnceLock<NativeSessionProviderRegistration> = OnceLock::new();
    static OPENCODE: OnceLock<NativeSessionProviderRegistration> = OnceLock::new();

    match engine_id {
        "codex" => CODEX.get_or_init(|| build_degraded_provider_registration("codex")),
        "claude-code" => {
            CLAUDE_CODE.get_or_init(|| build_degraded_provider_registration("claude-code"))
        }
        "gemini" => GEMINI.get_or_init(|| build_degraded_provider_registration("gemini")),
        "opencode" => OPENCODE.get_or_init(|| build_degraded_provider_registration("opencode")),
        _ => {
            tracing::error!(
                engine_id,
                "unexpected standard provider id; using generic degraded registration"
            );
            static UNKNOWN: OnceLock<NativeSessionProviderRegistration> = OnceLock::new();
            UNKNOWN.get_or_init(|| build_degraded_provider_registration(engine_id))
        }
    }
}

fn build_degraded_provider_registration(engine_id: &str) -> NativeSessionProviderRegistration {
    use crate::NativeSessionDiscoveryMode;

    NativeSessionProviderRegistration {
        engine_id: engine_id.to_owned(),
        display_name: engine_id.to_owned(),
        native_session_id_prefix: format!("{engine_id}-native:"),
        transport_kinds: Vec::new(),
        discovery_mode: NativeSessionDiscoveryMode::ExplicitOnly,
    }
}

pub fn format_missing_native_session_provider_error(engine_id: &str) -> String {
    format!(
        "Native session provider for engine \"{engine_id}\" is not registered in the standard code engine provider registry."
    )
}

pub fn native_session_prefix_for_engine(engine_id: &str) -> Option<&'static str> {
    lookup_standard_native_session_provider_registration(engine_id)
        .map(|registration| registration.native_session_id_prefix.as_str())
}

pub fn resolve_native_session_engine_id(session_id: &str) -> Option<&'static str> {
    let normalized = session_id.trim();
    if normalized.is_empty() {
        return None;
    }

    standard_native_session_provider_registrations()
        .iter()
        .find_map(|registration| {
            normalized
                .strip_prefix(registration.native_session_id_prefix.as_str())
                .map(|_| registration.engine_id.as_str())
        })
}

pub fn is_authority_backed_native_session_id(session_id: &str) -> bool {
    resolve_native_session_engine_id(session_id).is_some()
}

pub fn build_native_session_id(_engine_id: &str, native_session_id: &str) -> String {
    let normalized = native_session_id.trim();
    if normalized.is_empty() {
        return String::new();
    }

    if let Some(resolved_engine_id) = resolve_native_session_engine_id(normalized) {
        if let Some(prefix) = native_session_prefix_for_engine(resolved_engine_id) {
            return normalized
                .strip_prefix(prefix)
                .unwrap_or(normalized)
                .trim()
                .to_owned();
        }
    }

    normalized.to_owned()
}

#[cfg(test)]
mod tests {
    use super::{build_native_session_id, resolve_native_session_engine_id};

    #[test]
    fn build_native_session_id_keeps_raw_provider_id() {
        assert_eq!(
            build_native_session_id("codex", "019dc9ed-5e34-7ac1-9176-746135cb324b"),
            "019dc9ed-5e34-7ac1-9176-746135cb324b"
        );
    }

    #[test]
    fn build_native_session_id_strips_legacy_provider_prefix() {
        assert_eq!(
            build_native_session_id("codex", "codex-native:legacy-session"),
            "legacy-session"
        );
    }

    #[test]
    fn build_native_session_id_strips_any_legacy_provider_prefix() {
        assert_eq!(
            build_native_session_id("codex", "opencode-native:legacy-session"),
            "legacy-session"
        );
    }

    #[test]
    fn resolve_native_session_engine_id_only_handles_legacy_prefixed_ids() {
        assert_eq!(
            resolve_native_session_engine_id("codex-native:legacy-session"),
            Some("codex")
        );
        assert_eq!(resolve_native_session_engine_id("legacy-session"), None);
    }
}
