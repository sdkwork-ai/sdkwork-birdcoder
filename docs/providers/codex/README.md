# Codex Protocol

## Baseline And Authority

- Repository: [openai/codex](https://github.com/openai/codex)
- Source commit: `3725f02cf38d856bc82bb46dd68ab61bb96ec6fc`
- Workspace crate version: `0.0.0` (source build; use the commit as the compatibility identity)
- App Server guide: [Codex App Server](https://developers.openai.com/codex/app-server)
- Primary local types: `external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts`
- Notification union: `external/codex/codex-rs/app-server-protocol/schema/typescript/ServerNotification.ts`
- Rust authority: `external/codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs`
- Raw rollout authority: `external/codex/codex-rs/protocol/src/protocol.rs` and `models.rs`

## Transport

App Server uses JSON-RPC-shaped request, response, and notification objects over its transport, but intentionally omits the `jsonrpc` member.

```json
{"id":1,"method":"thread/read","params":{"threadId":"...","includeTurns":true}}
{"id":1,"result":{"thread":{}}}
{"method":"item/started","params":{"threadId":"...","turnId":"...","item":{}}}
```

Clients must correlate responses by `id`, route notifications by `method`, and tolerate newly added fields and item variants.

## Hierarchy And History

- `Thread` is the durable session.
- `Turn` groups one user submission and the resulting work.
- `ThreadItem` is the ordered display/history unit.
- `thread/read` with `includeTurns: true` returns the durable thread and its turns.
- Experimental `thread/turns/list` and `thread/items/list` provide paginated history. Their cursor is opaque and must never be synthesized.
- The local provider adapter can also discover Codex threads from `~/.codex/state_5.sqlite` and reconstruct history from rollout JSONL.

The rollout reader must preserve all stable response items and selected durable lifecycle events. High-volume output deltas are not separate history messages; they update the corresponding item.

## Item Lifecycle

`item/started` contains the initial full item. Item-specific delta notifications update text, reasoning, command output, patches, and similar channels. `item/completed` contains the authoritative final full item. Consumers replace/merge by the item ID, not by array position.

Current `ThreadItem` variants include:

```text
userMessage, hookPrompt, agentMessage, plan, reasoning
commandExecution, fileChange, mcpToolCall, dynamicToolCall
collabAgentToolCall, subAgentActivity, webSearch, imageView
sleep, imageGeneration, contextCompaction, review-mode items
```

Exact durable variants at the pinned baseline:

| Variant | Stable identity/content | Presentation rule |
| --- | --- | --- |
| `userMessage` | `id`, optional `clientId`, ordered `UserInput[]` | One user message with text and resources kept together |
| `hookPrompt` | `id`, prompt fragments | Actionable hook/interaction surface, not assistant prose |
| `agentMessage` | `id`, `text`, phase, optional memory citation | Assistant Markdown; phase participates in active/final reconciliation |
| `plan` | `id`, `text` | Durable assistant plan text; distinct from plan-progress notification |
| `reasoning` | `id`, summary/content arrays | Collapsible reasoning channel |
| `commandExecution` | command, cwd, process/source/status/actions/output/exit/duration | Command activity with bounded output disclosure |
| `fileChange` | ordered changes and patch status | File mutation activity |
| `mcpToolCall` | server, tool, arguments, status, result/error, duration | MCP row labeled `server / tool` |
| `dynamicToolCall` | namespace, tool, arguments, content items, success, duration | Typed tool row; preserve structured output |
| `collabAgentToolCall` | sender/receiver threads, tool, prompt/model/effort, agent states | Collaboration activity, not routing text |
| `subAgentActivity` | agent thread/path and activity kind | Sub-agent lifecycle row |
| `webSearch` | `WebSearchItem` fields | Search activity/evidence |
| `imageView` | local path | Image resource/view activity |
| `sleep` | `SleepItem` fields | Bounded wait lifecycle |
| `imageGeneration` | `ImageGenerationItem` fields | Generated media resource |
| `enteredReviewMode`, `exitedReviewMode` | `id`, review text | Review-mode lifecycle |
| `contextCompaction` | `id` | Compaction marker, never an empty message |

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

New non-system `ThreadItem` variants and durable rollout records are retained as bounded provider data and receive a generic visible presentation until a typed mapping is added. Unknown notifications remain lifecycle/diagnostic metadata and never become empty message rows. System/developer prompts, auth material, and transport-only payloads fail closed from the transcript.

## BirdCoder Mapping

| Codex fact | Canonical presentation |
| --- | --- |
| `userMessage` | user text plus structured resources |
| `agentMessage`, final `plan` | assistant Markdown |
| `reasoning` | collapsible reasoning |
| `turn/plan/updated` | `taskProgress` |
| `commandExecution` | command activity row |
| `fileChange` | file-change activity |
| `mcpToolCall` | MCP tool row with `server / tool` |
| `dynamicToolCall`, `collabAgentToolCall`, `webSearch` | typed tool row |
| `imageView`, `imageGeneration` | resource/media block |
| unknown non-system item | bounded generic notice |

Regression authorities are `scripts/agent-session-item-view-contract.test.ts`, `scripts/agent-session-pagination-refresh-contract.test.ts`, and the Codex provider-session tests in `sdkwork-kernel`.

## Conformance Checklist

- `turn/plan/updated` produces one replaceable `taskProgress` snapshot and no empty transcript row.
- Final `plan` text remains visible after plan progress completes.
- `item/started` plus deltas plus `item/completed` results in one item identity.
- Command, MCP, dynamic, web, image, patch, collaboration, and sub-agent records survive rollout history reconstruction.
- Command failures and MCP errors settle as failures with bounded evidence.
- Deep duplicate-only history pages do not stop pagination early.
- Structured/tool-heavy transcripts avoid estimated spacer virtualization and blank scroll regions.
