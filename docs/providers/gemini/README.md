# Gemini CLI Protocol

## Baseline And Authority

- Repository: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- Version: `0.55.0-nightly.20260728.gd29268d36`
- Commit: `3499c84f7b8e70c86600e7cd2c67a7c65a667f5e`
- Stream types: `external/gemini/packages/core/src/output/types.ts`
- JSONL formatter: `external/gemini/packages/core/src/output/stream-json-formatter.ts`

## Runtime Events

The internal runtime reports typed events such as content, tool call requests, tool results/confirmation paths, errors, and `Finished`. Finished states distinguish normal completion from blocked, stopped, cancelled, and error outcomes.

Machine-readable stream JSON is JSONL. Its public records include initialization/session metadata, assistant or user `message` records, `tool_call`, `tool_result`, `error`, and terminal `result` records. A stream record is transport output, not automatically a durable history page.

## Hierarchy And Identity

Gemini CLI exposes a session/conversation context with ordered content and tool exchanges rather than Codex's explicit Thread/Turn/Item API. BirdCoder maps the provider session to a canonical Session, groups a user request and completion into a Turn when correlation exists, and uses provider call IDs for tool item identity.

Text chunks for the same assistant response are accumulated in order. The terminal result settles status and usage; it does not become duplicate assistant text when the message content has already been emitted.

## Tool Calls

`ToolCallRequest`/`tool_call` carries the call ID, name, and arguments. The matching result carries the same call ID, output/error, and outcome. Confirmation-required calls remain pending interactions until resolved. BirdCoder renders one compact tool row per call and attaches the final result to that row.

Gemini tools may represent file, shell, search, web, media, or MCP-like work. Classification is presentation-only and must not discard the original name or arguments.

## Plans

Gemini CLI does not require a universal first-class plan notification. Planning commonly appears through todo/write-todos tools or structured provider payloads. BirdCoder normalizes recognized collections (`items`, `todos`, `tasks`, `plan`, `steps`) and status spellings into `taskProgress`; unrecognized plan-shaped text remains assistant content.

## History

Do not rebuild complete history solely from live JSONL output. Use the provider/session adapter's persisted conversation source and its native continuation/resume identity. If no native pagination token is exposed, pagination is owned by the canonical Agents store after ingestion.

## Unknown Data Policy

Unknown stream events are retained in bounded diagnostic/provider metadata. Unknown non-system durable records receive a generic visible presentation. Internal prompt/config records are not rendered as user messages.

## BirdCoder Checks

- Preserve call ID correlation across request, confirmation, and result.
- Treat `Finished` as lifecycle authority, not content.
- Deduplicate final message content from the terminal result.
- Normalize blocked/stopped/error states without treating them as success.
- Keep media and file outputs structured.
