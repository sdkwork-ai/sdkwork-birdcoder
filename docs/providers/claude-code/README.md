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

## Content Blocks

Important blocks include `text`, `thinking`, `tool_use`, `tool_result`, server tool use/results, MCP tool use/results, and provider-specific extensions. A `tool_use` block owns an ID and input. Its matching `tool_result` references `tool_use_id`; it can carry text, structured content, images, and an error flag.

BirdCoder keeps thinking in the reasoning disclosure, text as assistant Markdown, and correlates tool use/results into one shared tool row. MCP names are presented as server/tool when that identity is available.

## Session And History

The provider session ID is the canonical resume key. Resume/fork operations must keep the returned provider identity rather than synthesize one. History reconstruction reads the provider's durable JSONL records and preserves their order. Stream events update in-flight items but are not replayed as duplicate durable messages.

## Plans And Interactions

Claude Code generally expresses task plans through TodoWrite/TodoRead-style tools rather than a Codex-style plan notification. BirdCoder recognizes those tool names and maps structured todo arrays to `taskProgress`.

Permission requests, hook responses, and user questions are lifecycle/interaction facts. They render as actionable or status UI and must not be flattened into assistant prose. Hook output stays correlated with the originating tool when `tool_use_id` is present.

## Unknown Data Policy

New content block and top-level record types must survive in bounded provider metadata. Unknown non-system blocks render through a generic fallback. System/developer prompt bodies remain hidden unless the provider explicitly marks content for the user.

## BirdCoder Checks

- Correlate `tool_use.id` with `tool_result.tool_use_id`.
- Do not render `result` as duplicate assistant content.
- Preserve thinking separately from final text.
- Keep hook, permission, and user-question states actionable.
- Use the generated/canonical SDK integration; do not add handwritten provider HTTP.
