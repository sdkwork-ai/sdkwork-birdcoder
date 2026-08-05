//! Birdcoder custom URL protocol ("deep link") handling.
//!
//! Birdcoder registers the `birdcoder://` scheme with the same `v1/import`
//! contract CC Switch uses (`ccswitch://v1/import?...`), so provider import
//! links generated for CC Switch work unchanged under the birdcoder scheme:
//!
//! ```text
//! birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=My%20Provider&endpoint=https%3A%2F%2F...&apiKey=sk-...
//! ```
//!
//! Supported query parameters (CC Switch compatible subset):
//! - `resource` (required): `provider` only for now; new link types plug in
//!   as new parser/import modules without touching the transport wiring
//! - `kind` (optional, default `relay`): `official` / `relay` / `custom` —
//!   the three channel kinds of the model configuration store
//! - `app` (required): `claude` / `codex` / `gemini` / `opencode` / ... (CC
//!   Switch app whitelist; Birdcoder unifies model configuration, so the
//!   value only needs to pass validation)
//! - `name` (required): display name of the imported channel
//! - `endpoint` (required): HTTP(S) API endpoint
//! - `apiKey` (required): API key stored alongside the channel
//! - `model` (optional): default model id
//! - `modelsBaseUrl` (optional): gateway OpenAI-compatible base URL
//!   (`{host}/v1`). During the import the host queries the Cloud Router
//!   `GET {base}/vendors` extension with the same API key and writes the
//!   reachable vendors and their models straight into the channel offerings
//!   — no vendor selection needed in the producing console. Links without it
//!   (or when the query fails) fall back to the legacy `vendor` parameters,
//!   then to a channel without offerings.
//! - `vendor` (optional, repeatable): legacy vendor codes; used only when the
//!   gateway catalog query is unavailable.
//!
//! The host parses every URL into a [`DeepLinkImportRequest`] and never
//! writes anything on its own: the request is buffered (for cold start) and
//! emitted to the webview, which shows a confirmation dialog — the consent
//! surface for untrusted links. Only after the user confirms does the
//! webview invoke `deeplink_import_from_request`, which re-validates the
//! payload and writes the channel plus API key straight into the client-local
//! user model config store (the same store the Settings → Model Access panel
//! edits). Note the link carries a plaintext API key, matching the CC Switch
//! standard; it is only ever written after the OS hands the URL to Birdcoder
//! (explicit user action) and the user confirms the dialog.

use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

use super::user_model_config::apply_client_local_user_model_config_database_url;
pub use parser::{parse_deeplink_url, DeepLinkImportRequest};
use provider::import_provider_from_request;

mod catalog;
mod parser;
mod provider;
mod vendors;

pub const DEEPLINK_SCHEME: &str = "birdcoder";
/// Webview event carrying a parsed [`DeepLinkImportRequest`] that awaits
/// user confirmation.
pub const DEEPLINK_IMPORT_EVENT: &str = "deep-link-import";
/// Webview event carrying a [`DeepLinkErrorSnapshot`] for unparseable links.
pub const DEEPLINK_ERROR_EVENT: &str = "deep-link-error";

/// Result of a confirmed deep link import, returned by the
/// `deeplink_import_from_request` command and acknowledged as a toast.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkImportSnapshot {
    pub code: String,
    pub name: String,
    pub kind: String,
    pub message: String,
}

/// Parse failure surfaced to the webview via [`DEEPLINK_ERROR_EVENT`].
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkErrorSnapshot {
    pub url: String,
    pub error: String,
}

/// Pending requests that arrived before the webview mounted (cold start).
/// The shell drains this on mount; warm-start requests are delivered by
/// [`DEEPLINK_IMPORT_EVENT`] and never land here, so nothing is surfaced
/// twice.
static PENDING_IMPORT_REQUESTS: OnceLock<Mutex<VecDeque<DeepLinkImportRequest>>> =
    OnceLock::new();

/// Upper bound on buffered cold-start import requests. Any local process can
/// hand the OS arbitrary `birdcoder://` URLs (Windows URL scheme handlers do
/// not prompt), so without a cap a flood of links would grow this buffer
/// without limit. When the buffer is full the oldest request is dropped so
/// the newest arrival stays observable.
const MAX_PENDING_IMPORT_REQUESTS: usize = 64;

