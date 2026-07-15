# Engine SDK Integration

This document describes the current BirdCoder engine boundary. It is normative for the
desktop session inventory path; provider-specific protocol details remain owned by the
corresponding provider adapter and SDKWork kernel contracts.

## Ownership

| Layer | Responsibility |
| --- | --- |
| `sdkwork-kernel` and `sdkwork-agents` | Agent execution, provider SDK negotiation, model turns, and streaming |
| `sdkwork-birdcoder-codeengine` | Engine catalog, provider-specific dialects, and native session/thread discovery |
| `sdkwork-birdcoder-tauri-host` | Authorized desktop filesystem boundary and local native-session read commands |
| `sdkwork-birdcoder-pc-infrastructure` | Injected app-runtime read services and generated BirdCoder app SDK consumption |
| `sdkwork-birdcoder-pc-commons` | Project-scoped session inventory merge, deduplication, ordering, and pagination |
| `sdkwork-birdcoder-standalone-gateway` | Authenticated app-api routes for remote and embedded server deployments |

Agent turn execution must not be added to `sdkwork-birdcoder-codeengine`; it remains on
the approved kernel bridge/runtime-facade boundary.

## Native Session Semantics

BirdCoder calls the provider-native conversation a `coding session` at the app contract
boundary. For Codex, the native identity is a Codex **thread**. The adapter exposes the
thread as a `BirdCoderNativeSessionSummary` using the stable provider-scoped id
`codex-native:<thread-id>` and preserves the provider working directory in `nativeCwd`.

Codex discovery is performed by the Rust Codex provider adapter from the local Codex
state/rollout catalog under `CODEX_HOME`. The adapter parses summaries without loading
message bodies for list requests and loads the transcript only for a detail request.
This is the native-session catalog boundary, not a second BirdCoder persistence store.

Provider summaries are filtered to the currently mounted project root before they cross
the native boundary. A session is accepted only when its recorded `cwd` equals the
authorized root or is a descendant of it. Missing roots, missing `cwd`, path traversal,
and unresolvable mounts fail closed.

## Desktop Read Path

Opening a local folder creates a device-local mount. The renderer never sends the native
absolute path through the public app-api. The desktop path is:

```text
folder mount
  -> ProjectDeviceMountRegistry
  -> Tauri authorized filesystem root
  -> desktop_native_session_list / desktop_native_session_get
  -> sdkwork-birdcoder-codeengine provider catalog
  -> injected IAppRuntimeReadService native-session port
  -> project-scoped workbench inventory
```

Both Tauri commands execute on a blocking worker. The host validates the requested root
against the registered filesystem-root allow-list before the provider catalog is read.
The list command uses offset pagination with `page_size` semantics (default `20`, maximum
`200`) and returns the same `items` plus `pageInfo` shape as the generated app SDK.

When no authorized desktop mount exists, the injected port returns `null` and the service
falls back to the authenticated generated app SDK. This preserves browser, private
remote, and cloud deployments without leaking local paths into HTTP requests.

## App SDK Contract

The public operations are:

- `runtime.nativeSessions.list`
- `runtime.nativeSessions.retrieve`

Both operations require `workspaceId` and `projectId`. The server already enforced this
scope, so the OpenAPI authority and generated SDK now express the same requirement.
List consumers request one bounded page at a time and carry the returned `pageInfo`.
No UI path downloads an unbounded native-session collection or paginates by slicing a
fully downloaded array.

## Remote And Embedded Server Path

The authenticated Rust route remains available for remote and embedded gateway modes:

```text
GET /app/v3/api/native_sessions
  -> native session scope authorization
  -> project-root resolution
  -> native provider registry
  -> provider cwd filtering
  -> SDKWork response envelope
```

The server route and the Tauri local port share the same native summary identity and
project-scope rules. The server never trusts a renderer-supplied filesystem path.

## Verification

The session boundary is covered by:

- `scripts/tauri-native-session-composition-contract.test.ts`
- `scripts/project-session-authority-synchronization-contract.test.ts`
- `scripts/app-runtime-selected-session-transcript-performance-contract.test.ts`
- `cargo test -p sdkwork-birdcoder-tauri-host`
- `cargo test -p sdkwork-birdcoder-codeengine`
- `pnpm generate:sdk:birdcoder`
- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`

Any future provider that adds native inventory must implement the same provider-scoped
identity, authorized cwd filtering, bounded page contract, summary/detail split, and
injected app-runtime port. Provider SDK DTOs must not escape the adapter boundary.
