# Engine SDK Integration

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: `APP_SDK_INTEGRATION_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`

This reference defines BirdCoder's current coding-session lifecycle and the
boundary between the application, the SDKWork kernel facade, and provider-native
session adapters. It is the detailed companion to the root
[PRD](../product/prd/PRD.md) and [technical architecture](../architecture/tech/TECH_ARCHITECTURE.md).

## Ownership Boundary

| Layer | Responsibility |
| --- | --- |
| `sdkwork-kernel` and `sdkwork-agents` | Provider-neutral turn lifecycle, provider SDK negotiation, and streamed execution. |
| `sdkwork-birdcoder-kernel-bridge` | Adapts the kernel lifecycle SPI into BirdCoder turn execution without importing provider SDKs into application code. |
| `sdkwork-birdcoder-pc-projection` | Projects provider-neutral kernel chunks into canonical `message.delta`, terminal, tool, and completion events. |
| `sdkwork-birdcoder-codeengine` | Shared engine/model catalog, provider-native session discovery, and provider dialect adapters. |
| BirdCoder coding-session service and repository | Logical session creation, immutable engine/model/runtime-location binding, and immutable native binding persistence. |
| sdkwork-birdcoder-tauri-host | Local desktop filesystem and terminal host capabilities. It does not accept a renderer-supplied project root for provider-native session discovery. |
| PC application services | Select a session pair, consume the composed BirdCoder app SDK, and project provider-native detail back to the logical session. |

Provider SDK DTOs and raw provider transport calls do not cross into BirdCoder
feature, UI, route, service, or repository code. Provider lifecycle work remains
behind the kernel facade and provider adapter boundaries.

## P0 Providers And Selection

BirdCoder's P0 providers are `codex`, `claude-code`, `gemini`, and `opencode`.
Session creation starts from an explicit provider selection. A supplied model is
accepted only when it is active and belongs to that provider in the shared engine
catalog. A cross-provider pair is rejected before the logical session is stored.

When an explicit provider is selected without a model in a PC creation flow, the
selection resolver uses that provider's configured/default model. It never carries
the active session's model from another provider into the new request. An explicit
provider therefore takes precedence over the current workbench session and saved
selection state.

The resulting `engineId` and `modelId` are creation-time properties. They cannot
be changed by a session update or a later turn. Choosing another provider or model
creates another logical coding session.

## Logical And Native Identities

BirdCoder keeps application identity separate from provider identity.

| Value | Owner | Use | Rule |
| --- | --- | --- | --- |
| `codingSessionId` | BirdCoder | Workbench selection, application event correlation, and project membership. | Logical identity; it is not sent as another provider's native conversation ID. |
| `engineId` | Shared engine catalog | Provider discriminator. | Persisted with the logical session and supplied separately for provider/native reads. |
| `nativeSessionId` | Provider | Provider-native detail lookup and later turn resume. | Raw provider-native conversation ID; it is not a BirdCoder logical ID. |

The application creates and persists a logical session before a provider-native
conversation necessarily exists. The first successful provider turn may bind the
returned raw `nativeSessionId`. A binding may be set when empty or replayed with
the same value, but a different native ID is rejected: one BirdCoder logical
session cannot be rebound to another provider conversation.

Legacy prefixed values such as `codex-native:<id>` are accepted only at
compatibility input boundaries and normalized to raw provider IDs. New persisted
native IDs are raw values; `engineId` remains the provider discriminator.

## Native Discovery And Detail Reads

The codeengine registry owns native summary and detail discovery. List reads load
provider summaries; transcript/detail reads use the raw nativeSessionId together
with the explicit engineId. Native session list and detail requests always use
the authenticated BirdCoder App API and carry an explicit `workspaceId`,
`projectId`, and `runtimeLocationId`. The route validates that exact location
binding after workspace membership, project write authority, project/workspace
relation, and organization scope checks; its target-owned resolver then obtains
a canonical root only for that authorized location.

A Tauri folder mount is a local device capability, not a provider-native session
authorization grant. The desktop host does not expose a native-session list or
detail command and never receives a renderer-supplied project root for discovery.
When the selected target has no server-authorized execution root, native discovery
fails closed through the App API rather than falling back to a local path.

New logical coding sessions require an explicit terminal-capable
`runtimeLocationId` at creation and persist that exact value as an immutable
session binding. Every later turn, native-session list, native-session detail,
and recovery uses the persisted binding rather than looking up the current
subject preference. Before execution, the service verifies workspace
membership, project write authority, project/workspace relation, tenant,
organization scope, target binding, lifecycle state, health, and terminal
capability; the target-owned resolver then supplies the canonical root.
Historic sessions without a binding remain readable but return a typed `503`
unavailable outcome for execution and native-session discovery. No path falls
back to a bootstrap root, process CWD, project-only preference, session
metadata, or renderer mount.

