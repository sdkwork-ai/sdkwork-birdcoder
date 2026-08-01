# Claude Code Protocol

## Baseline And Authority

- Product SDK: [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk)
- Published SDK baseline checked for this document: `0.3.220`
- Local adapter authority: `../sdkwork-kernel/agent-providers/crates/sdkwork-agent-provider-claude-code/src/provider_sessions.rs`

Claude Code is not vendored in `external/` for this repository. The local kernel adapter and the published Agent SDK are the compatibility authorities.

## Transport Records

Streaming/print mode emits JSONL records with top-level types including:

```text
system
assistant
user
result
stream_event
```

Records carry session identity and, where applicable, parent/tool correlation. `assistant` and `user` records contain Anthropic message content blocks. `result` is terminal lifecycle and usage metadata, not a second assistant response.

Durable Claude Code JSONL also encounters adapter/lifecycle records such as `attachment`, `queue-operation`, and `tool_use_summary`, plus `system` subtypes for hooks, permissions, and task progress. BirdCoder keeps their source `uuid`, `sessionId`, `parentUuid`, `isSidechain`, timestamp, type, and subtype when present.

| Record | Projection |
| --- | --- |
| `assistant` | Ordered assistant content blocks and provider error state |
| `user` | User content or tool-result blocks |
| `system` | Hidden internal system payload, or visible bounded hook/task lifecycle for recognized subtypes |
| `result` | Terminal status, usage, cost, duration, and error settlement |
| `stream_event` | Live delta for an existing identity only |
| `attachment` | Structured user resource/provider record |
| `queue-operation` | Adapter lifecycle, not assistant prose |
| `tool_use_summary` | Tool lifecycle summary correlated to its tool identity |

## Content Blocks

Important blocks include `text`, `thinking`, `tool_use`, `tool_result`, server tool use/results, MCP tool use/results, and provider-specific extensions. A `tool_use` block owns an ID and input. Its matching `tool_result` references `tool_use_id`; it can carry text, structured content, images, and an error flag.

The pinned local adapter recognizes this concrete block inventory:

| Request/content | Result/content |
| --- | --- |
| `tool_use`, `server_tool_use`, `mcp_tool_use` | `tool_result`, `mcp_tool_result` |
| `tool_progress` | `advisor_tool_result`, `tool_search_tool_result` |
| `text`, `thinking` | `web_fetch_tool_result`, `web_search_tool_result` |
| `image`, `document` | bash/code/text-editor code-execution tool results |

Unknown content blocks remain as bounded provider JSON rather than causing the entire message to disappear. `thinking` stays separate from `text`. Image/document and result media stay structured.

BirdCoder keeps thinking in the reasoning disclosure, text as assistant Markdown, and correlates tool use/results into one shared tool row. MCP names are presented as server/tool when that identity is available.

Tool result `is_error`/`isError` settles the call as failed. Progress remains pending/running. A result without displayable text still settles the call and must not allocate a blank transcript row.

## Session And History

The SDKWork canonical Session is identified by `sessionId`. Claude Code's
returned resume identity is stored unchanged as the opaque
`providerSessionId` on its runtime binding. The raw JSONL field named
`sessionId` is provider-wire evidence and maps to `providerSessionId`; it is not
the SDKWork `sessionId`. Resume and fork operations retain the returned
provider identity, and no layer may synthesize it from the canonical
`sessionId`.

History reconstruction reads the provider's durable JSONL records and
preserves their order. Stream events update in-flight items but are not
replayed as duplicate durable messages.

`uuid` or nested message ID is the preferred item identity. `parentUuid` expresses lineage; `tool_use.id`/`tool_result.tool_use_id` expresses call correlation. A deterministic line-derived ID is a last-resort history identity only when the record type has no ID. Sidechain records keep their lineage metadata so the UI can distinguish delegated work from the main response.

## Plans And Interactions

Claude Code generally expresses task plans through TodoWrite/TodoRead-style tools rather than a Codex-style plan notification. BirdCoder recognizes those tool names and maps structured todo arrays to `taskProgress`.

Permission requests, hook responses, and user questions are lifecycle/interaction facts. They render as actionable or status UI and must not be flattened into assistant prose. Hook output stays correlated with the originating tool when `tool_use_id` is present.

Recognized system lifecycle subtypes include `hook_started`, `hook_progress`, `hook_response`, `permission_denied`, `task_started`, `task_progress`, `task_updated`, and `task_notification`. Pending hook/task progress remains non-terminal; permission denial maps to cancelled/denied; response/notification records settle according to their explicit status/outcome.

## Unknown Data Policy

New content block and top-level record types must survive in bounded provider metadata. Unknown non-system blocks render through a generic fallback. System/developer prompt bodies remain hidden unless the provider explicitly marks content for the user.

## BirdCoder Checks

- Correlate `tool_use.id` with `tool_result.tool_use_id`.
- Do not render `result` as duplicate assistant content.
- Preserve thinking separately from final text.
- Keep hook, permission, and user-question states actionable.
- Use the generated/canonical SDK integration; do not add handwritten provider HTTP.

[`agentSessionProviderRealtimeEvents.test.ts`](../../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts)
independently verifies that an assistant `tool_use` and the matching user
`tool_result` content block become one settled canonical tool row. This fixture
does not prove complete JSONL history, reconnect, or credentialed provider E2E.

## Terminal And Error Mapping

- Assistant API error records become provider failures with bounded messages.
- `result` subtype/status is terminal authority for the run and carries usage; it is not rendered twice.
- Interrupted or missing tool results do not become completed tool calls.
- Hook failures and permission denial remain attached to the originating interaction when identity exists.
- Internal system/developer prompt bodies remain hidden even when their JSONL record is otherwise valid.

## Conformance Checklist

- Preserve record order, UUID/parent lineage, sidechain state, and timestamps.
- Correlate all request/result variants by tool identity.
- Keep reasoning, final text, resources, hooks, tasks, and terminal usage in separate channels.
- Rebuild reconnect history from durable JSONL, not cached `stream_event` deltas.
- Retain unknown non-secret blocks as bounded JSON so new SDK variants stay visible.
