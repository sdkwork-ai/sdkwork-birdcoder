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

Main-process app-server evidence in the same archive is pinned separately:

| Transport evidence | Archive entry | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| Electron main IPC bridge | `.vite/build/main-Dnwk9I3e.js` | `6c4b94a1a6b7f42f84d55f65b837d300ffc1d9f8567fa8353fb57b6c41bf04be` | 2,362,317 |
| Shared app-server connection | `.vite/build/src-BPbHdvxe.js` | `efcbdf277ce7c7b78db991bef1b05fd2fa78635f2c69c0d204cb3dcbd8e49a38` | 1,443,629 |

Feature-specific renderer evidence in the same archive is pinned separately:

| Capability evidence | Archive entry | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| Automations | `webview/assets/automations-page-CNlcT7yo.js` | `3bdf115c9fc72298d04510177a343ba8c6b3436a3f77f71abe5baf6c443affe7` | 84,851 |
| Browser renderer and lifecycle | `webview/assets/app-initial-CHAIly1j.js` | `5e8de7531fc9e44d1851380c2a5844079e7abdf7df5e2b37bc799450cfe15254` | 14,023,273 |
| Hidden adopted web contents host | `webview/assets/browser-sidebar-hidden-background-webview-host-D_rN2j7z.js` | `7b830a4e028636ca323a98b438192ceff0dfc6ffbf33d1eb0b142a94cc353bc1` | 2,553 |
| Hidden Browser-use host | `webview/assets/browser-sidebar-hidden-browser-use-webview-host-lBn0j35v.js` | `758040f4e7796968e0fa3c797dca61d6cf22045c6ba81bcd59331dc76ace0efb` | 2,375 |
| Browser settings | `webview/assets/browser-use-settings-52aGrZMW.js` | `c3b75cff167c750a2e22f531996fdb3e3ca7db593ec0a209903d5307c12d63e8` | 92,415 |
| Browser tab transfer export | `webview/assets/thread-browser-panel-tabs-BrIOEvhE.js` | `bb587f7b72359676801b428415630dbe3de66340f3b93c1cdeaee02052c240f5` | 152 |
| DotLottie dependency, negative Browser evidence | `webview/assets/browser-Be3Y5Oyc.js` | `dd35124bd1dc1d64f9206b5a5946175f2795ca88c7c9237c03b390bf11020839` | 651,835 |
| Remote settings | `webview/assets/remote-connections-settings-DwcGEEux.js` | `30780436d7f6f0238b709a2fb85503a9ed4ea453dd6a83846412f82e7bcab2b7` | 158,510 |
| Remote continuation | `webview/assets/remote-conversation-page-DebkGSyJ.js` | `f3028786d1acead0b2622b97f8499b10044e639fa59fd79f5b560881d3e2658b` | 66,842 |

The similarly named `browser-Be3Y5Oyc.js` entry is DotLottie rendering code.
It contains no Browser tab persistence or capture command markers and is not
accepted as lifecycle, command, permission, or host evidence. Browser product
logic is pinned from `app-initial-CHAIly1j.js`, the settings chunk, the two
hidden-host chunks, and the installed Browser plugin resources.

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
provider-neutral output must bind the opaque `providerSessionId` to the
canonical `sessionId` and expose only Session-named fields and commands. No
Thread DTO, store, service, event, route,
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

The provider terminal proof for a real cancellation is `turn/completed` with
an interrupted status after `turn/interrupt(provider threadId, turnId)`. The
raw provider continuation identity is resolved only inside the adapter. A
database `cancelled` write, timeout return, or composer reset before that proof
is not provider interruption.

The pinned desktop renderer makes the transition order explicit. Raw bundle
line 749 contains the `turn/started`, `item/started`, item-delta,
`item/completed`, and `turn/completed` dispatchers at entry byte offsets
3,204,170, 3,209,764, 3,213,000, 3,210,924, and 3,206,481. Starts mark the
Session streaming and may synthesize or rebind a missing in-progress Turn;
item-specific deltas update one provider item identity; buffered text is
drained before item and Turn completion; and `item/completed` replaces or
merges the authoritative full item without creating a second canonical item.
`turn/completed` applies status, error, and duration, clears terminal input
buffers for interrupted or failed Turns, restores eligible queued steering,
emits completion, and only then returns the composer to ready.

