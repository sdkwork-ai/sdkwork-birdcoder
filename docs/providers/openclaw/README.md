# OpenClaw Protocol

## Baseline And Authority

- Repository: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- Version: `2026.7.2`
- Commit: `819961a292dc224d57bc110dd8c6d8364709de13`
- Gateway package: `external/openclaw/packages/gateway-protocol/`
- Frame schemas: `packages/gateway-protocol/src/schema/frames.ts`
- Chat/log schemas: `packages/gateway-protocol/src/schema/logs-chat.ts`
- Session schemas: `packages/gateway-protocol/src/schema/sessions.ts`
- Agent schemas: `packages/gateway-protocol/src/schema/agent.ts`
- Display projection: `external/openclaw/src/gateway/chat-display-projection.ts`

## Transport

The Gateway protocol uses typed request, response, and event frames over its connection. Requests carry an ID, method, and params; responses correlate by ID and contain either a result or structured error; events carry an event name, payload, and sequence/state metadata where declared by the schema.

Frame sequencing is transport authority. Consumers must not assume every event is a chat message or persist connection-local notices as transcript history.

## Sessions And Chat

Session inventory, session history, live agent execution, and chat delivery are separate protocol concerns. A session key identifies a conversation across reconnects. History methods establish durable transcript authority; chat/agent events update the live projection.

OpenClaw's display projection deliberately converts raw model/tool records to user-visible chat content. BirdCoder should preserve the same separation: ingest durable source records in the kernel/Agents layer, then apply BirdCoder presentation without rewriting source facts.

## Message And Tool Shape

History records follow role/content semantics and may contain structured blocks, tool calls, tool results, attachments, and agent lifecycle information. Tool calls correlate through call IDs. Gateway logs and notices are operational records, not automatically assistant messages.

BirdCoder maps text to `content`, tools to `tool_calls`, attachments/media to `resources`, and actionable permission/question states to interactions. Tool output is bounded and disclosed on demand.

## Plans

OpenClaw does not impose Codex's `turn/plan/updated` shape across all connected agents. Provider/agent plan or todo tools are normalized only when they carry a recognized structured collection and step statuses. Otherwise their data remains a normal tool result.

## History And Reconnect

- Load durable session history before relying on live events.
- Track gateway sequence/state values exactly as declared.
- On reconnect or detected gaps, re-read history rather than guessing missing events.
- Deduplicate history and live projection by stable message/tool identity.
- Do not persist transient gateway notices as conversation messages.

## Unknown Data Policy

Unknown frame methods and event names are retained as bounded diagnostic metadata. Unknown user-visible history records receive a generic presentation; secrets, internal prompts, and transport-only frames fail closed.

## BirdCoder Checks

- Validate request/response/event frame discrimination.
- Keep session history and live chat projection separate.
- Preserve gateway sequence and stable session keys.
- Reconcile tool request/result records by call ID.
- Compare changes against the display-projection tests as well as schemas.
