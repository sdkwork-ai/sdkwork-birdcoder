# Hermes Agent Protocol

## Baseline And Authority

- Repository: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- Version: `0.19.0`
- Commit: `595a408f4028fb72e244ba818ddec2b7d92d670a`
- TUI JSON-RPC wire authority: `external/hermes-agent/tui_gateway/server.py`
- TUI event union: `external/hermes-agent/ui-tui/src/gatewayTypes.ts`
- In-process agent-to-gateway presentation contract: `external/hermes-agent/gateway/stream_events.py`
- OpenAI-compatible HTTP streams: `external/hermes-agent/gateway/platforms/api_server.py`
- Persistence authority: `external/hermes-agent/hermes_state.py`
- SQLite schema authority: `external/hermes-agent/hermes_state_common.py`
- Schema/search/portability mixins: `external/hermes-agent/hermes_state_schema.py`, `hermes_state_search.py`, and `hermes_state_portability.py`

## Three Distinct Contracts

Hermes deliberately separates the TUI JSON-RPC wire protocol, the in-process
agent-to-gateway presentation events, and persisted conversation history.

The Kernel opt-in transport starts `tui_gateway.entry`. Its observable event
wire authority is the JSON-RPC envelope emitted by `_event_frame`:

```json
{
  "jsonrpc": "2.0",
  "method": "event",
  "params": {
    "type": "tool.start",
    "session_id": "provider-session",
    "payload": {}
  }
}
```

The TUI event union includes `message.start/delta/interim/complete`,
`reasoning.delta/available`, `tool.generating/start/progress/complete`,
`status.update`, `clarify.request`, `approval.request`, `subagent.*`, and
`error`. `tool.start.payload.tool_id` and `tool.complete.payload.tool_id` are
the stable live correlation key. Completion may carry `args`, `result`,
`duration_s`, `summary`, `result_text`, `inline_diff`, and `error`; BirdCoder
normalizes these into one canonical tool row and converts seconds to
milliseconds.

BirdCoder unwraps the JSON-RPC envelope through `params.payload`; `params`
itself is transport metadata and is not treated as the event body. The
frontend projection follows these executable rules:

| Gateway event | Canonical projection |
| --- | --- |
| `message.delta` | Append raw `payload.text` in wire order, including repeated fragments and whitespace |
| `message.complete` | Use explicit `text` (then `rendered`) as the authoritative snapshot; do not append it after accumulated deltas |
| `message.interim` | Keep out of final content and reasoning; it requires a distinct canonical commentary item upstream |
| `reasoning.delta` | Append raw reasoning text in wire order |
| `reasoning.available` | Populate reasoning only when no delta reasoning has already arrived |
| `tool.start` | Correlate by `tool_id`; parse `args_text`, or retain `context` as live arguments and title |
| `tool.complete` | Settle the same `tool_id`; retain ordinary result, `result_text`, and `inline_diff` as separate result blocks |
| `clarify.request` | Use `request_id` as the question Interaction ID; preserve choices, multi-select when supplied, and custom answers |
| `clarify.expire` | Cancel the same question Interaction without losing its prompt or choices |
| `status.update(kind=compacting)` | Emit an automatic canonical `compacted` lifecycle event |
| `error` | Emit a failed lifecycle event with the provider message |
| `approval.request` | Fail closed because the pinned wire payload has no stable request ID |

No identity in this table is derived from the SDKWork `sessionId`.
Provider-side continuation remains the opaque `providerSessionId` binding.

The separate in-process `stream_events.py` contract includes:

```text
MessageChunk
MessageStop
Commentary
ToolCallChunk
ToolCallFinished
LongToolHint
GatewayNotice
```

Those dataclasses drive gateway presentation internally. They are not a
serialized discriminator contract, are explicitly not the durable conversation
transcript, and must not be stored as independent messages.

Persisted history uses OpenAI-style message records with `role`, `content`, assistant `tool_calls`, tool `tool_call_id`, optional `tool_name`, and reasoning-related fields. This persisted list is the authority for history and resume.

The SDKWork canonical Session is identified by `sessionId`. The
provider-returned resumable Hermes session ID selected after lineage resolution
is stored unchanged as the opaque `providerSessionId` on the runtime binding.
It never replaces `sessionId`, and it must never be synthesized from
`sessionId`.

The SQLite message schema at the pinned baseline also preserves insertion ID, session ID, timestamp, token count, finish reason, effect disposition, API-fidelity content, display kind/metadata, platform message identity, active/compacted state, and Codex-compatible reasoning/message sidecars. Insertion ID order is the durable ordering authority; timestamp order alone can misorder adjacent assistant tool-call and tool-result rows.

The pinned source mechanically splits schema, search, and portability responsibilities into mixins, but `SessionDB.get_messages_as_conversation` remains the durable conversation projection. The ownership move does not change the live event union or the insertion-order rule.

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

Hermes also exposes two OpenAI-compatible HTTP stream dialects. Streaming Chat
Completions emits `event: hermes.tool.progress` with `{ tool, toolCallId,
status }`: `running` includes label/emoji presentation and `completed` settles
the same ID. Streaming Responses emits `response.output_item.added` and
`response.output_item.done`; a `function_call` and its later
`function_call_output` correlate by `call_id`, not by their different item
`id` values. The output is an array such as
`[{ "type": "input_text", "text": "..." }]` and projects to text rather
than raw JSON.