Before interruption, the desktop settles pending request cards so they cannot
remain orphaned: command and file approvals are declined, permissions receive
an empty Turn-scoped grant, questions receive empty answers, option and context
pickers are dismissed, and MCP elicitation is declined. It then issues
`turn/interrupt`, cleans background terminals, and terminates active
request-scoped Node REPL executions. User-initiated stop interrupts descendant
executions in the background, while system interruption waits for descendant
cleanup. A follower forwards stop to the owning client and falls back only
when that owner is unavailable. A provider `no active turn to interrupt`
response is a recovery signal, not a fresh acknowledgement; BirdCoder must
reconcile provider history before recording the canonical interrupted state.

Raw bundle line 8804 at entry byte offset 9,553,000 confirms the composer rule:
while streaming, the primary control is an enabled `Stop` button with
`type="button"`; only after terminal reconciliation does it become `Send` and
resume the normal submit disabled/loading conditions.

This is the required end-state contract, not the current real-provider state.
The BirdCoder UI and mock API consumer already exercise the generated
`agents.turns.cancel` surface, but the verified Agents implementation currently
marks the Turn cancelled in its repository and writes audit events without
routing the canonical Turn to a provider request handle. Kernel exposes
incremental `stream_into`, `cancel_model`, request-scoped worker cancellation,
and a resident Codex app-server adapter. That adapter now normalizes five
user-mediated request methods into typed canonical Session Interactions and
compiles their resolutions back to exact provider responses. The Kernel worker
prefers that app-server lane when the Codex binary is available and retains its
process across Turns; the exec SDK/CLI lane remains a fallback. Agents still
does not retain or address an in-flight Kernel app-server execution across HTTP
requests. The missing cross-repository contract is a
server-owned runtime registry and persistent Agents-to-Kernel execution handle
that maps canonical Session and Turn identities to provider and transport
identities.

That execution registry is keyed only by canonical tenant, organization,
owner, agent, Session, and Turn fields. Its internal handle preserves a fenced
generation, model request, opaque provider Session and Turn identities,
transport lease, provider sequence, and liveness timestamps. The lifecycle is
`registered -> streaming -> awaiting_interaction|cancelling ->
terminal_acknowledged -> finalized`; transport ambiguity enters
`resolution_unknown` and requires reconciliation rather than optimistic
completion.

The current Agents HTTP path now attaches a bounded `TurnExecutionStreamSink`,
waits only for the first signal, and forwards subsequent chunks through
`Body::from_stream` while provider execution continues. The runtime facade also
forwards provider-neutral chunks and Kernel events into that sink. This closes
the completion-time SSE replay gap, but it does not create the required durable
execution registry: streamed facts are still collected and persisted only at
terminal completion, and no restart-safe cursor or active execution handle is
recorded. A disconnected HTTP consumer therefore detaches from a bounded live
stream, while provider execution continues without a durable recovery handle.

Cancellation fences `running -> cancelling`, resolves the internal handle,
invokes provider `turn/interrupt`, waits for the matching
`turn/completed(interrupted)`, and only then persists canonical cancellation.
Each provider request also owns an at-most-once ledger keyed by execution handle
and provider request ID. Canonical Interaction resolution becomes terminal only
after response continuation succeeds and `serverRequest/resolved` clears the
same request. Restart and lease-loss recovery reconcile provider history, the
active Turn, pending requests, response-ledger state, and last sequence before
emitting or accepting another response. `CDP-005` therefore remains blocked by
`CDB-005`.

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

Image activity verification preserves Codex desktop grouping semantics:
consecutive `imageView` items form one expandable `Viewed N images` activity,
a later isolated item renders as `Viewed an image`, expansion reveals every
image preview action, and both the transcript and expanded thumbnail strip stay
within the narrow viewport without horizontal overflow.

