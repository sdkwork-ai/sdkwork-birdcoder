# OpenClaw Protocol

## Baseline And Authority

- Repository: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- Version: `2026.7.2`
- Commit: `ff72f287c37e21b233bc919ae2ceda5fc8005e13`
- Gateway package: `external/openclaw/packages/gateway-protocol/`
- Frame schemas: `packages/gateway-protocol/src/schema/frames.ts`
- Chat/log schemas: `packages/gateway-protocol/src/schema/logs-chat.ts`
- Session schemas: `packages/gateway-protocol/src/schema/sessions.ts`
- Viewer-presence schema: `packages/gateway-protocol/src/schema/sessions-viewer-presence.ts`
- Agent schemas: `packages/gateway-protocol/src/schema/agent.ts`
- Approval schemas: `packages/gateway-protocol/src/schema/approvals.ts`
- Durable model message authority: `external/openclaw/packages/llm-core/src/types.ts`
- Live tool event authority: `external/openclaw/src/agents/embedded-agent-subscribe.handlers.tools.ts`
- Bundle MCP identity authority: `external/openclaw/src/agents/agent-bundle-mcp-names.ts`
- Display projection: `external/openclaw/src/gateway/chat-display-projection.ts`
- History paging: `external/openclaw/src/gateway/server-methods/chat-history-pages.ts`

## Transport

The Gateway protocol uses typed request, response, and event frames over its connection. Requests carry an ID, method, and params; responses correlate by ID and contain either a result or structured error; events carry an event name, payload, and sequence/state metadata where declared by the schema.

Frame sequencing is transport authority. Consumers must not assume every event is a chat message or persist connection-local notices as transcript history.

The top-level frame discriminator is exact:

| `type` | Correlation/state fields | Meaning |
| --- | --- | --- |
| `req` | request `id`, method, params, optional traceparent | Client RPC request |
| `res` | same `id`, `ok`, payload or structured error | RPC settlement |
| `event` | event name, payload, optional `seq` and `stateVersion` | Server-pushed state change |

The initial `hello-ok` response negotiates protocol version, advertised methods/events/capabilities, snapshot, connection identity, auth scopes, and payload/buffer/tick policy. Clients use advertised capabilities rather than assuming a method exists from the server version alone.

## Sessions And Chat

Session inventory, session history, live agent execution, and chat delivery are separate protocol concerns. A session key identifies a conversation across reconnects. History methods establish durable transcript authority; chat/agent events update the live projection.

The SDKWork canonical Session is identified by `sessionId`. The OpenClaw
`sessionKey` is provider-wire identity and is stored unchanged as the opaque
`providerSessionId` on the runtime binding. It never replaces the canonical
`sessionId`, and no adapter may synthesize it from `sessionId`.

OpenClaw's display projection deliberately converts raw model/tool records to user-visible chat content. BirdCoder should preserve the same separation: ingest durable source records in the kernel/Agents layer, then apply BirdCoder presentation without rewriting source facts.

`sessions.viewers.set` replaces the set of sessions currently rendered by one gateway connection. It accepts at most 32 session keys, canonicalizes them through the session store, and returns the retained canonical keys. Viewer presence is connection-local observation state: it can govern live fan-out, but it is not a message, read receipt, or durable history cursor. Session creator metadata may also include a durable profile `avatarUrl`; that field decorates identity and does not become message content.

## Chat Run Events

Every chat event includes `runId`, `sessionKey`, optional agent/spawn identity, and a monotonically increasing per-run `seq`.

| State | Fields | Canonical behavior |
| --- | --- | --- |
| `status` | startup phase | Transient preparing/provisioning/context/model status |
| `delta` | `deltaText`, optional full message replacement, usage | Patch the active assistant identity; honor `replace` |
| `final` | optional message/usage/stop reason/yielded | Successful terminal snapshot |
| `aborted` | optional message/error/stop reason | Cancelled terminal state |
| `error` | message/error kind/usage/stop reason | Failed terminal state |

Startup phases are `preparing_workspace`, `provisioning_environment`, `preparing_context`, and `starting_model`. Error kinds are `refusal`, `timeout`, `rate_limit`, `context_length`, and `unknown`. An `agent` gateway event has its own run ID, sequence, stream name, timestamp, heartbeat marker, and data record; it is not automatically a chat message.

The exact `AgentEvent` envelope is `{ runId, seq, stream, ts, data }` with
optional spawn and heartbeat fields. For `stream: "tool"`, the stable
correlation key is `data.toolCallId`:

| `data.phase` | Tool fields | Canonical behavior |
| --- | --- | --- |
| `start` | `name`, `toolCallId`, sanitized `args` | Create one running tool activity. |
| `update` | same identity, `partialResult` | Patch that activity and retain the latest bounded preview. |
| `result` | same identity, `result`, `isError`, optional error summary | Settle the same activity; retain partial output when the terminal body is absent. |

OpenClaw bundle MCP names use `server__tool` on this provider boundary. The
OpenClaw adapter alone may split that form into canonical `serverName` and tool
name; providers that do not declare this convention must not be reclassified
by the same string heuristic.

## Message And Tool Shape

The durable model message union is exact at this baseline: assistant content
contains `{ type: "toolCall", id, name, arguments }` blocks, and the correlated
result is a `{ role: "toolResult", toolCallId, toolName, content, isError }`
message. BirdCoder preserves this native shape at the adapter boundary, then
projects request and result into one canonical tool row keyed by the call ID.
Gateway logs and notices are operational records, not automatically assistant
messages.

`chat.send` includes session/agent identity, user message, optional attachments, thinking/fast/queue modes, delivery routing, reply target, expected branch leaf/routing contract, timeout, and an idempotency key. Retry uses the same idempotency key. Stale `expectedLeafEntryId` is a branch conflict, not a new user message.