The same OpenAI-compatible surface also serves non-streaming `llm.oneshot`
requests through the shared llm-core contract
(`external/openclaw/packages/llm-core/src/types.ts`). A oneshot response
carries the same assistant content, tool calls, reasoning, and finish-reason
shapes as one settled streaming turn and must be projected through the same
canonical Agents Session item pipeline instead of a second ad-hoc row shape;
it is a transport variant, never a new domain identity.

## Tool Calls

Persisted assistant messages may contain multiple OpenAI-compatible tool calls. The following tool-role message references each call through `tool_call_id`. BirdCoder correlates these into compact tool rows, preserves raw arguments and outputs, and maps errors/lifecycle where Hermes exposes them.

`agentSessionProviderToolHistory.test.ts` is the executable BirdCoder fixture
for this durable pair. It proves the assistant `tool_calls[].id` and following
tool-role `tool_call_id` become one canonical row with the request name and
arguments plus the durable result and terminal state.

`agentSessionProviderRealtimeEvents.test.ts` separately verifies the real TUI
JSON-RPC `tool.start`/`tool.complete` envelope, selected `hermes.tool.progress`
and direct lifecycle wrappers, plus OpenAI Responses
`function_call`/`function_call_output` correlation. The Hermes case in
`message-presentation.spec.ts` verifies the durable pair reaches Work Mode as
one expandable MCP `server / tool` row, preserves structured arguments and a
natural result, and does not overflow at 900 px. These tests do not cover the
complete gateway event union or a credentialed Hermes runtime.

`ToolCallFinished.ok` reports execution success but deliberately carries no output. Durable tool output, `tool_name`, effect disposition, and reasoning/message sidecars come from the state store. A UI must not replace durable output with the live preview or lose a failure because the gateway bubble disappeared.

MCP tools are not assumed from a string alone. When server/tool identity is present it is shown as `server / tool`; otherwise the original tool name remains canonical.

## Plans

Hermes has no required first-class plan event in the gateway stream. Plans may be emitted as commentary, assistant text, or structured todo/tool calls. Only structured recognized todo collections become `taskProgress`; commentary is never reclassified as a durable plan without provider evidence.

## History

The state layer owns conversation persistence, naming, retrieval, and resume. Canonical pagination is applied after ingestion when the provider API does not expose a native opaque cursor. Tool-call adjacency and role ordering must be preserved because they are part of the OpenAI-compatible conversation contract.

`get_messages_as_conversation` decodes rows in insertion order and restores tool calls, tool-call IDs/names, finish reason, reasoning, reasoning content/details, Codex reasoning/message items, platform IDs, display metadata, and exact `api_content`. `api_content` is provider replay fidelity and must never be shown instead of sanitized display `content`.

Compression chains and ancestor sessions can form one logical resumed conversation. The provider/session adapter resolves that lineage before Agents pagination. BirdCoder must not show each compressed storage segment as an unrelated chat or drop active descendant messages.

## Runtime Readiness Gate

The Kernel Hermes TUI gateway worker is a full JSON-RPC client of the
official `tui_gateway.entry` channel used by the Hermes desktop and TUI
applications: `session.create`/`session.resume` -> `prompt.submit` -> the
`message.start`/`message.delta`/`message.complete` event stream, with
`reasoning.delta`, `tool.start`/`tool.complete`, `status.update`, and the
blocking interaction events (`approval.request`, `clarify.request`,
`sudo.request`, `secret.request`) resolved through the kernel interaction
registry (`sdkwork/serverRequest.respond` -> `approval.respond`/`clarify.respond`).
Streaming turns emit kernel stream frames (`stream.chunk`/`stream.event`/
`stream.done`) with the persistent `stored_session_id` as the provider session
identity for resumption, and per-request model selection is supported through
`session.create`'s `model` parameter.

Live tool, approval, and Interaction events are forwarded as canonical kernel
events; the Agents terminal-item projector consumes those lifecycle events.
Lineage-aware history reconciliation and a credentialed
send/stream/tool/error/reconnect E2E remain the outstanding product items.

`message.interim` remains a distinct commentary channel and must not be folded
into final content or reasoning. `clarify.request` has a stable `request_id` and
can be translated to a canonical question Interaction. `approval.request` has
no stable request ID at this baseline, so an adapter must fail closed rather
than invent a durable Interaction identity.

## Unknown Data Policy

Unknown live stream events become bounded lifecycle/diagnostic notices and are not persisted as content. Unknown durable non-system messages remain visibly represented. Internal prompt/state records do not become user-visible transcript rows.

## BirdCoder Checks

- Never conflate gateway stream events with persisted history.
- Assemble chunks by stable message/tool call identity.
- Settle content on `MessageStop` and tools on `ToolCallFinished`.
- Keep commentary separate from final assistant content.
- Correlate TUI tool frames by `payload.tool_id`; do not derive a tool identity
  from array position or the canonical `sessionId`.
- Preserve OpenAI-compatible tool-call ordering in history.
- Run `agentSessionProviderToolHistory.test.ts` for durable request/result
  correlation and `agentSessionProviderRealtimeEvents.test.ts` for both
  provider stream dialects, direct lifecycle wrappers, structured text output,
  and stable `call_id` result correlation.
- Run the OpenClaw/Hermes case in `message-presentation.spec.ts` for final Work
  Mode MCP presentation and narrow-width containment.

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
