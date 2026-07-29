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

The notification's Turn `items` collection is not plan history. BirdCoder maps `params.plan` to `taskProgress`, maps `inProgress`/`in_progress` to `running`, and optionally displays `explanation` as assistant content. A completed `ThreadItem` with `type: "plan"` and `text` remains a normal durable assistant item.

## Tools And MCP

`mcpToolCall` carries `id`, `server`, `tool`, `arguments`, status, result/error, and optional duration. `dynamicToolCall` carries namespace, tool, arguments, content items, success/error, and duration. Commands carry command, cwd, status, aggregated output, exit code, and duration. File changes remain structured mutations.

The rollout adapter preserves `mcp_tool_call_end`, `plan_update`, `exec_command_end`, `web_search_end`, `dynamic_tool_call_response`, `view_image_tool_call`, image generation, patch completion, collaboration completion, and sub-agent activity. Rust `Duration` values encoded as `{secs,nanos}` are converted to `durationMs`.

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
