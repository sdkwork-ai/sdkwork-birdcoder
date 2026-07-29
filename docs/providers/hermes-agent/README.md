# Hermes Agent Protocol

## Baseline And Authority

- Repository: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- Version: `0.19.0`
- Commit: `cff9728587da4f3c0beed0786f9bea528e489f13`
- Live stream contract: `external/hermes-agent/gateway/stream_events.py`
- Persistence authority: `external/hermes-agent/hermes_state.py`

## Two Distinct Contracts

Hermes deliberately separates live presentation events from persisted conversation history.

The gateway stream includes:

```text
MessageChunk
MessageStop
Commentary
ToolCallChunk
ToolCallFinished
LongToolHint
GatewayNotice
```

These events drive an in-flight UI. They are explicitly not the durable conversation transcript and must not be stored as independent messages.

Persisted history uses OpenAI-style message records with `role`, `content`, assistant `tool_calls`, tool `tool_call_id`, optional `tool_name`, and reasoning-related fields. This persisted list is the authority for history and resume.

The SQLite message schema at the pinned baseline also preserves insertion ID, session ID, timestamp, token count, finish reason, effect disposition, API-fidelity content, display kind/metadata, platform message identity, active/compacted state, and Codex-compatible reasoning/message sidecars. Insertion ID order is the durable ordering authority; timestamp order alone can misorder adjacent assistant tool-call and tool-result rows.

## Lifecycle

`MessageChunk` appends visible assistant content for the current message. `Commentary` is a distinct presentation channel and should remain separate from final answer content. `ToolCallChunk` assembles incremental tool name/arguments by call identity. `ToolCallFinished` settles the call. `MessageStop` settles the assistant message. Notices and long-tool hints are transient status UI.

Exact live event fields:

| Event | Fields | Persistence rule |
| --- | --- | --- |
| `MessageChunk` | incremental text | Accumulate active segment only |
| `MessageStop` | `final` flag | Close segment; final closes turn |
| `Commentary` | complete interim text | Separate commentary surface |
| `ToolCallChunk` | tool name, preview, full args, monotonic per-turn index | Start/update transient tool chrome |
| `ToolCallFinished` | tool name, seconds, success flag, same index | Settle chrome; output comes from history |
| `LongToolHint` | tool name and duration | One-shot gateway hint only |
| `GatewayNotice` | kind, default text, extra record | Transient gateway status |

The tool index correlates live start/finish within a turn; it is not a durable cross-reconnect tool ID. After reload, use persisted `tool_calls[].id` and `tool_call_id` instead.

After reconnect or history load, BirdCoder rebuilds from persisted messages and uses live events only for the active tail. It must not replay chunks into duplicate assistant rows.

## Tool Calls

Persisted assistant messages may contain multiple OpenAI-compatible tool calls. The following tool-role message references each call through `tool_call_id`. BirdCoder correlates these into compact tool rows, preserves raw arguments and outputs, and maps errors/lifecycle where Hermes exposes them.

`ToolCallFinished.ok` reports execution success but deliberately carries no output. Durable tool output, `tool_name`, effect disposition, and reasoning/message sidecars come from the state store. A UI must not replace durable output with the live preview or lose a failure because the gateway bubble disappeared.

MCP tools are not assumed from a string alone. When server/tool identity is present it is shown as `server / tool`; otherwise the original tool name remains canonical.

## Plans

Hermes has no required first-class plan event in the gateway stream. Plans may be emitted as commentary, assistant text, or structured todo/tool calls. Only structured recognized todo collections become `taskProgress`; commentary is never reclassified as a durable plan without provider evidence.

## History

The state layer owns conversation persistence, naming, retrieval, and resume. Canonical pagination is applied after ingestion when the provider API does not expose a native opaque cursor. Tool-call adjacency and role ordering must be preserved because they are part of the OpenAI-compatible conversation contract.

`get_messages_as_conversation` decodes rows in insertion order and restores tool calls, tool-call IDs/names, finish reason, reasoning, reasoning content/details, Codex reasoning/message items, platform IDs, display metadata, and exact `api_content`. `api_content` is provider replay fidelity and must never be shown instead of sanitized display `content`.

Compression chains and ancestor sessions can form one logical resumed conversation. The provider/session adapter resolves that lineage before Agents pagination. BirdCoder must not show each compressed storage segment as an unrelated chat or drop active descendant messages.

## Unknown Data Policy

Unknown live stream events become bounded lifecycle/diagnostic notices and are not persisted as content. Unknown durable non-system messages remain visibly represented. Internal prompt/state records do not become user-visible transcript rows.

## BirdCoder Checks

- Never conflate gateway stream events with persisted history.
- Assemble chunks by stable message/tool call identity.
- Settle content on `MessageStop` and tools on `ToolCallFinished`.
- Keep commentary separate from final assistant content.
- Preserve OpenAI-compatible tool-call ordering in history.

## Terminal And Error Mapping

- `MessageStop(final=false)` ends only one text segment around a tool boundary.
- `MessageStop(final=true)` closes live assistant delivery but durable history remains the reconnect authority.
- `ToolCallFinished(ok=false)` settles the live call as failed; the durable tool row supplies output/error details.
- Gateway notices and long-tool hints do not become assistant messages.
- Inactive/compacted rows and display metadata follow the state layer's projection rules rather than ad hoc client filtering.

## Conformance Checklist

- Keep presentation events and persisted OpenAI-style messages as separate contracts.
- Use live per-turn index only before durable tool IDs are available.
- Preserve insertion order, compression lineage, reasoning sidecars, and exact replay content.
- Correlate multiple assistant tool calls with their following tool-role records.
- Never persist or replay gateway hints/notices as conversation content.