BirdCoder maps text to `content`, tools to `tool_calls`, attachments/media to `resources`, and actionable permission/question states to interactions. Tool output is bounded and disclosed on demand.

`agentSessionProviderRealtimeEvents.test.ts` exercises the implemented
projection for tool start/update/result frames, partial output followed by a
terminal error, `session.approval` transitions, and legacy exec approval
wrappers. `message-presentation.spec.ts` then carries provider-native durable
tool history through the owner SDK fixture into Work Mode, where request/result
pairs become natural expandable success and failure rows. These are executable
adapter and mock E2E facts; they do not claim gateway connection, reconnect, or
credentialed-provider coverage.

## Approvals And Interaction Continuation

The current session-scoped approval event is `session.approval`. Its payload
contains `sessionKey`, optional `sourceSessionKey`, `updatedAtMs`, a `pending`
or `terminal` phase, and an approval snapshot. Snapshot status is `pending`,
`allowed`, `denied`, `expired`, or `cancelled`; presentation kind is `exec`,
`plugin`, or `system-agent`, and provider-declared `allowedDecisions` are the
UI authority. The older `exec.approval.requested` and
`exec.approval.resolved` frames remain compatibility inputs.

BirdCoder merges transitions by the exact approval ID. Pending maps to a
canonical Interaction with `requiresResponse: true`; `allow-once` and
`allow-always` settle it as approved, while `deny` settles it as denied. The
frontend may render only the canonical Interaction continuation exposed by
Agents. It must never call an OpenClaw gateway directly or fabricate a
provider approval response from a raw display event.

## Plans

OpenClaw does not impose Codex's `turn/plan/updated` shape across all connected agents. Provider/agent plan or todo tools are normalized only when they carry a recognized structured collection and step statuses. Otherwise their data remains a normal tool result.

OpenClaw does expose observer-level `planProgress` as `{completed,total}` in `SessionObserverDigest`, alongside revision, health, headline, and assessment. This is session summary state, not the ordered plan text. BirdCoder may use it for session badges/progress counts but must not invent missing step labels. Observer health values include on-track, grinding, stuck, waiting-on-user, wrapping-up, done, and failed.

## History And Reconnect

`chat.history` is offset-based at this baseline. Request fields include `sessionKey`, optional agent/session identity, `limit` (maximum 1000), `offset`, optional anchor `messageId`, and `maxChars`. Normal responses include projected `messages` plus paging metadata:

```text
pagination.offset
pagination.totalMessages
pagination.rawPageMessages
pagination.exhausted?
responseOffset?
activeLeafEntryId?
```

Anchored `messageId` reads intentionally omit numeric paging metadata because the anchor may resolve a reset-archive transcript. Imported CLI history can return `completeCliImport: true` and an exhausted full-page result. History projection may emit explicit oversized/unavailable sentinels under its byte budget; these are visible diagnostic records, not silent data loss.

- Load durable session history before relying on live events.
- Advance numeric history using returned offset/raw-page counts until exhausted or total reached.
- Track gateway event sequence/state values exactly as declared.
- On reconnect or a sequence gap, re-read history rather than guessing events.
- Deduplicate history and live projection by stable message/tool identity.
- Do not persist transient gateway notices, observer summaries, or heartbeats as messages.
- Re-declare `sessions.viewers.set` after reconnect when live session observation is needed; never restore it from transcript history.

## Runtime Readiness Gate

The current Kernel OpenClaw live handler in
`../sdkwork-kernel/scripts/provider-transport-workers/engine-sdk-live.mjs`
performs a non-streaming Chat Completions request and converts non-Codex stream
requests from the completed response. It does not yet subscribe to OpenClaw
`AgentEvent` or approval streams. The current Agents terminal-item projector
accepts canonical `item.started`, `item.updated`, and `item.completed` events;
it does not translate a raw OpenClaw approval into a canonical Interaction.

Consequently, the BirdCoder fixtures prove projection and display fallback,
not a live actionable approval round trip. Completion requires Kernel to emit
canonical tool lifecycle and Interaction events, Agents to persist/reconcile
them by canonical Session plus provider correlation IDs, and a credentialed
send/stream/approve/deny/reconnect E2E. Until those gates pass, real-provider
parity remains explicitly pending.

## Unknown Data Policy

Unknown frame methods and event names are retained as bounded diagnostic metadata. Unknown user-visible history records receive a generic presentation; secrets, internal prompts, and transport-only frames fail closed.

## BirdCoder Checks

- Validate request/response/event frame discrimination.
- Keep session history and live chat projection separate.
- Preserve gateway sequence and stable session keys.
- Reconcile tool request/result records by call ID.
- Compare changes against the display-projection tests as well as schemas.
- Run `agentSessionProviderToolHistory.test.ts` for provider-native durable
  `toolCall`/`toolResult` success, failure, and merge behavior.
- Run `agentSessionProviderRealtimeEvents.test.ts` for live tool lifecycle,
  bundle MCP identity, partial output plus terminal error, and approval
  transitions.
- Run the OpenClaw/Hermes case in `message-presentation.spec.ts` for final Work
  Mode disclosure, natural result, and desktop-width behavior.

## Conformance Checklist

- Negotiate capabilities from `hello-ok` and correlate RPC responses by ID.
- Reconcile `status`/`delta`/`final`/`aborted`/`error` by run/session/sequence.
- Honor delta replacement, active branch leaf, and chat-send idempotency semantics.
- Preserve offset, raw-page count, total, anchor, CLI-import, and byte-budget history behavior.
- Keep observer plan counts distinct from ordered task steps.
- Keep connection-local viewer presence distinct from session history and message-read state.
- Apply OpenClaw display sanitization and projection rules before BirdCoder presentation.
