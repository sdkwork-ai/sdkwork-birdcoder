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

mod parser;
mod provider;

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

fn lock_pending_requests() -> std::sync::MutexGuard<'static, VecDeque<DeepLinkImportRequest>> {
    PENDING_IMPORT_REQUESTS
        .get_or_init(|| Mutex::new(VecDeque::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
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
            lock_pending_requests().push_back(request.clone());
            let _ = app.emit(DEEPLINK_IMPORT_EVENT, &request);
        }
        Err(error) => {
            let snapshot = DeepLinkErrorSnapshot {
                url: url.to_string(),
                error,
            };
            let _ = app.emit(DEEPLINK_ERROR_EVENT, &snapshot);
        }
    }
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
    use super::{deeplink_drain_pending_import_requests, lock_pending_requests};
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
}