fn lock_pending_requests() -> std::sync::MutexGuard<'static, VecDeque<DeepLinkImportRequest>> {
    PENDING_IMPORT_REQUESTS
        .get_or_init(|| Mutex::new(VecDeque::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Buffers a parsed import request for the cold-start drain, bounded by
/// [`MAX_PENDING_IMPORT_REQUESTS`].
fn buffer_pending_import_request(request: DeepLinkImportRequest) {
    let mut pending = lock_pending_requests();
    if pending.len() >= MAX_PENDING_IMPORT_REQUESTS {
        pending.pop_front();
    }
    pending.push_back(request);
}

/// Registers the desktop URL protocol listener and replays any deep link that
/// launched the app. Desktop-only protocol registration (runtime
/// `register_all` plus installer integration through `tauri.conf.json`).
///
/// Registration is best-effort: failures are logged, never fatal — a locked
/// registry or a missing desktop entry must not prevent the app from
/// starting. Import failures are still surfaced to the webview via the
/// `deep-link-import` / `deep-link-error` events.
pub fn setup_deeplink_handling(app: &AppHandle) -> Result<(), String> {
    let handler_app = app.clone();
    // `on_open_url` returns the listener id; the listener lives for the whole
    // app lifetime and must not be dropped.
    let _listener_id = app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            handle_deeplink_url(&handler_app, &url);
        }
    });

    // Replay a deep link that launched the app. `get_current` is a
    // diagnostic read; a failure here is logged and startup continues so the
    // deep-link setup can never take the whole application down.
    match app.deep_link().get_current() {
        Ok(Some(urls)) => {
            for url in urls {
                handle_deeplink_url(app, &url);
            }
        }
        Ok(None) => {}
        Err(error) => {
            eprintln!(
                "failed to read current {DEEPLINK_SCHEME} deep link: {error}; continuing without replay"
            );
        }
    }

    // Runtime protocol registration (Windows registry / Linux desktop entry)
    // is best-effort: deep links must never take the whole application down.
    // The packaged installer re-registers the scheme at install time, and a
    // failure here (for example a locked registry key) only degrades deep
    // link availability, so it is logged instead of aborting startup.
    //
    // Note: this crate does not run `tauri_build::build()` (no tauri.conf.json
    // of its own), so the tauri custom `cfg(desktop)` would never be set here
    // and the whole block would be compiled out — the standard target cfgs
    // are used instead (desktop = windows / linux / macos).
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
    if let Err(error) = app.deep_link().register_all() {
        eprintln!("failed to register {DEEPLINK_SCHEME} URL protocol: {error}; deep links will be unavailable");
    }

    Ok(())
}

fn handle_deeplink_url(app: &AppHandle, url: &Url) {
    focus_main_window(app);
    match parse_deeplink_url(url) {
        Ok(request) => {
            // Buffer before emitting: on cold start the webview listener is
            // not mounted yet and would miss the event; the shell drains the
            // pending requests once on mount. Deduplication between the two
            // delivery paths happens in the shell (per-arrival `id`).
            buffer_pending_import_request(request.clone());
            let _ = app.emit(DEEPLINK_IMPORT_EVENT, &request);
        }
        Err(error) => {
            let snapshot = DeepLinkErrorSnapshot {
                url: redact_deeplink_url(url),
                error,
            };
            let _ = app.emit(DEEPLINK_ERROR_EVENT, &snapshot);
        }
    }
}

/// Removes credential-bearing query values (apiKey and friends) from a deep
/// link before it is surfaced to the webview, so a parse failure never leaks
/// a plaintext API key through the error event.
fn redact_deeplink_url(url: &Url) -> String {
    const REDACTED_QUERY_KEYS: &[&str] = &["apiKey", "api_key", "token", "accessToken", "secret"];
    let pairs = url
        .query_pairs()
        .map(|(key, value)| {
            let key_string = key.to_string();
            let redacted = REDACTED_QUERY_KEYS
                .iter()
                .any(|candidate| key_string.eq_ignore_ascii_case(candidate));
            (
                key_string,
                if redacted {
                    "[redacted]".to_string()
                } else {
                    value.to_string()
                },
            )
        })
        .collect::<Vec<_>>();
    let mut redacted = url.clone();
    redacted.set_query(None);
    {
        let mut query_pairs = redacted.query_pairs_mut();
        for (key, value) in pairs {
            query_pairs.append_pair(&key, &value);
        }
    }
    redacted.to_string()
}

/// Returns every deep link import request that arrived before the webview
/// mounted (cold start), clearing the buffer. Invoked by the shell on mount;
/// requests that arrive later are delivered via [`DEEPLINK_IMPORT_EVENT`].
pub fn deeplink_drain_pending_import_requests() -> Vec<DeepLinkImportRequest> {
    lock_pending_requests().drain(..).collect()
}

