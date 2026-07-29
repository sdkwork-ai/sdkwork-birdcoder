# OpenCode Protocol

## Baseline And Authority

- Repository: [anomalyco/opencode](https://github.com/anomalyco/opencode)
- Version: `1.18.9`
- Commit: `7565e03536d19e850f9996c407f9bf5e932b5f7a`
- Message authority: `external/opencode/packages/opencode/src/session/message-v2.ts`
- HTTP schema: `external/opencode/packages/sdk/openapi.json`

## Model

OpenCode stores a message `info` record and an ordered collection of `parts`. User and assistant info records have distinct fields, while part types carry text, reasoning, tools, files, steps, snapshots, patches, retry/compaction metadata, and provider-specific extensions.

The BirdCoder session maps to an OpenCode session. OpenCode message IDs map to canonical item/message identities; part IDs remain child identities and must not be flattened in a way that loses their ordering or lifecycle.

## Events And Authority

The event stream publishes full replacements and deltas:

```text
message.updated
message.removed
message.part.updated
message.part.delta
message.part.removed
```

`message.part.updated` is the current full part snapshot. `message.part.delta` applies to a declared field of the same part identity. Removal events are authoritative deletions. Repeated events must be idempotent.

## History And Pagination

Message history uses an opaque cursor encoding `{id,time}` and a `before` boundary. A page returns ordered messages with parts, a `more` flag, and the next cursor. Consumers must pass the returned cursor unchanged and continue until `more` is false. They must not convert cursor history into offset assumptions.

## Tool Lifecycle

Tool parts have explicit states. The current source uses AI SDK-style lifecycle states including `input-streaming`, `input-available`, `output-available`, and `output-error`; compatibility input also encounters provider-facing `pending`, `running`, `completed`, and `error` forms. Important fields include call ID, tool name, input, output/error, timing, metadata, and attachments.

BirdCoder maps all of these to one tool call identity and normalizes lifecycle to pending/running/success/error/cancelled. Tool attachments become resources. MCP names such as `mcp__server__tool` are split only for presentation; the original name and payload remain available.

## Plans And Interactions

OpenCode exposes step-oriented parts and commonly represents todo plans through todo tools. BirdCoder recognizes `todo_read`, `todo_write`, `update_plan`, and related names, then maps `items`, `todos`, `tasks`, `plan`, or `steps` to `taskProgress`. Permission and question flows are actionable interactions rather than ordinary tool output.

## Unknown Data Policy

New part kinds are retained as bounded provider data and rendered as a generic visible item unless they are explicitly internal/system context. Never drop an entire message because one part kind is unknown. Never treat transient deltas as independent durable history rows.

## BirdCoder Checks

- Preserve `info` and ordered `parts` until normalization.
- Correlate updates by session, message, and part ID.
- Keep the `before` cursor opaque.
- Project tool state and attachments through the shared tool/resource UI.
- Prefer the final part snapshot after streamed deltas.