The executable files are
`apps/sdkwork-birdcoder-pc/tests/e2e/codex-session-parity.spec.ts`,
`codex-session-cancel.spec.ts`, and `codex-session-interactions.spec.ts`.
Passing these mock-backed checks is required but does not satisfy the real
provider gate in `specs/codex-desktop-parity.spec.json`.

These checks prove the BirdCoder Session consumer and UI behavior against its
SDK boundary. The current Agents/Kernel chain additionally proves bounded live
SSE delivery: the HTTP handler supplies a `TurnExecutionStreamSink`, waits for
the first signal, and returns `Body::from_stream` while the runtime facade keeps
forwarding provider chunks. It still has no persistent execution handle or
restart-safe live-event ledger. Approval and question resolution update the
Interaction repository and audit stream without continuing the matching Codex
app-server request, and cancellation persists without provider interruption.
Provider cancellation, recovery, and provider-confirmed Interaction
continuation therefore remain `blocked-contract` under `CDB-005`; the live
provider gate still requires all of them in addition to the now-implemented
stream path.

Because `sdkwork-agents` and `sdkwork-kernel` are active owner repositories,
their CDB-005 evidence is checked with function-scoped semantic assertions,
not whole-file hashes. The contract pins the live HTTP sink and
`Body::from_stream` path, runtime-facade forwarding, terminal-only stream-item
persistence, missing execution handle, repository-only cancellation and
Interaction resolution, available Kernel cancellation primitives, and
per-invocation Codex exec transport. Unrelated Task or Automation edits
therefore do not invalidate the evidence, while any change inside these
execution scopes fails closed for review. Installed Codex desktop artifacts
remain pinned by exact SHA-256 because they are immutable reference inputs.

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
  answer map keyed by question ID, and required-but-nullable `autoResolutionMs`.

The provider-to-canonical mapping is discriminated by request kind. Raw Codex
`threadId` is consumed only by the Kernel/provider adapter and maps to the
existing canonical Agents `sessionId`; it is never a second BirdCoder domain
identity.

| Codex request | Canonical Interaction data that must survive | Current Agents loss |
| --- | --- | --- |
| Command approval | Provider callback identity, Session/Turn/item correlation, start time, environment, command/cwd/actions, network context, reason, proposed exec-policy and network-policy amendments; one of six typed decisions | Generic `approval`, prompt/options, and `approved: boolean` cannot preserve scope, amendments, `decline` versus `cancel`, or callback-specific `approvalId` |
| File-change approval | Session/Turn/item correlation, start time, reason, optional grant root; `accept`, `acceptForSession`, `decline`, or `cancel` | Generic boolean approval loses grant scope, grant root, and continue-versus-interrupt semantics |
| User input | `questions[]` with ID, header, text, other/secret flags and nullable options; `autoResolutionMs`; answer arrays keyed by question ID | One prompt, flat options, one answer, one selected option, and `rejected` cannot represent the provider map |
| MCP elicitation | `form`, `openai/form`, or `url`; server, nullable Turn correlation, message, schema or URL/elicitation ID, metadata; response action, structured content, and metadata | No MCP elicitation Interaction kind or typed request/response payload exists |
| Permission approval | Environment, cwd, reason, requested filesystem/network profile; granted profile, `turn|session` scope, and optional `strictAutoReview` | Generic boolean approval loses the permission profile, scope, and strict review policy |

The current generated Agents record does carry `providerInteractionId`, but it
does not carry a typed provider request kind or a lossless request/response
payload. The BirdCoder hook then wraps every `user_question` in a one-element
`questions` array and maps its `approved|denied|blocked` UI decisions back to a
boolean. That rendering structure is useful for today's canonical contract, but
it is not evidence of Codex multi-question or scoped-approval parity.

The Kernel provider adapter now covers the five rows above without flattening:
it preserves canonical `sessionId`, opaque `providerSessionId`, provider Turn
and item correlation, the exact string-or-number request ID, all decision
variants, question answer maps, MCP modes and metadata, and permission scope.
Its worker response entrypoint accepts a typed canonical resolution and compiles
the provider wire response inside the adapter. This proves the provider boundary
only. It does not remove `CDB-001`, because Agents persistence, OpenAPI,
generated App SDK, runtime continuation, and the BirdCoder consumer still cannot
carry that envelope end to end.

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

