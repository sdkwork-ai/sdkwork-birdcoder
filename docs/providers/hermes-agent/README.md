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

## Lifecycle

`MessageChunk` appends visible assistant content for the current message. `Commentary` is a distinct presentation channel and should remain separate from final answer content. `ToolCallChunk` assembles incremental tool name/arguments by call identity. `ToolCallFinished` settles the call. `MessageStop` settles the assistant message. Notices and long-tool hints are transient status UI.

After reconnect or history load, BirdCoder rebuilds from persisted messages and uses live events only for the active tail. It must not replay chunks into duplicate assistant rows.

## Tool Calls

Persisted assistant messages may contain multiple OpenAI-compatible tool calls. The following tool-role message references each call through `tool_call_id`. BirdCoder correlates these into compact tool rows, preserves raw arguments and outputs, and maps errors/lifecycle where Hermes exposes them.

MCP tools are not assumed from a string alone. When server/tool identity is present it is shown as `server / tool`; otherwise the original tool name remains canonical.

## Plans

Hermes has no required first-class plan event in the gateway stream. Plans may be emitted as commentary, assistant text, or structured todo/tool calls. Only structured recognized todo collections become `taskProgress`; commentary is never reclassified as a durable plan without provider evidence.

## History

The state layer owns conversation persistence, naming, retrieval, and resume. Canonical pagination is applied after ingestion when the provider API does not expose a native opaque cursor. Tool-call adjacency and role ordering must be preserved because they are part of the OpenAI-compatible conversation contract.

## Unknown Data Policy

Unknown live stream events become bounded lifecycle/diagnostic notices and are not persisted as content. Unknown durable non-system messages remain visibly represented. Internal prompt/state records do not become user-visible transcript rows.

## BirdCoder Checks

- Never conflate gateway stream events with persisted history.
- Assemble chunks by stable message/tool call identity.
- Settle content on `MessageStop` and tools on `ToolCallFinished`.
- Keep commentary separate from final assistant content.
- Preserve OpenAI-compatible tool-call ordering in history.
