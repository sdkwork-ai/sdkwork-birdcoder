# Gemini CLI Protocol

## Baseline And Authority

- Repository: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- Version: `0.55.0-nightly.20260728.gd29268d36`
- Commit: `3499c84f7b8e70c86600e7cd2c67a7c65a667f5e`
- Stream types: `external/gemini/packages/core/src/output/types.ts`
- JSONL formatter: `external/gemini/packages/core/src/output/stream-json-formatter.ts`
- Internal turn events: `external/gemini/packages/core/src/core/turn.ts`
- Tool scheduler states: `external/gemini/packages/core/src/scheduler/types.ts`

## Runtime Events

The internal runtime reports typed events such as content, tool call requests, tool results/confirmation paths, errors, and `Finished`. Finished states distinguish normal completion from blocked, stopped, cancelled, and error outcomes.

Machine-readable stream JSON is JSONL. Its public records include initialization/session metadata, assistant or user `message` records, `tool_call`, `tool_result`, `error`, and terminal `result` records. A stream record is transport output, not automatically a durable history page.

The exact public stream union at the pinned baseline is:

| Record | Key fields | Rule |
| --- | --- | --- |
| `init` | timestamp, session ID, model | Establish runtime identity; not a chat row |
| `message` | role, content, optional `delta` | Accumulate/replace the correlated message |
| `tool_use` | tool ID/name/parameters | Start one tool row |
| `tool_result` | tool ID, success/error, output/error | Settle the matching row |
| `error` | warning/error severity and message | Warning lifecycle or failure evidence |
| `result` | success/error and usage stats | Terminal authority; never duplicate assistant content |

The internal `GeminiEventType` union is richer: `content`, `thought`, tool request/response/confirmation, `finished`, `citation`, retry, cancellation, chat compression, loop detection, max turns, context overflow, invalid stream, model info, and agent execution stopped/blocked. Adapters that consume the internal runtime must preserve those distinctions even though the public JSONL surface is smaller.

## Hierarchy And Identity

Gemini CLI exposes a provider session/conversation context with ordered content
and tool exchanges. The SDKWork canonical Session is identified by
`sessionId`; the provider-returned continuation identity, including the raw
stream `init` session ID when it is the resume authority, is stored unchanged
as `providerSessionId`. It never replaces `sessionId`, and it must never be
synthesized from `sessionId`.

BirdCoder groups a user request and completion into a canonical Turn when
correlation exists and uses provider call IDs for tool Session Item identity.

Text chunks for the same assistant response are accumulated in order. The terminal result settles status and usage; it does not become duplicate assistant text when the message content has already been emitted.

`Finished` can occur at an intermediate model boundary before scheduled tool results are fed back. It settles that model response, not necessarily the entire agentic turn. The owning session runner determines whether pending tool calls require another model iteration before emitting the canonical turn completion.

## Tool Calls

`ToolCallRequest`/`tool_call` carries the call ID, name, and arguments. The matching result carries the same call ID, output/error, and outcome. Confirmation-required calls remain pending interactions until resolved. BirdCoder renders one compact tool row per call and attaches the final result to that row.

Scheduler states normalize as follows:

| Gemini state | Canonical state |
| --- | --- |
| `validating`, `scheduled`, `awaiting_approval` | pending |
| `executing` | running |
| `success` | completed |
| `error` | failed |
| `cancelled` | cancelled |

Requests may include original name/arguments, parent call ID, prompt/trace/scheduler IDs, checkpoint, display hints, and hook-modification markers. Responses may include structured response parts, display output, error type, output file, content length, and structured data. These fields remain correlated by `callId`; `resultDisplay` is presentation data, not a substitute for the durable response parts.

Gemini tools may represent file, shell, search, web, media, or MCP-like work. Classification is presentation-only and must not discard the original name or arguments.

Tool confirmation is an interaction state. It must remain actionable and must not be displayed as a successful result before the confirmation outcome and scheduler settlement arrive.

## Plans

Gemini CLI does not require a universal first-class plan notification. Planning commonly appears through todo/write-todos tools or structured provider payloads. BirdCoder normalizes recognized collections (`items`, `todos`, `tasks`, `plan`, `steps`) and status spellings into `taskProgress`; unrecognized plan-shaped text remains assistant content.

## History

Do not rebuild complete history solely from live JSONL output. Use the provider/session adapter's persisted conversation source and its native continuation/resume identity. If no native pagination token is exposed, pagination is owned by the canonical Agents store after ingestion.

Persisted Gemini content is ordered model/user `Content` with function-call and function-response parts. After ingestion, Agents pagination is the only client-facing continuation contract; BirdCoder must not replay CLI stdout to fill historical gaps.

## Unknown Data Policy

Unknown stream events are retained in bounded diagnostic/provider metadata. Unknown non-system durable records receive a generic visible presentation. Internal prompt/config records are not rendered as user messages.

## BirdCoder Checks

- Preserve call ID correlation across request, confirmation, and result.
- Treat `Finished` as lifecycle authority, not content.
- Deduplicate final message content from the terminal result.
- Normalize blocked/stopped/error states without treating them as success.
- Keep media and file outputs structured.

[`agentSessionProviderRealtimeEvents.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts)
independently verifies that public stream-json `tool_use` and `tool_result`
records merge by `tool_id` while retaining request parameters and terminal
output. It does not prove the complete internal event union, history, reconnect,
or credentialed provider E2E.

## Terminal And Error Mapping

| Internal event | Canonical behavior |
| --- | --- |
| `UserCancelled` | Cancel active turn/tool states |
| `Error`, `InvalidStream` | Fail the correlated response with visible bounded error |
| `AgentExecutionStopped` | Terminal stopped/cancelled state with reason |
| `AgentExecutionBlocked` | Blocked interaction/lifecycle, not success |
| `MaxSessionTurns`, `LoopDetected` | Bounded lifecycle warning; terminal only when runner stops |
| `ContextWindowWillOverflow`, `ChatCompressed` | Context/compaction lifecycle |
| `Retry` | Transient retry status, not a duplicate message |
| `Citation` | Structured citation/evidence attached to the response |

## Conformance Checklist

- Public JSONL and internal runtime events are documented and normalized separately.
- Intermediate `Finished` events do not prematurely complete a tool-using turn.
- Confirmation, hook changes, parent calls, and structured tool output survive correlation.
- Cancellation, blocked, stopped, invalid-stream, and error outcomes never map to success.
- Live deltas do not become a replacement for persisted conversation history.