## Server Request Projection

The pinned app-server protocol has eight default-exported v2 server-request
methods plus feature-gated `currentTime/read`. `item/tool/requestUserInput` is
still documented as experimental by its schema even though it belongs to the
default union. These requests do not all belong in one UI or persistence model:

| Request class | Methods | Canonical owner behavior |
| --- | --- | --- |
| User-mediated Interaction | Five public approval/input methods, the desktop option/context methods, and onboarding/setup dynamic tools | Kernel preserves provider request/tool correlation and compiles typed canonical resolutions; Agents exposure remains blocked on its owner contract review |
| Dynamic tool execution | ordinary `item/tool/call` requests outside the setup family | Kernel dispatches through an allowlisted typed host/tool port and returns structured content plus success; that general port remains incomplete |
| Private host service | `account/chatgptAuthTokens/refresh`, `attestation/generate` | Kernel host boundary only; tokens and attestation payloads never enter BirdCoder UI or Agents persistence |
| Experimental host service | `currentTime/read` | Kernel returns `currentTimeAt` as whole Unix seconds; a failed or malformed response stops the Turn before model execution |
| Setup completion | `item/tool/call` with `setup_codex_step:{step:"complete"}` | Kernel returns the desktop-compatible successful dynamic-tool result without creating an Interaction |

The response union is equally normative. Command and file approvals return a
typed `decision`; `decline` rejects that action while allowing the Turn to
continue, whereas `cancel` also interrupts the Turn. User input returns an
answer map keyed by question ID. MCP elicitation returns required `action`,
required-but-nullable `content`, and required-but-nullable `_meta`. Permission approval returns the granted subset,
`turn|session` scope, and optional `strictAutoReview`. Dynamic tools return
`contentItems` and `success`. Token refresh uses `accessToken`,
`chatgptAccountId`, and required-but-nullable `chatgptPlanType`; attestation returns an opaque
`token`. These host-private values never cross into BirdCoder UI state.

The desktop renderer adds observable request projection beyond that public
union. It handles `item/tool/requestOptionPicker` and
`item/tool/requestSetupCodexContextPicker`, treats
`request_onboarding_input`, `request_option_picker`,
`setup_codex_context_picker`, and incomplete `setup_codex_step` dynamic calls
as pending setup interactions, and answers `currentTime/read` in the host. The
legacy wire methods `applyPatchApproval` and `execCommandApproval` are ignored
with a warning. `item/plan/requestImplementation` is synthesized locally from
plan state and must not be misclassified as a provider request.

The internal response payloads are also typed. Option picker returns
`action: submit|skip|dismiss`, `selectedOptions[]`, and nullable
`freeformAnswer`; the Codex-context picker returns
`action: continue|skip|dismiss` and `selectedSources[]`. Setup steps return
`selectedRoles`, `answers`, or `selectedSources` according to role, task, or
context. When carried through `item/tool/call`, the payload is wrapped as one
`inputText` content item whose text is `JSON.stringify(payload)`, with
`success: true`.

Kernel now implements this desktop projection in its resident app-server
adapter. It uses canonical kinds `onboarding_question_set`, `option_picker`,
`context_source_picker`, and `setup_step`, retains exact provider request and
tool-call correlation inside the adapter, and never exposes provider
`threadId`. Invalid `request_option_picker`, `request_onboarding_input`, and
`setup_codex_step` arguments return one `inputText` item with the desktop error
message and `success: false`; valid setup completion returns JSON
`{"completed":true}` with `success: true`. Focused module and resident-worker
tests cover both string/number request correlation and the dynamic response
envelope. Agents persistence, generated SDKs, BirdCoder controls, and real
credentialed approval/recovery E2E remain blocked and are not implied by this
adapter coverage.