Provider-reported CWD remains a target-private observation that can be used for
scoped provider-record matching after the runtime location is authorized. It is
not an execution authority and is omitted from session summaries, native-session
attributes, replay/SSE projections, App API responses, and generated SDK
models.

For an aggregate native inventory request (`engine_id=None`), an unavailable
provider is logged and successful provider inventories are retained. An explicit
single-provider request surfaces that provider's failure. Provider cache reads
preserve fresh snapshots, use a last successful snapshot after a refresh failure,
and do not hold the global catalog cache mutex during provider I/O. Results remain
deterministically ordered by the native catalog.

The adapter boundary alone is not proof of completed end-to-end native-inventory
pagination remediation. The authorization boundary is the App API route and its
project execution resolver; desktop and browser clients consume that route through
the composed SDK and cannot inject a local provider-root override.

## Event And Recovery Boundary

Provider output is normalized through the kernel bridge before BirdCoder projects
it into application events and UI state. Provider DTOs never become realtime wire
messages. Each coding-session stream event follows one authoritative order:

1. append to `ai_coding_session_event`;
2. let the database assign the event UUID, session-local sequence, and timestamp;
3. commit the transaction;
4. attempt memory/Redis workspace fan-out.

The turn stream keeps the provider-facing channel bounded at 128 entries. After
the first delta is available, the service coalesces only chunks that are already
ready, with a hard limit of 32 provider chunks or 16 KiB of UTF-8 text per durable
append. It never waits on a timer or a future chunk, so batching reduces database
write amplification without increasing first-token latency. Oversized provider
chunks are split only at valid UTF-8 boundaries. Provider completion first drains
every accepted delta and then applies interaction or terminal events, preserving
the provider order under backpressure.

User-initiated approval decisions and question answers follow the same rule: the
checkpoint or question state change and its `operation.updated` event commit in
one transaction. A durable-event insert failure rolls back the state change;
publication is never attempted for an uncommitted mutation.

Interactive source events use `approval.required` and `user.question.required`.
Both carry provider-neutral `interactionId` and `interactionKind` (`approval` or
`user_question`) in their canonical payload. Client mutation paths use the source
event's durable UUID as `interactionEventId`, not the provider interaction ID.
Settlement events carry both identities explicitly. The repository validates
tenant, user, session, event kind, and interaction-kind pairing by primary key;
only then does the service pass the resolved `interactionId` to the provider.

Before a provider submission, the service atomically claims the unresolved source
event with an opaque, time-bounded lease. Only the holder may settle the
interaction; settlement verifies the claim ID and writes the source-state update,
the scoped approval checkpoint update when applicable, and the resulting
`operation.updated` event in one transaction. A definite provider rejection
releases only its own claim. An unavailable, timed-out, or otherwise unknown
provider outcome retains the claim until expiry because replaying an uncertain
external request can duplicate a provider-side effect. Provider adapters must
treat the stable provider-neutral `interactionId` as their idempotency key and
interaction target. The durable store guarantees one local settlement, not
cross-process external exactly-once delivery after a crash.

The durable event ID, scope, kind, sequence, `interactionId`, and
`interactionKind` are immutable. Settlement may add only defined interaction
state annotations such as an answer, decision, status, or settlement time under
an optimistic version check. Repository-private claim fields are never included
in list, replay, SSE, or WebSocket event projections.

The JSON `event.eventId` is the durable database event UUID over both SSE and
WebSocket. `event.codingSessionEventSequence` is the decimal database sequence.
The gateway does not regenerate either value. Fan-out failure after commit is
observable but cannot turn a durable completion into a failed turn; replay remains
the recovery path.

High-frequency chat subscriptions are scoped by `codingSessionId`. Clients resume
with `afterSequence`; SSE additionally accepts `Last-Event-ID` in the
`<codingSessionId>:<sequence>` format. The SSE field is a composite cursor while the
JSON `eventId` remains the durable UUID. WebSocket carries byte-equivalent canonical
JSON and uses the same query cursor.
WebSocket is a server-push-only delivery channel; client text or binary commands
are closed with RFC 6455 status `1003` and mutations continue to use authenticated
HTTP SDK operations. A non-empty `Last-Event-ID` without `codingSessionId` is
rejected instead of silently degrading to a live-only subscription.

