# Codex Protocol

## Baseline And Authority

- Repository: [openai/codex](https://github.com/openai/codex)
- Source commit: `a05bcda3dbd68729caa2f11027b7f43974fda298`
- Workspace crate version: `0.0.0` (source build; use the commit as the compatibility identity)
- App Server guide: [Codex App Server](https://developers.openai.com/codex/app-server)
- Primary local types: `external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts`
- Notification union: `external/codex/codex-rs/app-server-protocol/schema/typescript/ServerNotification.ts`
- Rust authority: `external/codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs`
- Raw rollout authority: `external/codex/codex-rs/protocol/src/protocol.rs` and `models.rs`
- Desktop reference build: Windows x64 `26.721.11231.0`
- Desktop renderer archive: `app/resources/app.asar`, SHA-256
  `23a8f5d1645247bd942304dc586c44b8ce63c2e3fc408198f815657731070db5`
- Executable parity matrix: `specs/codex-desktop-parity.spec.json`

### Verified Windows Installation

The installed reference was inspected on 2026-07-31. These values are the
immutable installation baseline; hashes from a user plugin cache are not used
as installation evidence.

| Layer | Verified value |
| --- | --- |
| Package | `OpenAI.Codex_26.721.11231.0_x64__2p2nqsd0c76g0` (`26.721.11231.0`), status `verified` |
| Desktop artifact | `app/resources/app.asar`, 209,375,503 bytes, SHA-256 `23a8f5d1645247bd942304dc586c44b8ce63c2e3fc408198f815657731070db5` |
| Renderer/plugin package | `26.721.81911` |
| Codex provider | `app/resources/codex.exe`, `0.146.0-alpha.3.1`, SHA-256 `39e9e041ea33ac34aad9578adfe660c5c7a6dc8f82620b77623960f9352a6ef3` |
| CUA runtime | `app/resources/cua_node/manifest.json`, Node `24.14.0`, SHA-256 `e8f2e647ccf0f5627ee2f9beda1f7ab5daac9dd716470132e167bb0c414e63e0` |
| Browser plugin | `app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json`, `26.721.81911`, SHA-256 `7066eec3cfc42e9990b471509ab3c1c7d1eaedcec550491e71a1d3962151acca` |
| Protocol source | commit `a05bcda3dbd68729caa2f11027b7f43974fda298`; `ThreadItem.ts` SHA-256 `57190566ac2ec5a64a595ecfb80fb8fe6900f29136d77944097e7b6a6f3acd38` |

The package identity, artifact path, size, and hashes are machine-checked by
the parity contract. The raw `ThreadItem` and provider `thread*` names above
are protocol evidence only; BirdCoder exposes canonical `Session` and the
opaque `providerSessionId`.

Feature-specific renderer evidence in the same archive is pinned separately:

| Capability evidence | Archive entry | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| Automations | `webview/assets/automations-page-CNlcT7yo.js` | `3bdf115c9fc72298d04510177a343ba8c6b3436a3f77f71abe5baf6c443affe7` | 84,851 |
| Browser | `webview/assets/browser-Be3Y5Oyc.js` | `dd35124bd1dc1d64f9206b5a5946175f2795ca88c7c9237c03b390bf11020839` | 651,835 |
| Browser settings | `webview/assets/browser-use-settings-52aGrZMW.js` | `c3b75cff167c750a2e22f531996fdb3e3ca7db593ec0a209903d5307c12d63e8` | 92,415 |
| Remote settings | `webview/assets/remote-connections-settings-DwcGEEux.js` | `30780436d7f6f0238b709a2fb85503a9ed4ea453dd6a83846412f82e7bcab2b7` | 158,510 |
| Remote continuation | `webview/assets/remote-conversation-page-DebkGSyJ.js` | `f3028786d1acead0b2622b97f8499b10044e639fa59fd79f5b560881d3e2658b` | 66,842 |

The source commit identifies the provider protocol baseline. The desktop build
and renderer hash identify the observable product baseline. A parity claim must
name both; matching the open protocol alone does not prove desktop UI parity.

## Transport

App Server uses JSON-RPC-shaped request, response, and notification objects over its transport, but intentionally omits the `jsonrpc` member.

```json
{"id":1,"method":"thread/read","params":{"threadId":"...","includeTurns":true}}
{"id":1,"result":{"thread":{}}}
{"method":"item/started","params":{"threadId":"...","turnId":"...","item":{}}}
```

Clients must correlate responses by `id`, route notifications by `method`, and tolerate newly added fields and item variants.

## Hierarchy And History

- Codex `Thread` is the provider's durable continuation and maps to one
  canonical Agents Session. It is not a BirdCoder domain type.
- Codex `Turn` maps to the canonical Agents Turn that groups one user
  submission and the resulting work.
- Codex `ThreadItem` maps to an ordered canonical Session Item.
- `thread/read` with `includeTurns: true` returns the durable thread and its turns.
- Experimental `thread/turns/list` and `thread/items/list` provide paginated history. Their cursor is opaque and must never be synthesized.
- The local provider adapter can also discover Codex threads from `~/.codex/state_5.sqlite` and reconstruct history from rollout JSONL.

The adapter may read exact Codex names such as `threadId`, but its
provider-neutral output must expose `providerSessionId`, Session identity, and
Session-named fields and commands. No Thread DTO, store, service, event, route,
or UI term may cross from this protocol boundary into BirdCoder.

The two identities have different lifecycles. The first successful provider
Turn writes the provider-returned `providerSessionId` onto the current Session
runtime binding. Every follow-up Turn resumes through that stored opaque value
while retaining the same canonical `sessionId`. Agents and Kernel must never
synthesize `providerSessionId` from `sessionId`; a changed provider identity on
an already-bound Session is a conflict, not an implicit remap.

The rollout reader must preserve all stable response items and selected durable lifecycle events. High-volume output deltas are not separate history messages; they update the corresponding item.

## Item Lifecycle

`item/started` contains the initial full item. Item-specific delta notifications update text, reasoning, command output, patches, and similar channels. `item/completed` contains the authoritative final full item. Consumers replace/merge by the item ID, not by array position.

Current `ThreadItem` variants include:

```text
userMessage, hookPrompt, agentMessage, plan, reasoning
commandExecution, fileChange, mcpToolCall, dynamicToolCall
collabAgentToolCall, subAgentActivity, webSearch, imageView
sleep, imageGeneration, enteredReviewMode, exitedReviewMode
contextCompaction
```

Exact durable variants at the pinned baseline:

| Variant | Stable identity/content | Presentation rule |
| --- | --- | --- |
| `userMessage` | `id`, optional `clientId`, ordered `UserInput[]` | Visible only when normalized text or attachments produce a user item; keep text and resources together |
| `hookPrompt` | `id`, prompt fragments | Visible as hook-feedback user content only when at least one fragment has non-empty trimmed text |
| `agentMessage` | `id`, `text`, phase, optional memory citation | Assistant Markdown; phase participates in active/final reconciliation |
| `plan` | `id`, `text` | Durable assistant plan text; distinct from plan-progress notification |
| `reasoning` | `id`, summary/content arrays | Visible only when the normalized summary is non-empty; raw content alone does not create a row |
| `commandExecution` | command, cwd, process/source/status/actions/output/exit/duration | Command activity with bounded output disclosure |
| `fileChange` | ordered changes and patch status | Visible only when filtering produces a patch or visualization activity |
| `mcpToolCall` | server, tool, arguments, status, result/error, duration | MCP row labeled `server / tool` |
| `dynamicToolCall` | namespace, tool, arguments, content items, success, duration | Hide classified internal tools; show supported automation updates or non-hidden dynamic tools |
| `collabAgentToolCall` | raw `senderThreadId`/`receiverThreadIds`, tool, prompt/model/effort, agent states | Visible only with background sub-agents enabled and when the action is not `wait`; normalize identities to Session-named fields |
| `subAgentActivity` | raw `agentThreadId`, agent path, and activity kind | Visible only with background sub-agents enabled; normalize identity to Session-named fields |
| `webSearch` | `WebSearchItem` fields | Search activity/evidence |
| `imageView` | local path | Visible media activity; consecutive image views are aggregated until a non-image item appears |
| `sleep` | `SleepItem` fields | Hidden; no Session transcript row |
| `imageGeneration` | `ImageGenerationItem` fields | Generated media resource |
| `enteredReviewMode`, `exitedReviewMode` | `id`, review text | Hidden; no Session transcript row |
| `contextCompaction` | `id` | Visible compaction lifecycle marker without encrypted compaction content |

The pinned renderer evidence is the item mapper at
`webview/assets/app-initial-CHAIly1j.js:185739` and visibility predicate `Jqn`
at line `186424` inside the hashed desktop archive. Those coordinates are from
the recorded formatter output; the raw archive entry has 9,558 lines. The same
`Jqn` predicate is at raw line 772, entry byte offset 3,348,317, and archive byte
offset 27,457,094. Raw entry offsets also pin composer stop/send at 9,544,717
and 9,544,942, approval actions at 10,126,264, 10,126,520, and 10,127,683, and
the sidebar toggle at 4,044,424. Recording both coordinate systems prevents a
formatter change from appearing as renderer drift. The executable inventory in
`specs/codex-desktop-parity.spec.json` requires an independently authored raw
fixture, canonical Session presentation assertion, and desktop visibility
assertion for every variant. Protocol variants that are intentionally hidden
must not fall through to a generic visible row.

The desktop renderer also constructs presentation items that are not members
of the raw `ThreadItem` union. Its exact evidence identifiers include
`todo-list`, `planImplementation`, `error`, `automaticApprovalReview`,
`autoReviewInterruptionWarning`, `remoteTaskCreated`, `personalityChanged`,
`forkedFromConversation`, `modelChanged`, `modelRerouted`,
`userInputResponse`, `mcpServerElicitation`, `permissionRequest`,
`worktreeInit`, `steeringUserMessage`, and `steered`. These names describe the
pinned provider renderer only; BirdCoder maps them to Session task progress,
interactions, lifecycle markers, bounded errors, or in-Turn steering views.
Automatic approval review, errors, task progress, and steering user content
remain conditional on their renderer filters; the other listed synthetic items
are visible presentation entries.

`item/completed` is authoritative for the final item even if `item/started` contained partial fields. Deltas for agent text, plan text, reasoning, command output, file changes, and terminal interaction update their correlated identity only.

## Notification Classification

The pinned `ServerNotification` union contains more than transcript messages:

| Class | Notifications |
| --- | --- |
| Session inventory | thread start/status/name/goal/settings/token/environment/archive/delete/close changes |
| Turn lifecycle | turn start/completion, diff, moderation, and plan updates |
| Item lifecycle | item start/completion, auto-approval review, and raw-response completion |
| Content deltas | agent message, plan, and reasoning summary/content deltas |
| Tool deltas | command/process output, terminal interaction, file patch/output, and MCP progress |
| User interaction | server-request resolution and approval/review notifications |
| Runtime status | MCP startup/OAuth, model reroute/verification/safety, warnings, and deprecations |
| Realtime-only | realtime item/transcript/audio/SDP/error/closed events |

Only durable item/turn facts become transcript items. Account, filesystem, skills, app-list, fuzzy-search, and Windows setup notifications update their owning UI surfaces or bounded diagnostics instead.

## Plans

Plan progress is a separate notification:

```json
{
  "method": "turn/plan/updated",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "explanation": "optional",
    "plan": [
      {"step": "Inspect protocol", "status": "completed"},
      {"step": "Repair projection", "status": "inProgress"},
      {"step": "Verify", "status": "pending"}
    ]
  }
}
```

The notification's Turn `items` collection is not plan history and is empty by protocol design. BirdCoder maps `params.plan` to `taskProgress`, maps `inProgress`/`in_progress` to `running`, and retains `explanation` as plan metadata. It must not synthesize item rows from `params.items`. A completed `ThreadItem` with `type: "plan"` and `text` remains a normal durable assistant item and is reconciled independently.

The active plan snapshot replaces the prior snapshot for the same turn. It is not appended as another tool call on every update. `update_plan` rollout records remain a compatibility source for older history, but the App Server notification is the live authority when both exist.

## Turn Interruption

Codex stops a running turn with `turn/interrupt` and requires both provider
`threadId` and `turnId`. The provider adapter converts the canonical Session
identity to the provider continuation identity only at that boundary. BirdCoder
invokes the generated Agents App SDK `agents.turns.cancel` operation; Agents and
Kernel own the mapping to provider interruption, cancellation fencing, and the
authoritative terminal Turn and Session Items. UI code must not invoke
`turn/interrupt` directly.

An interrupted/cancelled Turn does not fail or close its Session. The composer
becomes available after the authoritative terminal state, and the Session stays
resumable.

This is the required end-state contract, not the current real-provider state.
The BirdCoder UI and mock API consumer already exercise the generated
`agents.turns.cancel` surface, but the verified Agents implementation currently
marks the Turn cancelled in its repository and writes audit events without
routing the canonical Turn to a provider request handle. Kernel already exposes
incremental `stream_into`, `cancel_model`, and request-scoped worker cancellation
primitives. Agents currently bootstraps a local engine slot for each Turn, while
the active Codex TypeScript SDK path spawns `codex exec --experimental-json`
instead of retaining an app-server connection. The missing contract is a
server-owned runtime registry and persistent Agents-to-Kernel execution handle
that maps canonical Session and Turn identities to provider and transport
identities. `CDP-005` therefore remains blocked by `CDB-005`.

## BirdCoder Session Verification

The PC mock boundary exercises the generated Agents App SDK contract rather
than invoking Codex transport methods from the UI. Its canonical Session E2E
suite covers:

- durable history, raw provider-item presentation, image grouping, context
  compaction, message submission, first streamed delta, and authoritative
  completion reconciliation;
- versioned Turn cancellation after the first delta, composer recovery, and a
  server-side guard that prevents a delayed completion or assistant item from
  committing after cancellation;
- pending Interaction list/get, claim leases, claim tokens, fencing tokens,
  version checks, approval resolution, and user-question option submission.

The executable files are
`apps/sdkwork-birdcoder-pc/tests/e2e/codex-session-parity.spec.ts`,
`codex-session-cancel.spec.ts`, and `codex-session-interactions.spec.ts`.
Passing these mock-backed checks is required but does not satisfy the real
provider gate in `specs/codex-desktop-parity.spec.json`.

These checks prove the BirdCoder Session consumer and UI behavior against its
SDK boundary. They do not prove the current Agents/Kernel provider chain. The
verified owner runtime waits for `execute_turn` to finish, collects
`stream_deltas`, then constructs one `Body::from(...)` SSE response; the runtime
facade call uses `DiscardingModelStreamSink`. Approval and question resolution
likewise update the Interaction repository and audit stream without continuing
the matching Codex app-server server request. Real-time send/stream, provider
cancellation, and provider-confirmed Interaction continuation remain
`blocked-contract` as `CDP-004`, `CDP-005`, and `CDP-006` under `CDB-005`.

The managed Windows visual runner is
`scripts/run-pc-playwright-e2e.mjs`. It owns the Vite and mock API processes,
uses independent bounded cleanup with a force-close fallback, and is covered
by `scripts/run-pc-playwright-e2e.test.mjs` and
`scripts/pc-e2e-standard-contract.test.mjs`. The visual suite is fail-closed:
every browser `console.error` and every failed request fails the run. The
focused lifecycle checks are:

```text
node scripts/run-pc-playwright-e2e.test.mjs
node scripts/pc-e2e-standard-contract.test.mjs
node scripts/run-pc-playwright-e2e.mjs tests/e2e/codex-desktop-visual-parity.spec.ts --project=chromium
```

The governed visual regression uses canonical Session fixtures at `1440x900`
and `900x800`. It covers the Session sidebar, transcript, expanded file diff,
composer, approval card, and user-question card, and rejects horizontal
overflow or overlap between transcript, Interaction, and composer regions. The
BirdCoder screenshots are independently authored regression baselines tied to
the pinned Codex build and `app.asar` hash; they are not copies of proprietary
Codex pixels. Their paths and SHA-256 values are executable evidence in the
parity matrix.

## Approval And User Input Contract

The current Codex interaction protocol is richer than a boolean approval and a
single prompt:

- command decisions include `accept`, `acceptForSession`,
  `acceptWithExecpolicyAmendment`, `applyNetworkPolicyAmendment`, `decline`, and
  `cancel`;
- file-change decisions include `accept`, `acceptForSession`, `decline`, and
  `cancel`;
- permission responses may carry a permission profile, grant scope, and
  `strictAutoReview`;
- user input contains `questions[]` with stable question IDs and options, an
  answer map keyed by question ID, and optional `autoResolutionMs`.

BirdCoder must preserve these meanings through canonical Agents Interaction
contracts. It must not collapse them into `approved: boolean`, invent local
DTOs, call raw HTTP, or edit generated SDK output. Until `sdkwork-agents`
extends its owner API and regenerates the App SDK, these rows remain
`blocked-contract` in `specs/codex-desktop-parity.spec.json` and require human
review because they change a public API and security decision model.

There are two independent Interaction gates. `CDB-001` covers lossless public
contract shape for scoped approval decisions and multi-question answers.
`CDB-005` covers execution control after that answer exists: the resolution must
continue the pending provider server request and only become terminal after
provider confirmation. A persisted canonical resolution or a passing mock UI
test cannot substitute for that continuation.

## Tools And MCP

`mcpToolCall` carries `id`, `server`, `tool`, `arguments`, status, result/error, and optional duration. `dynamicToolCall` carries namespace, tool, arguments, content items, success/error, and duration. Commands carry command, cwd, status, aggregated output, exit code, and duration. File changes remain structured mutations.

The rollout adapter preserves `mcp_tool_call_end`, `plan_update`, `exec_command_end`, `web_search_end`, `dynamic_tool_call_response`, `view_image_tool_call`, image generation, patch completion, collaboration completion, and sub-agent activity. Rust `Duration` values encoded as `{secs,nanos}` are converted to `durationMs`.

MCP result payloads use a success/error wrapper. On success the inner result is the display output; on error the error settles the call as failed. Keeping the wrapper as raw output produces noisy `Ok(...)`/`Err(...)` UI and loses status. Command arrays are joined into readable commands for display while their original JSON remains in provider data.

## History Reconciliation

`thread/read(includeTurns: true)` is a durable snapshot. `thread/turns/list` and `thread/items/list` use opaque cursors when enabled. The local rollout reader instead walks session JSONL in source order and uses stable rollout/item IDs. These sources must not be concatenated blindly.

1. Prefer App Server durable items when present.
2. Use rollout records to fill sessions/history unavailable through App Server.
3. Deduplicate by provider item/call identity, never by display text.
4. Preserve a provisional live tail until a matching completed durable item replaces it.
5. Continue older-history reads until the provider terminal condition; fixed page limits are invalid.

For head refresh, keep reading while pages contain only already-known items if the provider reports more pages. Stop after overlap plus useful current context, an explicit terminal page, cancellation, or the refresh deadline.

## Unknown Data Policy

New non-system `ThreadItem` variants receive a bounded generic presentation until a typed mapping is added. Raw rollout records require an additional security classification because the same JSONL contains encrypted reasoning/compaction, tool definitions, model input, deltas, and transport controls:

- a future `response_item` with a stable type becomes a type-only generic notice; its unclassified payload is not copied into visible text;
- `additional_tools`, encrypted compaction records, and compaction triggers fail closed;
- `context_compaction` becomes a lifecycle marker without encrypted content;
- warning, error, and stream-error events retain only their user-facing message/status fields;
- review-mode and sleep records remain classified lifecycle input but do not create Session transcript rows;
- an unclassified `event_msg` remains omitted until it is proven durable and user-visible, because treating every event as a message would expose internals and duplicate high-volume deltas.

Unknown notifications never create empty message rows. System/developer prompts, auth material, encrypted content, and transport-only payloads fail closed from the transcript.

## BirdCoder Mapping

| Codex fact | Canonical presentation |
| --- | --- |
| `userMessage` | user text plus structured resources |
| non-empty `hookPrompt` | hook-feedback user content |
| `agentMessage`, final `plan` | assistant Markdown |
| `reasoning` | collapsible reasoning |
| `turn/plan/updated` | `taskProgress` |
| `commandExecution` | command activity row |
| `fileChange` | file-change activity |
| `mcpToolCall` | MCP tool row with `server / tool` |
| `dynamicToolCall`, `collabAgentToolCall`, `webSearch` | typed tool row |
| `imageView`, `imageGeneration` | resource/media block |
| `contextCompaction` | visible Session lifecycle marker |
| `sleep`, `enteredReviewMode`, `exitedReviewMode` | no Session transcript row |
| unknown non-system item | bounded generic notice |

Regression authorities are `scripts/agent-session-item-view-contract.test.ts`, `scripts/agent-session-pagination-refresh-contract.test.ts`, and the Codex provider-session tests in `sdkwork-kernel`.

## Real Provider E2E Gate

`scripts/run-codex-provider-live-e2e.mjs` is the fail-closed entrypoint for
`CDP-010`. It runs only
`apps/sdkwork-birdcoder-pc/tests/e2e-live/codex-provider-live.spec.ts` through
`playwright.codex-provider-live.config.ts`. It does not start the mock API host,
and the target BirdCoder runtime must not declare `test` mode.

The runner requires all of the following environment values before Playwright
starts:

| Value | Contract |
| --- | --- |
| `SDKWORK_CODEX_LIVE_E2E` | Must equal `1`; prevents accidental live execution |
| `SDKWORK_CODEX_LIVE_WEB_URL` | Live BirdCoder `http` or `https` URL with no embedded credentials |
| `SDKWORK_CODEX_LIVE_ACCOUNT`, `SDKWORK_CODEX_LIVE_PASSWORD` | Dedicated BirdCoder E2E identity; never print or attach these values |
| `SDKWORK_CODEX_LIVE_PROJECT_NAME` | Existing project that owns the four Session fixtures |
| `SDKWORK_CODEX_LIVE_SEND_SESSION_ID` | Fresh canonical Session for stream, persistence, restart, resume, and recovery |
| `SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID` | Canonical Session dedicated to provider-process cancellation |
| `SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID` | Canonical Session that produces a real Codex approval request |
| `SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID` | Canonical Session that produces a real Codex user-question request |
| `SDKWORK_CODEX_LIVE_PROVIDER_HOST` | `local` or `remote`; `local` also requires a successful `codex login status` probe |
| `SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE` | Existing absolute executable path for restarting the provider service |
| `SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON` | JSON string array passed directly to the restart executable without a shell |
| `SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE` | Existing absolute executable path for an external provider-process probe |
| `SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON` | JSON string array containing both `{sessionId}` and `{turnId}` scope placeholders |

The four Session IDs must be valid, distinct canonical Session identities. They
must already be provisioned with Codex runtime bindings through the normal
Agents SDK-backed application flow. A provider continuation identity is valid
only when `session_activity_summaries.currentRuntimeBinding.providerSessionId`
returns it after the first successful Turn. The test must reject a value copied
or synthesized from `sessionId`, must retain the same opaque value after service
restart and Session resume, and may attach only its SHA-256 fingerprint.

Restart and cancellation probe subprocesses do not inherit the BirdCoder live
account or password. Playwright screenshots, traces, and video are disabled for
this gate so authentication state is not written to its evidence artifacts. The
suite operates through visible BirdCoder UI and the application's injected
generated Agents App SDK; raw HTTP clients, manual authorization headers, and
BirdCoder-local provider DTOs are prohibited.

Run the source and preflight contract independently:

```text
node scripts/codex-provider-live-e2e-contract.test.mjs
node scripts/run-codex-provider-live-e2e.mjs --preflight-only
```

The 2026-07-31 local preflight failed closed with
`The local Codex provider host is not authenticated.` No credentialed live
case was run, so `CDP-010` remains `pending`. Provider authentication is an
independent environment gate; it resolves neither the `CDB-001` Interaction
shape gap nor the `CDB-005` real-time execution-control gap. Even after provider
login succeeds, `CDP-010` cannot pass until Agents streams before body
completion, cancellation reaches the provider request handle, and Interaction
resolution continues the Codex app-server request.

After the live environment is provisioned and the local provider is logged in
when applicable, run all four real-provider cases:

```text
node scripts/run-codex-provider-live-e2e.mjs
```

The static contract, Playwright test discovery, mock E2E, or a successful
preflight does not complete `CDP-010`. It remains `pending` until all four live
cases prove pre-body-completion delta delivery, opaque continuation persistence
and recovery, provider-process termination, approval continuation, and
user-question continuation against the current provider implementation.

## Cross-Repository Feature Gates

The pinned desktop bundles expose additional product surfaces that BirdCoder
cannot implement inside the renderer alone. Their executable status and blocker
details live in `specs/codex-desktop-parity.spec.json`.

| Capability | Current difference | Gate |
| --- | --- | --- |
| Real-time provider execution control | BirdCoder has SDK-backed UI and mock coverage, while Agents currently returns completion-time SSE replay, persists cancellation without provider interruption, and persists Interaction resolution without provider continuation. | `CDP-004`, `CDP-005`, and `CDP-006`, blocked by `CDB-005`; also blocks `CDP-010` |
| Automations | Codex covers Session-bound create, schedule, run-now, pause/resume, history, notification, cancellation, and recovery. The Agents owner OpenAPI and generated App SDK do not yet expose that complete canonical Session contract. | `CDP-012`, blocked by `CDB-002` |
| Embedded Browser | `BrowserPreviewSurface` is a sandbox iframe, not the Codex Browser host/sidecar. BirdCoder lacks the Kernel Browser lifecycle and security SPI plus the Agents canonical Session binding and site-permission contract. | `CDP-013`, blocked by `CDB-003` |
| Remote execution | BirdCoder lacks a governed remote-host/SSH SPI, authorized-device lifecycle, and canonical Session continuation, apply/revert, recovery, and audit contracts. | `CDP-014`, blocked by `CDB-004` |

These rows stay fail-closed. A BirdCoder-local DTO, raw HTTP or SSH, manual
generated SDK edit, persisted credential copy, sandbox-iframe substitution, or
mock-only parity claim cannot satisfy them.

## Conformance Checklist

- `turn/plan/updated` produces one replaceable `taskProgress` snapshot and no empty transcript row.
- Final `plan` text remains visible after plan progress completes.
- `item/started` plus deltas plus `item/completed` results in one item identity.
- Command, MCP, dynamic, web, image, patch, collaboration, and sub-agent records survive rollout history reconstruction.
- Command failures and MCP errors settle as failures with bounded evidence.
- Unknown response items produce a safe type notice while encrypted and transport-only rollout records stay hidden.
- Deep duplicate-only history pages do not stop pagination early.
- Structured/tool-heavy transcripts avoid estimated spacer virtualization and blank scroll regions.