`serverRequest/resolved` is a cleanup signal, not proof that this client sent a
successful answer. The canonical transport lifecycle must distinguish
`pending`, `responding`, `response_sent`, `provider_cleared`, `cancelled`, and
`resolution_unknown`. Reconnect recovery correlates canonical Session, Turn,
and execution handle with provider Session, Turn, item, and request identities,
and sends at most one response per provider request. For command and file work,
`item/completed` remains the terminal item authority. Reconnect handling first
reconciles the provider's pending request and never resends solely because a
canonical database row says it was resolved. Canonical Turn cancellation calls
provider `turn/interrupt` through the adapter, waits for `turn/completed` with
`status: interrupted`, and only then persists a terminal cancelled state.

For a resumed provider Session, listeners are installed before `turn/start` so
early deltas cannot be lost, but an early event is not allowed to choose the new
Turn identity. Kernel keeps a bounded ordered pre-bind buffer, takes the
authoritative provider Turn ID from the `turn/start` response, replays only
matching events, and drops late events from the previous Turn. The resident
worker regression injects a stale prior-Turn delta before the response and
asserts that it never enters the new canonical Turn.

The cleanup notification carries provider-wire `threadId` plus a string-or-number
`requestId`. Kernel translates those fields to the canonical Session execution
handle; neither provider field becomes BirdCoder or Agents domain naming. The
exact required, nullable, and optional request fields for all nine methods are
executable evidence in `CDB-006`, including timestamps, approval callback
correlation, MCP mode payloads, permission profiles, and `autoResolutionMs`.

Kernel's vendored Codex commit is currently
`ad2012d645b7146d31bb03f98e2bd9371635d11a`; the pinned desktop protocol source
is its newer descendant `a05bcda3dbd68729caa2f11027b7f43974fda298`.
This is observable schema drift, not a version-label difference: Kernel's
generated `ToolRequestUserInputParams` omits `autoResolutionMs`. Exact source
hashes, renderer byte offsets, the public method inventory, and the desktop
projection inventory are locked by `CDP-015` and `CDB-006` in the parity
matrix. Generated Codex schemas must be regenerated from an aligned source or
adapted through a versioned compatibility boundary; they must not be hand
edited.

Kernel is therefore no longer accurately described as exec-only. Its resident
app-server worker has typed dispatch and response continuation for the five
user-mediated methods above, with exact request-ID wire-type preservation and
canonical Session/provider Session separation. It also handles
`currentTime/read` inside the adapter, validates provider Session affinity, and
returns an injected-clock whole-Unix-seconds value without creating a product
Interaction. `CDB-006` remains open because the vendored schema drift is
unresolved and typed dynamic-tool, token-refresh, attestation, desktop setup
projection, reconnect recovery, and credentialed end-to-end coverage are still
incomplete.

## Desktop App-Server Transport

The pinned desktop does not execute one isolated provider process for each
Turn. Its local transport launches Codex with `-c features.code_mode_host=true app-server --analytics-default-enabled`
and keeps one app-server connection behind the Electron main process. The shared
connection starts with JSON-RPC request ID `__codex_initialize__`, method
`initialize`, `clientInfo`, and capability fields for the experimental API,
OpenAI-form MCP elicitation, attestation, notification opt-outs, and optional
extensions. The initialize handshake times out after 30 seconds. Messages that
arrive before initialization are not dispatched as normal provider traffic.

The observable connection states are `disconnected`, `connecting`,
`connected`, `error`, and `restarting`; remote connection progress additionally
uses `initializing`, `waiting-for-device`, and `confirming-connection`. When a
renderer reports ready, main sends the current connection state, the
initialization snapshot when available, and the pending user-input
auto-resolution snapshot for every registered provider host.

The renderer/main bridge uses `mcp-request`, `mcp-request-abandon`,
`mcp-notification`, and `mcp-response`. Provider server requests run registered
internal host handlers first; requests without an internal handler are
broadcast to renderer surfaces. Renderer answers return with the exact original
JSON-RPC request ID. Provider notifications receive host-side observation and
filtering before renderer broadcast. This exact-ID continuation is the behavior
Kernel must expose to Agents; BirdCoder must not create its own provider
transport or request ledger.

