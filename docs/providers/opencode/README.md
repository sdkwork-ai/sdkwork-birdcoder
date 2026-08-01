# OpenCode Protocol

## Baseline And Authority

- Repository: [anomalyco/opencode](https://github.com/anomalyco/opencode)
- Version: `1.18.9`
- Commit: `a6f7fe739c691e8b086c50390cf3205f0b5d431e`
- Message authority: `external/opencode/packages/opencode/src/session/message-v2.ts`
- Durable schema: `external/opencode/packages/schema/src/v1/session.ts`
- HTTP schema: `external/opencode/packages/sdk/openapi.json`

## Model

OpenCode stores a message `info` record and an ordered collection of `parts`. User and assistant info records have distinct fields, while part types carry text, reasoning, tools, files, steps, snapshots, patches, retry/compaction metadata, and provider-specific extensions.

The SDKWork canonical Session is identified by `sessionId` and binds to the
OpenCode provider session identity stored unchanged as `providerSessionId`.
Raw OpenCode `sessionID` fields are provider-wire evidence for that opaque
binding; they never replace `sessionId`, and `providerSessionId` must never be
synthesized from `sessionId`. OpenCode message IDs map to canonical Session
Item identities; part IDs remain child identities and must not be flattened in
a way that loses their ordering or lifecycle.

User message info includes creation time, agent/model selection, optional format/summary/system/tools, and model variant. Assistant info includes `parentID`, model/provider/agent/mode, cwd/root, creation/completion time, cost/tokens, optional structured output, finish reason, and a discriminated provider error. `parentID` is the turn correlation key; it must not be replaced by adjacency after pagination.

## Durable Part Inventory

Every part has `id`, `sessionID`, `messageID`, and a discriminating `type`.

| Part | Key fields | Projection |
| --- | --- | --- |
| `text` | text, synthetic/ignored flags, time, metadata | Visible text unless explicitly ignored/internal |
| `reasoning` | text, time, provider metadata | Reasoning disclosure |
| `file` | MIME, filename, URL, file/symbol/resource source | Structured resource/reference |
| `tool` | `callID`, tool name, state, metadata | Correlated tool row |
| `subtask` | prompt, description, agent, model, command | Sub-agent/task activity |
| `step-start`, `step-finish` | snapshot; finish reason, cost, token accounting | Turn/step lifecycle, not empty rows |
| `snapshot`, `patch` | snapshot/hash/files | File/workspace activity |
| `agent` | agent name and source range | Agent/delegation metadata |
| `retry` | attempt, typed error, creation time | Retry lifecycle/error |
| `compaction` | auto/overflow/tail-start identity | Compaction lifecycle |

Part order inside `WithParts.parts` is authoritative. A message with an unknown part still survives; only that part uses the generic fallback.

## Events And Authority

The event stream publishes full replacements and deltas:

```text
message.updated
message.removed
message.part.updated
message.part.delta
message.part.removed
```

`message.part.updated` is the current full part snapshot. `message.part.delta`
applies to a declared field of the same part identity. Removal events are
authoritative deletions. Full replacements and removals are idempotent. A
delta has no provider event identity, so it is applied exactly once in received
wire order; reconnect must reconcile from an authoritative snapshot or cursor
instead of blindly replaying already delivered deltas.

`message.updated` replaces message info, `message.part.updated` replaces the full part snapshot, and `message.part.delta` applies `delta` to the declared `field` for the same session/message/part IDs. `message.removed` and `message.part.removed` are authoritative deletions. `session.diff` is structured file evidence and `session.error` settles the affected session/assistant state without manufacturing assistant text.

## History And Pagination

Message history uses an opaque cursor encoding `{id,time}` and a `before` boundary. A page returns ordered messages with parts, a `more` flag, and the next cursor. Consumers must pass the returned cursor unchanged and continue until `more` is false. They must not convert cursor history into offset assumptions.

The source query orders older rows by creation time and ID and hydrates parts by message ID. The returned cursor identifies the page tail. A duplicate-only page is not terminal while `more` and `cursor` are present. The client advances with that exact cursor, deduplicates stable IDs, and keeps provider order after merging pages.

## Tool Lifecycle

Durable tool parts use these states:

| State | Required fields | Canonical state |
| --- | --- | --- |
| `pending` | input and raw partial input | pending |
| `running` | input, optional title/metadata, start time | running |
| `completed` | input/output/title/metadata, start/end/compacted time, attachments | completed |
| `error` | input/error/metadata and start/end time | failed |

SDK/UI compatibility input may also use AI SDK lifecycle spellings such as `input-streaming`, `input-available`, `output-available`, and `output-error`; these normalize to the same row without changing `callID`.

BirdCoder maps all of these to one tool call identity and normalizes lifecycle to pending/running/success/error/cancelled. Tool attachments become resources. MCP names such as `mcp__server__tool` are split only for presentation; the original name and payload remain available.

## Plans And Interactions

OpenCode exposes step-oriented parts and commonly represents todo plans through todo tools. BirdCoder recognizes `todo_read`, `todo_write`, `update_plan`, and related names, then maps `items`, `todos`, `tasks`, `plan`, or `steps` to `taskProgress`. Permission and question flows are actionable interactions rather than ordinary tool output.

`step-start`/`step-finish` mark model execution boundaries; they are not automatically plan items. A task plan is promoted only from a provider plan contract or a recognized structured todo collection. Free-form text containing numbered steps remains text.

## Unknown Data Policy

New part kinds are retained as bounded provider data and rendered as a generic visible item unless they are explicitly internal/system context. Never drop an entire message because one part kind is unknown. Never treat transient deltas as independent durable history rows.

## BirdCoder Checks

- Preserve `info` and ordered `parts` until normalization.
- Correlate updates by session, message, and part ID.
- Keep the `before` cursor opaque.
- Project tool state and attachments through the shared tool/resource UI.
- Prefer the final part snapshot after streamed deltas.
- Keep the disposable loaded source window bounded to 500 canonical Session
  Items and 4 MiB; expose `retentionLimitReached` when either limit truncates
  history so the UI does not continue unbounded earlier-page loading.

[`openCodeSessionItemReplay.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/openCodeSessionItemReplay.ts),
[`agentSessionItemSourceWindow.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionItemSourceWindow.ts),
[`agentSessionOpenCodeReplay.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionOpenCodeReplay.test.ts),
[`agentSessionProviderRealtimeEvents.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts),
and
[`agentSessionProviderItemRouting.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts)
now verify full-snapshot replacement, exact repeated-delta order, authoritative
part and message removal, later full-snapshot restoration, `callID` tool
correlation, and provider Session isolation both within one payload and across
canonical Session Items in the loaded transcript source window. The replay
produces one bounded full-snapshot envelope rather than visible delta rows.
The source-window tests also cover stable canonical Item deduplication,
same-version provider payload replacement, the shared 500 Item / 4 MiB
retention limits, and propagation of `retentionLimitReached`.

[`sessionRefresh.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/sessionRefresh.test.ts)
also verifies the pagination boundary where a latest-page delta is initially
incomplete, its full part snapshot arrives on an earlier page, the opaque
canonical cursor is forwarded unchanged, and the merged source window
reprojects one complete visible row.

The OpenCode replay suite additionally verifies the client sequence
`refresh -> load earlier -> reconnect refresh`: the older snapshot and newer
delta produce one visible row, and a reconnect refresh remains idempotent.

This still does not prove OpenCode-to-Agents deep provider-cursor translation,
transport-level reconnect delivery/reconciliation, or credentialed provider
E2E. Those gates require owner transport evidence and must not be inferred
from the in-memory replay, canonical pagination, and simulated reconnect tests.

## Conformance Checklist

- Preserve user/assistant info independently from ordered parts.
- Apply part deltas to the named field and replace them with later full snapshots.
- Honor authoritative message and part removals.
- Keep cursor, `more`, and tail identity semantics intact across deep history.
- Bound the disposable source window and stop paging when retention is reached.
- Render retry, compaction, snapshot, patch, step, and subtask parts without blank rows.
- Keep tool attachments structured and interrupted pending/running tools non-successful.