The server subscribes live before replay, captures a durable high watermark, pages
events in sequence order, then drains live fan-out and drops sequences at or below
the delivered cursor. Broadcast lag or a detected sequence gap restarts durable
replay from the last delivered sequence. Session-local sequences are never used as
cursors for an unfiltered workspace-wide stream; workspace lifecycle notification
remains live-only and inventory is reconciled through authenticated list APIs.

The service/repository replay port uses keyset semantics:
`afterSequence: Option<usize>`, `highWatermark: Option<usize>`, and a bounded
page size. The first request reads the session-scoped maximum sequence as its
fixed watermark. Every page reads `sequence_no > afterSequence` when supplied and
`sequence_no <= highWatermark`, orders ascending, and fetches one extra row to
derive `hasMore`. It never uses `COUNT(*)` or `OFFSET`; events appended after the
first page are outside that fixed replay window.

The migration baseline includes a partial unique replay index over
`tenant_id`, `user_id`, `coding_session_id`, and `sequence_no` for rows where
`is_deleted IS NOT TRUE`. Both replay pages and the session maximum-sequence read
use the same owner scope. SQLite query-plan verification confirms that the range
boundaries are pushed into the index, the index supplies sequence ordering, and no
temporary sort is introduced.

An active session-scoped connection also performs low-frequency durable watermark
reconciliation. It recovers a final committed event when Redis fan-out fails and no
later sequence exists to expose a gap. Replay reads remain bounded and paginated;
Redis pub/sub is never treated as a durability boundary.
The PC client serializes event application and advances its session cursor only
after the projection callback completes successfully. A rejected asynchronous
callback or a non-contiguous sequence closes that connection and resumes from the
last contiguous applied sequence, so failed UI state application cannot acknowledge
or skip a durable event. Incoming browser messages enter a fixed-capacity ring FIFO
instead of an array-shifting backlog; the default capacity is 256 and the hard
configuration ceiling is 4096. Overflow closes the connection and resumes from the
last committed cursor. Cursor persistence accepts only non-negative safe integers
and advances monotonically, so a stale subscription cannot overwrite newer durable
progress. A connection must receive its workspace-matching `ready` frame within 10
seconds by default, with an absolute configuration ceiling of 60 seconds.

The checked-in SQLite baseline and query-plan contract are complete. A final live
PostgreSQL drift check and `EXPLAIN` verification remain environment validation and
must be run against an authorized production-shaped DSN before release; repository
tests do not substitute for that deployment evidence.

## Canonical event kinds

The executable registry in `sdkwork-birdcoder-pc-contracts-commons` is authoritative. Provider
adapters, durable storage, realtime projection, SDK consumers, and UI renderers use
only these event kinds:

- `session.started`
- `turn.started`
- `message.delta`
- `message.completed`
- `message.deleted`
- `message.edited`
- `tool.call.requested`
- `tool.call.progress`
- `tool.call.completed`
- `artifact.upserted`
- `approval.required`
- `user.question.required`
- `operation.updated`
- `turn.completed`
- `turn.failed`

## Canonical artifact kinds

Artifact producers and consumers use only the following executable registry. New
kinds require coordinated type, persistence, SDK, renderer, and documentation
updates before release:

- `diff`
- `patch`
- `file`
- `command-log`
- `todo-list`
- `pty-transcript`
- `structured-output`
- `build-evidence`
- `preview-evidence`
- `simulator-evidence`
- `test-evidence`
- `release-evidence`
- `diagnostic-bundle`

## API And SDK Authority

The authored app OpenAPI contract is
[`sdks/specs/openapi/birdcoder-app-v3.openapi.json`](../../sdks/specs/openapi/birdcoder-app-v3.openapi.json).
Application consumers use the composed `@sdkwork/birdcoder-app-sdk` facade; generated
transport output is derived and must not be edited by hand. The concise navigation
page is [API Reference](api-reference.md).

## Verification

Relevant lifecycle checks include:

- `pnpm test:engine-kernel-contract`
- `pnpm test:codeengine-native-provider-completeness-contract`
- `pnpm test:kernel-birdcoder-alignment-contract`
- `cargo test -p sdkwork-birdcoder-codeengine`
- `cargo test -p sdkwork-birdcoder-coding-sessions-service --tests`
- `cargo test -p sdkwork-api-birdcoder-standalone-gateway --lib`
- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node ../sdkwork-specs/tools/check-application-layering.mjs --root .`
- `node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .`

Future provider additions must preserve the same explicit provider discriminator,
model ownership validation, logical/native ID separation, immutable native binding,
and kernel/provider-adapter boundary.