Transport close clears pending auto-resolution work and fails both renderer
client requests and internal host requests. Those in-flight calls are not
blindly replayed after reconnect. WebSocket-capable transports reconnect from a
one-second delay, double up to 20 seconds, use deterministic 0-500 ms jitter for
SSH hosts, and may retry early when network connectivity returns. Stdio itself
is not reconnect-capable. A reconnect therefore establishes a fresh transport;
canonical Interaction recovery must reconcile provider state before answering
again.

`CDB-006` locks the two archive hashes, byte offsets, handshake, IPC routing,
close semantics, and reconnect policy as executable evidence. Kernel now owns a
resident worker-local app-server transport, five typed Interaction adapters,
and the current-time host auto-response; the integrated runtime still needs a
durable cross-request execution registry, the remaining host/request families,
and reconnect reconciliation. All provider identities remain adapter-only;
Agents and BirdCoder correlate canonical `Session`, Turn, execution handle, and
`providerSessionId`.

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

## Embedded Browser Host Contract

The installed Browser implementation is a host-backed product surface, not an
iframe with an address bar. Its lifecycle and renderer state live in
`app-initial-CHAIly1j.js`; `browser-Be3Y5Oyc.js` is a DotLottie dependency and
must not be used as Browser parity evidence. The Browser plugin contract is
pinned independently by these installed resources:

| Resource | SHA-256 | Bytes |
| --- | --- | ---: |
| `skills/control-in-app-browser/SKILL.md` | `b5adddc633a50b6434a06b0387c2f7985cb243a0af3021e9abcdad4fc4b61451` | 4,462 |
| `docs/api.json` | `33e761f616e8f7057bb43841edcadfc64f0747202b08355099473c18f3ebb4c3` | 53,368 |
| `scripts/browser-client.mjs` | `14e425736668bf21b5b39f2cc022ee8684728617fb5c49f35533c2e349f47193` | 1,002,051 |

### Canonical Session Boundary

Reference-only identity names are converted at their owning adapter. They are
not additional BirdCoder domain identities:

| Reference field | Canonical boundary result |
| --- | --- |
| Renderer `conversationId` | canonical `sessionId` in the Browser renderer adapter |
| Codex provider `threadId` | opaque `providerSessionId` in the Codex provider adapter |
| Browser plugin `codexSessionId` | opaque `providerBrowserSessionId` in the Kernel Browser host adapter |
| Browser/plugin tab id | opaque `providerBrowserTabId` bound to the canonical Session |

`sessionId` identifies the only canonical SDKWork Session. The three opaque
provider identities are independently resolved and cannot be synthesized from
`sessionId` or from one another. In particular, plugin discovery's
`codexSessionId` is matched together with `codexAppBuildFlavor`; it is not an
SDKWork Session ID without an explicit owner binding record. Reference
conversation scope maps to SDKWork Session scope, reference turn scope maps to
the canonical Turn, and global scope remains global policy.

The reference storage keys `persist:codex-browser-app-route:` and
`thread-browser-tabs-v1:` are evidence of reference renderer isolation only.
BirdCoder contracts, stores, routes, events, and UI use `sessionId` and
Session-named keys. Provider or renderer terminology does not cross that
boundary.

### Renderer State And Commands

The reference tab state includes URL/title/favicon, tab type, suspension,
loading, document-bottom, back/forward, security, zoom, audible/media capture,
interaction and annotation modes, original-view/tweaks state, modifier state,
and comments. The exact field inventory is executable under `CDB-003`.

The renderer command union covers navigation, back/forward, reload and stop;
close, screenshot capture and print; find and address focus; step, percentage,
and reset zoom; scroll and reset; Session transfer; interaction mode, comments,
annotations and original-view state; design modifier, comment selection, and
cursor refresh. A host adapter must expose typed state and commands. Recreating
history as a React string array or reloading an iframe key does not satisfy this
contract.

