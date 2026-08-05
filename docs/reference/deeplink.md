# Deep Link Protocol (`birdcoder://`)

Status: active
Owner: SDKWork maintainers
Updated: 2026-08-04

BirdCoder desktop registers the `birdcoder://` custom URL protocol. The
protocol implements the [CC Switch `v1/import`
contract](https://deepwiki.com/farion1231/cc-switch/11.2-deep-links-and-import)
so provider import links generated for CC Switch work unchanged under the
`birdcoder` scheme — only the scheme differs.

The CC Switch source tree is vendored at
[`external/cc-switch`](../../external/cc-switch) (git submodule) and is the
standard authority; its official protocol doc is
`external/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md` and its parser
is `external/cc-switch/src-tauri/src/deeplink/`.

## Registration

- Scheme: `birdcoder` (desktop only, Tauri `deep-link` plugin; see
  `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/tauri.conf.json`
  and the host `deeplink` module).
- **Single-instance requirement**: while the app is running, Windows delivers
  `birdcoder://` URLs as launch arguments of a second instance. The
  `tauri-plugin-single-instance` plugin (with its `deep-link` feature) must be
  registered **before** `tauri-plugin-deep-link` so the URL is forwarded to the
  primary process; without it, warm-start imports fail.
- **ACL**: the two deep link commands (`deeplink_drain_pending_import_requests`,
  `deeplink_import_from_request`) are declared in `permissions/default.toml`
  and granted in `capabilities/default.toml` (and `capabilities/test.toml`,
  same risk class as the `user_model_config_*` commands). The app enforces
  its ACL manifest, so an undeclared command is rejected by the webview.
- **WebView2 networking**: the window is created with
  `--proxy-bypass-list=127.0.0.1;localhost;<-loopback>` so a system proxy
  (Clash etc.) never intercepts the dev renderer or the embedded gateway.
  Note this does not cover VPN/proxy **TUN** modes, which hijack traffic at
  the network layer: with a TUN adapter enabled, WebView2 cannot reach
  `127.0.0.1` even though plain `curl` works. Disable TUN (or route loopback
  direct in the proxy rules) when the desktop app shows
  `ERR_CONNECTION_REFUSED` for the dev URL.

## Import Flow

Links are untrusted input; the confirmation dialog is the consent surface
(mirroring CC Switch's deeplink flow):

1. The host parses the URL into a `DeepLinkImportRequest` and emits it as the
   `deep-link-import` webview event — **nothing is written yet**. Unparseable
   links emit `deep-link-error` (`{url, error}`) and the shell shows a toast.
2. Cold start: links that launched the app arrive before the webview mounts;
   the host buffers them and the shell drains them once on mount via the
   `deeplink_drain_pending_import_requests` command. Warm-start requests are
   delivered purely by the event. Every arrival carries a host-generated
   `id`; the shell registers its listeners before draining and deduplicates
   by `id`, so a request racing the mount drain is still delivered by its
   event and never shown twice.
3. The shell shows a confirmation dialog (channel kind badge, name, endpoint,
   masked API key, default model) with cancel/confirm.
4. On confirm, the shell invokes `deeplink_import_from_request(request)`,
   which **re-validates every field** (the command is reachable from the
   webview with arbitrary payloads) and writes the channel plus API key into
   the client-local user model config store. The result is acknowledged as a
   toast; cancel writes nothing.

## Import Format

```
birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=<name>&endpoint=<url>&apiKey=<key>
```

Supported query parameters (CC Switch compatible subset):

| Parameter  | Required | Description |
| --- | --- | --- |
| `resource` | yes | `provider` only for now; unsupported resources are rejected with a clear message (new link types plug in as new parser/import modules) |
| `kind`     | no  | `official` / `relay` / `custom` — the three channel kinds of the model configuration store. Defaults to `relay`, so existing links without `kind` remain valid |
| `app`      | yes | `claude` / `claude-desktop` / `codex` / `gemini` / `grokbuild` / `opencode` / `openclaw` / `hermes` (full CC Switch contract set; Birdcoder unifies model configuration, so the value only needs to pass validation) |
| `name`     | yes | Display name of the imported channel |
| `endpoint` | yes | HTTP(S) API endpoint |
| `apiKey`   | yes | API key stored alongside the channel |
| `model`    | no  | Default model id |

Unknown query parameters (for example the CC Switch `usage*` / `config`
family) are ignored. All values must be URL-encoded (for example
`https://...` → `https%3A%2F%2F...`).

### Example

```
birdcoder://v1/import?resource=provider&kind=relay&app=claude&name=Cloud%20Router&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-xxx
birdcoder://v1/import?resource=provider&kind=official&app=codex&name=OpenAI%20Direct&endpoint=https%3A%2F%2Fapi.openai.com&apiKey=sk-xxx
birdcoder://v1/import?resource=provider&kind=custom&app=gemini&name=My%20Gateway&endpoint=https%3A%2F%2Fgateway.example.com&apiKey=sk-xxx
```

## Import Behavior

- After confirmation, the channel is written directly into the client-local
  user model config store (`birdcoder-user-config.sqlite3`, the same store
  the Settings → Model Access panel edits), as a `UserModelChannel` of the
  requested `kind` plus its `UserModelApiKey`.
- **Channel code uniqueness**: the code is `{kind}-{slug}-{timestamp}-{sequence}`
  (mirroring CC Switch's `{sanitized_name}-{timestamp}` provider id), so every
  import creates a new channel and re-importing the same provider never
  silently overwrites an existing channel. One deep link event may carry
  several URLs; each is imported independently.
- The channel is created without engine bindings; the user binds it to Agent
  engines in Settings → Model Access.
- The link carries a plaintext API key (matching the CC Switch standard) and
  is only processed after the OS hands the URL to BirdCoder — i.e. after an
  explicit user action in a browser — and the user confirms the dialog. Do
  not share import links in public places.

## Generating Links

- CC Switch: `ccswitch://v1/import?...` (same query contract).
- Cloud Router console: API Keys → quick import:
  - **CC Switch**: an app picker (Claude / Codex / Gemini / Grok Build /
    opencode / openclaw / Hermes) is shown first — CC Switch keeps a separate
    provider list per app — then the link is opened with the chosen `app`
    plus the usage-query configuration (`usageEnabled=true`,
    `usageBaseUrl`/`usageApiKey` pointing at the gateway's own balance
    endpoint and the matching `usageScript`), so the imported provider shows
    the Token Bank balance immediately.
  - **Claude Desktop**: CC Switch's released deep link parser rejects
    `app=claude-desktop` (the AppType exists, but the upstream `v1/import`
    whitelist does not include it), so the console does not generate that
    value. The official path is to import into Claude (Claude Code) first,
    then use "Import providers from Claude Code" in the CC Switch Claude
    Desktop panel to migrate in one click (see
    `external/cc-switch/docs/user-manual/zh/2-providers/2.6-claude-desktop.md`).
  - **Birdcoder**: imported directly without an app picker (model
    configuration is unified).
  - When the app is not detected, an install/manual-import fallback dialog is
    shown with a retry action.

## Development / Dev Mode

- The desktop dev flow is `pnpm dev:desktop` (root) or
  `pnpm --filter @sdkwork/birdcoder-pc-desktop start:desktop`; it runs
  `tauri dev` with the Vite renderer on `127.0.0.1:1520`. Plain `pnpm dev`
  defaults to the **browser** runtime target and does not start the desktop
  app at all.
- On first launch the app registers `birdcoder://` itself (runtime
  `register_all` writing `HKCU\Software\Classes\birdcoder`), so the scheme
  only exists after the app has been started once. Verify with
  `reg query "HKCU\Software\Classes\birdcoder\shell\open\command"` — it must
  point at the current dev binary (`target\debug\sdkwork-birdcoder-pc-desktop.exe`).
- **Closing the window does not exit the app**: the desktop lifecycle hides
  the window to the tray and keeps the process running. Clicking a
  `birdcoder://` link while the app is running forwards the URL to that
  instance, which re-shows the window (`focus_main_window`) — this looks like
  "the app was started again" but is the same process. Use the tray
  "退出" action (or an explicit exit) to fully quit.
- `start:desktop` runs `run-tauri-dev-binary-unlock.mjs` first, which kills
  any leftover dev instance so `tauri dev` can rebuild the exe. The script
  resolves the real dev binary (workspace-root `target/debug/` and the
  `sdkwork-birdcoder-pc-desktop` name) — if you still see "另一个程序正在使用此文件"
  during a dev build, a stale instance is holding the exe; stop it manually
  and re-run.
- Warm start (app already running): the link is forwarded to the running
  instance via the single-instance plugin's `deep-link` feature, the host
  parses and emits it, and the renderer shows the confirmation dialog.
- Cold start (app not running): Windows launches the dev binary directly via
  the registered command; the host replays the launch URL from the deep-link
  plugin's `get_current`. If the Vite renderer is not running (no
  `pnpm dev:desktop`), the dialog cannot appear and nothing is imported —
  start the renderer first, or just start `pnpm dev:desktop` and click the
  link again (warm start).
- Moving or rebuilding the workspace can leave the registered exe path stale;
  run the app once more to re-register it.

## Balance Query (Usage Script)

CC Switch supports balance/usage query via `usageScript` (Base64 JS) plus
`usageEnabled` / `usageApiKey` / `usageBaseUrl` / `usageAccessToken` /
`usageUserId` / `usageAutoInterval` deep link parameters.

**Cloud Router is the relay, so it answers balance itself**: the gateway
exposes `GET /v1/user/balance` (Bearer relay key auth), returning the key
owner's Token Bank wallet balance:

```json
{ "object": "balance", "balance": "1234", "frozen": "56", "unit": "TOKEN_BANK" }
```

The CC Switch import link ships a CC Switch "通用模板"-shaped `usageScript`
against that endpoint, so the balance shows up without script editing. The CC
Switch script contract is documented in
`external/cc-switch/docs/user-manual/zh/2-providers/2.5-usage-query.md` and
implemented in `external/cc-switch/src-tauri/src/usage_script.rs` (QuickJS
sandbox: 16 MiB memory / 256 KiB stack / 5 s timeout, same-origin HTTPS
request validation, `request` + `extractor(response)` script contract).

BirdCoder does not display balances yet; the deeplink import currently ignores
`usage*` parameters (client-local channel metadata has no usage fields yet).