/// Writes a user-confirmed deep link import into the client-local model
/// config store. The confirm dialog is the consent surface, but this command
/// is reachable from the webview with arbitrary payloads, so each resource
/// handler re-validates the request before writing.
pub async fn deeplink_import_from_request(
    app: &AppHandle,
    request: DeepLinkImportRequest,
) -> Result<DeepLinkImportSnapshot, String> {
    // Resolve the client-local user model config database URL before any
    // write (idempotent; the embedded gateway applies the same URL later).
    apply_client_local_user_model_config_database_url(app)?;
    match request.resource.as_str() {
        "provider" => import_provider_from_request(&request).await,
        resource => Err(format!("unsupported deep link resource \"{resource}\"")),
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::{
        buffer_pending_import_request, deeplink_drain_pending_import_requests,
        lock_pending_requests, redact_deeplink_url, MAX_PENDING_IMPORT_REQUESTS,
    };
    use crate::host::deeplink::parser::{parse_deeplink_url, DeepLinkImportRequest};
    use tauri::Url;

    fn sample_request() -> DeepLinkImportRequest {
        let url = Url::parse(
            "birdcoder://v1/import?resource=provider&app=claude&name=X&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-test",
        )
        .unwrap();
        parse_deeplink_url(&url).unwrap()
    }

    #[test]
    fn drain_returns_and_clears_pending_requests() {
        // The shell drains the buffer once on mount; the drain must clear it
        // so a re-mount (React strict mode) or a later event never shows the
        // same arrival twice.
        let first = sample_request();
        let second = sample_request();
        assert_ne!(first.id, second.id, "every arrival gets a distinct id");
        lock_pending_requests().push_back(first.clone());
        lock_pending_requests().push_back(second.clone());
        let drained = deeplink_drain_pending_import_requests();
        assert_eq!(drained.len(), 2);
        assert_eq!(drained[0].id, first.id);
        assert_eq!(drained[1].id, second.id);
        assert!(deeplink_drain_pending_import_requests().is_empty(), "buffer is cleared after drain");
    }

    #[test]
    fn pending_buffer_is_bounded_and_drops_oldest() {
        // A flood of cold-start links must never grow the buffer without
        // limit; the oldest request is dropped so the newest stays visible.
        let requests = (0..(MAX_PENDING_IMPORT_REQUESTS + 16))
            .map(|_| sample_request())
            .collect::<Vec<_>>();
        for request in &requests {
            buffer_pending_import_request(request.clone());
        }
        let drained = deeplink_drain_pending_import_requests();
        assert_eq!(drained.len(), MAX_PENDING_IMPORT_REQUESTS);
        assert_eq!(
            drained.first().map(|request| request.id.as_str()),
            requests
                .iter()
                .skip(16)
                .next()
                .map(|request| request.id.as_str()),
            "the 16 oldest requests must have been dropped"
        );
        assert_eq!(
            drained.last().map(|request| request.id.as_str()),
            requests.last().map(|request| request.id.as_str()),
            "the newest request must be retained"
        );
    }

    #[test]
    fn error_snapshot_redacts_credential_query_values() {
        let url = Url::parse(
            "birdcoder://v1/import?resource=provider&app=claude&name=X&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-secret-123&token=abc",
        )
        .unwrap();
        let redacted = redact_deeplink_url(&url);
        assert!(!redacted.contains("sk-secret-123"), "apiKey value must be redacted");
        assert!(!redacted.contains("abc"), "token value must be redacted");
        // The marker is URL-encoded in the serialized query ([redacted] ->
        // %5Bredacted%5D); decode the query back before asserting.
        let decoded_query = urlencoding_decode_query(&redacted);
        assert!(
            decoded_query.contains("[redacted]"),
            "redaction marker must be present: {redacted}"
        );
        assert!(redacted.contains("api.example.com"), "non-credential query values survive");
    }

    /// Minimal percent-decoding for the redaction test query only.
    fn urlencoding_decode_query(value: &str) -> String {
        let Some(query) = value.split_once('?').map(|(_, query)| query) else {
            return value.to_string();
        };
        query
            .split('&')
            .filter_map(|pair| {
                let (key, value) = pair.split_once('=')?;
                Some(format!("{key}={}", percent_decode(value)))
            })
            .collect::<Vec<_>>()
            .join("&")
    }

    fn percent_decode(value: &str) -> String {
        let bytes = value.as_bytes();
        let mut output = Vec::with_capacity(bytes.len());
        let mut index = 0;
        while index < bytes.len() {
            if bytes[index] == b'%' && index + 3 <= bytes.len() {
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).ok();
                if let Some(hex) = hex {
                    if let Ok(decoded) = u8::from_str_radix(hex, 16) {
                        output.push(decoded);
                        index += 3;
                        continue;
                    }
                }
            }
            output.push(bytes[index]);
            index += 1;
        }
        String::from_utf8_lossy(&output).to_string()
    }
}