Browser-use tabs remain bootstrapped while hidden with `hostKind:
hidden-browser-use`, an `about:blank` fallback, `isVisible: false`,
`shouldBootstrapWhenHidden: true`, and `shouldPaint: false`. Adopted background
web contents additionally require an opaque `adoptedWebContentsId` and
`adoptionLease`. Recovery must preserve one active owner, validate the lease,
reconcile the provider tab before reuse, and release the host on reset or
Session isolation. Tab transfer is an atomic reassociation from one canonical
Session to another; it does not rename or synthesize either Session.

### Permissions And Safety

Website opening and history access have separate `alwaysAsk` and `neverAsk`
settings; `neverAsk` is displayed as **Always allow**, and website approval
shows an elevated-risk warning. Download and upload approval are also separate.
The per-origin resource matrix is:

| Resource | Values | Meaning |
| --- | --- | --- |
| `origin` | `default`, `allowed`, `denied` | navigation/browsing access |
| `download` | `default`, `allowed`, `denied` | file download |
| `upload` | `default`, `allowed`, `denied` | file upload |
| `fullCdp` | `default`, `allowed`, `denied` | high-risk raw Chrome DevTools Protocol access |

Origin state preserves allowed and denied arrays independently for all four
resources. Mutations carry `action: add|remove`, `kind: allowed|denied`,
`origin`, and `resource`. Host operations separately read origin state, update
origin rules, write website/history/file-transfer approval modes, enable full
CDP, and clear browsing data.

Runtime permission requests distinguish `origin`, download/upload
`fileTransfer`, `fullCdp`, and `sensitiveData:browsing_history`. Decisions are
`approve|deny`; reference scopes are `turn|conversation|global`; decision
sources include persisted Browser state, Codex network policy, and the guardian
origin cache. Plugin `persist: session` maps to canonical Session scope and
`persist: always` maps to global policy. A navigation approval never authorizes
download, upload, history, or full CDP. Risky external side effects and
sensitive-data transmission require their resource-specific decision at action
time.

Reference `browser/sessions/<id>.toml`, browser profiles, partitions, cookies,
passwords, tokens, and credential material are host-private. BirdCoder React
may receive bounded status and display metadata, but never paths or secret
contents. Host-backed settings include contact info, downloads, extensions,
history, password manager, site settings, browsing-data clearing, and
host-mediated profile import.

### Plugin And Current Gap

The public plugin surface exposes browser discovery/selection, tab creation and
selection, navigation, screenshots, content export, Playwright/DOM/CUA control,
clipboard/developer capabilities, user open-tab claiming and history, and tab
finalization as `handoff` or `deliverable`. These APIs are provider Browser
runtime contracts; BirdCoder must consume the owner SDK/host adapter rather
than fork their DTOs.

Current `BrowserPreviewSurface` exposes only `id` and `render`, passes URL,
title, and refresh key to a sandbox iframe, and keeps local `entries/index`
history. Current settings store one `browserAllowedSites` array, introduce a
non-reference `trusted-sites` policy, clear selected Web Storage prefixes, and
use placeholder/toast flows for host settings. There is no native Browser host,
provider host binding, denied/per-resource permission state, hidden host,
lease recovery, action-time approval, or real desktop Browser E2E. Therefore
`CDP-013` remains `blocked-contract` by `CDB-003`; the iframe and local settings
are useful Studio preview behavior, not an embedded Browser parity claim.

## Packaged App-Server Live Probe

`scripts/release/probe-desktop-codex-app-server-live.mjs` verifies the staged
desktop provider host independently from the BirdCoder web and Agents
service. It validates the runtime manifest, re-executes itself with the bundled
Node.js binary, launches the bundled Codex app-server through the staged Kernel
runtime module, and runs a real first Turn plus a context-dependent resumed
Turn in an isolated read-only temporary working directory.

The probe is fail-closed. Preflight is read-only and does not invoke the model:

```text
node scripts/release/probe-desktop-codex-app-server-live.test.mjs
node scripts/release/probe-desktop-codex-app-server-live.mjs --host-root target/release/provider-host --preflight-only
```

Real invocation additionally requires
`SDKWORK_CODEX_APP_SERVER_LIVE_PROBE=1`:

```text
node scripts/release/probe-desktop-codex-app-server-live.mjs --host-root target/release/provider-host
```

The first operation carries canonical `sessionId` and no
`providerSessionId`. The runtime must establish a non-empty opaque provider
identity that is independent from `sessionId`, retain it across resume, emit
incremental chunks and canonical Kernel lifecycle events for both Turns, and
recover the first marker from provider context. The report deliberately omits
the provider Session ID. The probe uses a persistent provider Session because
Codex ephemeral Sessions do not retain a resumable rollout.

The 2026-07-31 Windows x64 probe passed with packaged Codex `0.146.0` and
Node.js `22.20.0`. It observed 28 and 31 chunks and 40 and 42 Kernel events for
the first and resumed Turns. This is transport evidence only: it does not pass
`CDP-010`, because it does not traverse the credentialed BirdCoder UI and
generated Agents SDK, restart the provider service, cancel a provider request,
or continue approval and question Interactions.

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

The 2026-07-31 preflight currently fails closed at environment configuration:
all 14 required `SDKWORK_CODEX_LIVE_*` values are absent. It has therefore not
selected a local or remote provider host and has not reached provider-host
authentication. No credentialed live case was run, so `CDP-010` remains
`pending`. Environment configuration and provider authentication are
independent gates; neither resolves the `CDB-001` Interaction shape gap, the
`CDB-005` execution-control gap, nor the `CDB-006` Kernel protocol-baseline
drift. Even after both gates pass, `CDP-010` cannot pass until the live stream
is proved in a credentialed run, cancellation reaches the provider request
handle, Interaction resolution continues the Codex app-server request, restart
recovery is durable, and Kernel proves the pinned request/response union.

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
| Real-time provider execution control | Agents now forwards bounded incremental SSE, while active execution identity and live-event replay are not durable; cancellation still does not interrupt the provider, and Interaction resolution still does not continue it. | `CDP-004`, `CDP-005`, and `CDP-006`, blocked by `CDB-005`; also blocks `CDP-010` |
| Provider server requests | Kernel vendors Codex commit `ad2012d...`, while the pinned desktop protocol is `a05bcda...`; Kernel's `ToolRequestUserInputParams` omits `autoResolutionMs`, uses an exec-only SDK path, and has no proved dispatcher for the public union plus desktop request projection. | `CDP-015`, blocked by `CDB-006`; also blocks `CDP-010` |
| Automations | Agents now exposes canonical Session scheduling, run-now, replace, pause/resume, Run history, retry/cancel, and attempts; user-visible reconciliation, notification policy, and canonical HTTP conformance coverage remain incomplete. | `CDP-012`, blocked by `CDB-002` |
| Embedded Browser | `BrowserPreviewSurface` is a sandbox iframe with local history/preferences, not the Codex host-backed Browser. BirdCoder lacks the Kernel Browser lifecycle/security SPI, canonical Session-to-provider-host binding, per-resource permission matrix, hidden-host recovery, host-backed settings, and real desktop Browser E2E. | `CDP-013`, blocked by `CDB-003` |
| Remote execution | BirdCoder lacks a governed remote-host/SSH SPI, authorized-device lifecycle, and canonical Session continuation, apply/revert, recovery, and audit contracts. | `CDP-014`, blocked by `CDB-004` |

For Automations, run-now maps to generated `agents.tasks.execute`. Its owner
generated request now carries `idempotencyKey` plus optional expected version,
and returns `AgentTaskRunRecord`. Canonical `sessionId`, schedule and execution
policy, task status filtering, task replace, pause/resume, Run
list/retrieve/retry/cancel, and attempt history are present in the generated App
SDK. Per-Run reconciliation is still backend-only, notification policy is
absent, and the owner App HTTP tests currently cover only canonical
Session-bound create, list, retrieve, cancel, and manual execute. They do not
yet cover status-filtered cursor pagination, replace, pause/resume, Run
list/retrieve/retry/cancel, attempt history, reconciliation, or notification
policy. Those remaining owner contracts and tests must land before the
Automation navigation can be enabled.

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
