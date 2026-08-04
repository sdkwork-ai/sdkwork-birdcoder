# Provider Message Protocols

This directory records the provider-native message contracts that BirdCoder must preserve and the projection rules used to render them consistently. It is a compatibility reference, not a replacement for provider source code or SDK types.

## Baselines

| Provider | Baseline | Local authority |
| --- | --- | --- |
| [Codex](codex/README.md) | source commit `a05bcda3dbd68729caa2f11027b7f43974fda298` | `external/codex/` |
| [OpenCode](opencode/README.md) | `1.18.9`, commit `a6f7fe739c691e8b086c50390cf3205f0b5d431e` | `external/opencode/` |
| [Gemini CLI](gemini/README.md) | `0.55.0-nightly.20260728.gd29268d36`, commit `3499c84f7b8e70c86600e7cd2c67a7c65a667f5e` | `external/gemini/` |
| [Claude Code](claude-code/README.md) | Agent SDK `0.3.220` | kernel adapter plus published SDK contract |
| [OpenClaw](openclaw/README.md) | `2026.7.2`, commit `ff72f287c37e21b233bc919ae2ceda5fc8005e13` | `external/openclaw/` |
| [Hermes Agent](hermes-agent/README.md) | `0.19.0`, commit `595a408f4028fb72e244ba818ddec2b7d92d670a` | `external/hermes-agent/` |

## Work Mode Distribution And Installation

BirdCoder Work Mode has a fixed Work Provider allowlist. Its new-task menu
always displays OpenClaw (`openclaw` / `agent.openclaw`) and
Hermes Agent (`hermes` / `agent.hermes`) at tier
`t2-autonomous`. Display does not mean installed: only the generated Agents
App SDK catalog can declare a Provider available, and it must publish the exact
engine id, Agent id, tier, and a usable model.

| Provider | Official Windows installer | Official Unix installer | Installed baseline | Noninteractive constraint |
| --- | --- | --- | --- | --- |
| OpenClaw | `https://openclaw.ai/install.ps1` | `https://openclaw.ai/install.sh` | `2026.7.2` | no prompt; onboarding deferred |
| Hermes Agent | `https://hermes-agent.nousresearch.com/install.ps1` | `https://hermes-agent.nousresearch.com/install.sh` | commit `cff9728587da4f3c0beed0786f9bea528e489f13` | noninteractive; setup deferred |

One-click installation is a BirdCoder desktop capability. The component sends
only `openclaw` or `hermes`; infrastructure selects the fixed shell profile,
official HTTPS authority, pinned baseline, and arguments. Unknown ids are
rejected before `desktop_local_shell_exec`, and browser mode reports that the
desktop app is required. A zero installer exit triggers an Agents catalog
refresh but does not fabricate catalog availability. If the owning runtime has
not published the exact Provider identity, the Provider remains unavailable
until refresh or restart resolves it.

The normative machine contract is
[`../../specs/agents-birdcoder-alignment.spec.json`](../../specs/agents-birdcoder-alignment.spec.json).

## Canonical BirdCoder Model

The canonical persisted hierarchy is:

```text
Project
  Session
    Turn
      Session Item
```

`sdkwork-agents` owns these facts. Provider adapters in `sdkwork-kernel` translate provider history into them. BirdCoder owns only presentation and must consume the Agents App SDK rather than issue provider or Agents HTTP requests directly.

The identity boundary is fixed:

| Field | Authority and lifecycle |
| --- | --- |
| `sessionId` | Identifies the SDKWork canonical Session. It is stable across provider start, resume, reconnect, and provider replacement. |
| `providerSessionId` | Opaque provider-owned continuation identity returned by the provider or independently resolved from provider authority, then stored on the Session runtime binding. A new Session may not have one until that identity is available. |

Provider-native fields such as a session key, conversation ID, or Codex wire
`threadId` are accepted only inside the matching provider adapter or exact raw
protocol evidence. The adapter binds that value to `providerSessionId`; it
never replaces the canonical `sessionId` and never synthesizes
`providerSessionId` from `sessionId`.

Every visible Session Item has a stable item identity, session identity, optional turn identity, monotonic sequence, role, lifecycle status, timestamps, and one or more content capabilities:

| Capability | BirdCoder field |
| --- | --- |
| Human or assistant text | `content` |
| Thinking/reasoning | `reasoning` |
| Tool and MCP activity | `tool_calls`, `tool_call_id` |
| Shell execution | `commands` or normalized command tool calls |
| File mutation | `fileChanges` |
| Attachments and generated media | `resources` |
| Plan/todo state | `taskProgress` |
| Runtime lifecycle | `lifecycleEvents` |
| Approval or user question | normalized tool interaction |

## Normalized Item Contract

Provider adapters must retain enough source data to populate this logical envelope. Field names below describe the contract; the generated Agents SDK DTOs remain the implementation authority.

| Field | Required behavior |
| --- | --- |
| `id` | Stable across history reads, reconnects, and live replacements. Never derive it from the current array index. |
| `sessionId` | Canonical SDKWork Session identity. Provider resume, fork, or reconnect must not change it. |
| `turnId` | Stable user-turn correlation when the provider exposes one; otherwise derived only by the owning adapter. |
| `sequence` | Monotonic display order within a session. Equal provider timestamps require an identity tie-breaker. |
| `role` | `user`, `assistant`, `tool`, `system`, or bounded adapter/lifecycle role. |
| `status` | Canonical pending/running/completed/failed/cancelled state without erasing the provider-native status. |
| `content` | Durable human-visible text. Deltas patch this field; they are not separate items. |
| `reasoning` | Separate disclosure channel. It must not be concatenated into the final answer. |
| `tool_calls` | Calls keyed by provider call ID with name, arguments, lifecycle, output/error, duration, and provider metadata. |
| `resources` | Images, files, documents, audio, and generated media as structured resources, not prompt-marker text. |
| `taskProgress` | Ordered plan/todo snapshot with item text and state. |
| `lifecycleEvents` | Bounded status facts that matter to the user but are not durable assistant prose. |
| `providerData` | Bounded source payload needed for forward compatibility and diagnostics. |

`providerSessionId` belongs to the Session runtime binding, not to every
Session Item envelope. Items retain the canonical `sessionId`; provider
adapters resolve continuation through the binding without copying or deriving
the provider identity per item.

An adapter must not emit an empty visible item merely because a source record is recognized. Records that are transport-only or secret-bearing are retained as bounded metadata or omitted by an explicit rule; all other unknown records receive a generic visible representation only after the owning adapter can classify them as durable and safe. Raw provider payloads are never used as an unreviewed fallback.

## Correlation Keys

Correlation preserves canonical and provider Session identities at their owning
layers:

| Concern | Preferred key |
| --- | --- |
| Canonical Session | `sessionId` assigned by `sdkwork-agents` |
| Provider continuation | Opaque provider identity retained as `providerSessionId` |
| Turn | provider turn/run/prompt ID |
| Message/item | provider message/item/part ID |
| Tool | call ID, `tool_use_id`, `tool_call_id`, or equivalent |
| Stream replacement | item/message/part ID plus declared content field |
| Ordering | provider sequence, then timestamp and stable ID |

Names, arguments, text snippets, timestamps alone, and current array positions are not correlation keys. A tool request and result may live in different source records but must project to one canonical tool row.

## Stream Versus History

Every provider integration must classify each source record before projection:

| Class | Meaning | Persistence rule |
| --- | --- | --- |
| Durable snapshot | Complete message/item/part stored by the provider | History authority |
| Durable lifecycle | Stored command, tool, plan, patch, or completion fact | History authority when user-visible |
| Delta | Append/replace patch for an existing identity | Merge only; never create a duplicate row |
| Transient lifecycle | Progress, heartbeat, retry, or reconnect status | Active-tail UI only unless later persisted |
| Terminal | Final/cancel/error settlement and usage | Settle correlated state; do not duplicate final text |
| Internal | Prompt/config/auth/transport material | Fail closed from the transcript |

On reconnect, reload durable history, then reconcile the active tail by identity. Never replay cached deltas on top of an already-completed snapshot.

## Lifecycle Rules

1. History reads establish authority. Streaming notifications may update the loaded window but do not replace durable history.
2. A start event creates an in-progress item. Deltas patch that same stable identity. A completed event is the authoritative final snapshot.
3. Text deltas are ordered and append-only within their declared content channel. A provider event with a stable event identity may be deduplicated by that identity. A delta without an event identity, including OpenCode `message.part.delta`, is applied exactly once in received order; reconnect reconciles from authoritative history instead of blindly replaying cached deltas.
4. Tool request and result records correlate by provider call ID even when they arrive as different messages.
5. Plan notifications update `taskProgress`; they are not treated as transcript text unless the provider also emits a durable plan item.
6. Pagination continues until overlap, a terminal page, useful initial conversation context, cancellation, or the refresh timeout. Fixed page-count cutoffs are not valid completeness boundaries.
7. Unknown non-system provider items must remain visible through a bounded generic presentation. Unknown system/developer payloads fail closed to avoid exposing internal instructions.

## Pagination And Completeness

Pagination is complete only when one of these provider-owned conditions is observed: an explicit terminal page, an absent continuation token with no `more` flag, an exhausted offset range, or overlap with an already-loaded stable identity while reconciling the live head. A local page-count constant is never a completeness signal.

The initial transcript refresh may stop after it has both useful user context and the active tail, but it must keep the provider continuation state so the user can load older history. Explicit “load earlier” continues until it obtains new identities or reaches the provider terminal condition. Repeated duplicate-only pages must advance using the returned provider cursor and remain cancellable; they must not loop forever.

## Canonical State Mapping

Tool lifecycle mapping:

| Source meaning | Canonical state |
| --- | --- |
| queued, validating, input streaming, approval required | `pending` |
| started, executing, input available | `running` |
| completed, output available, success | `completed` |
| error, output error, failed | `failed` |
| aborted, cancelled, denied | `cancelled` |

Plan item mapping:

| Source spelling | Canonical state |
| --- | --- |
| `inProgress`, `in_progress`, `running`, `active` | `running` |
| `completed`, `done`, `success` | `completed` |
| `pending`, `todo`, `queued` | `pending` |
| `blocked`, `waiting` | `blocked` |
| `cancelled`, `canceled`, `skipped` | `cancelled` |

The provider-native spelling remains in provider metadata. Counts are derived from normalized items, not trusted blindly from malformed source counters.

## Rendering Rules

- Plain, stable text transcripts may use estimated-height virtualization.
- Tool calls, commands, plans, resources, file changes, reasoning, lifecycle events, and interactions have disclosure-dependent heights. They use progressive mounting without estimated spacer virtualization to prevent blank regions.
- Tool rows are compact by default. Arguments, output, errors, and raw payloads are bounded and disclosed on demand.
- MCP rows show `server / tool`, lifecycle status, duration when available, and structured output.
- Plans show the current position (`Step n / total`) and preserve completed, running, pending, blocked, and cancelled states.

## Executable Presentation Evidence

The rows below describe only the assertions that exist in the named executable
tests. They are not full provider parity claims. In particular, a shared UI
profile or protocol-adapter assertion does not prove provider Session history,
streaming, Interaction continuation, recovery, or live end-to-end behavior.

| Provider | Executable presentation evidence | Verified scope | Unverified scope |
| --- | --- | --- | --- |
| Codex | [`agent-session-item-view-contract.test.ts`](../../scripts/agent-session-item-view-contract.test.ts), [`agentSessionProviderItemRouting.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts), and [`agentSessionCodexSyntheticItemPresentation.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionCodexSyntheticItemPresentation.test.ts) | Static provider-protocol item fixtures cover text/delta/reasoning, command/file/MCP/tool, image/resource, lifecycle, and synthetic presentation cases. | Real provider send/stream/cancel/approval/question/recovery remains governed by the pending gates in the [Codex document](codex/README.md#real-provider-e2e-gate). |
| Claude Code | [`agent-session-item-view-contract.test.ts`](../../scripts/agent-session-item-view-contract.test.ts), [`agentSessionProviderRealtimeEvents.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts), [`universal-chat-lifecycle-presentation-contract.test.tsx`](../../scripts/universal-chat-lifecycle-presentation-contract.test.tsx), and [`universal-chat-interaction-presentation-contract.test.tsx`](../../scripts/universal-chat-interaction-presentation-contract.test.tsx) | Static provider-protocol fixtures cover assistant text/delta/thinking, mixed tool blocks, MCP result/hook lifecycle, and selected permission/task states. The realtime payload fixture proves an assistant `tool_use` and its user `tool_result` block merge by provider tool identity into one settled MCP row. | The complete JSONL record union, durable history/reconnect breadth, and real provider E2E are not established by these tests. |
| Gemini | [`agent-session-item-view-contract.test.ts`](../../scripts/agent-session-item-view-contract.test.ts), [`agentSessionProviderRealtimeEvents.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts), [`universal-chat-lifecycle-presentation-contract.test.tsx`](../../scripts/universal-chat-lifecycle-presentation-contract.test.tsx), and [`universal-chat-interaction-presentation-contract.test.tsx`](../../scripts/universal-chat-interaction-presentation-contract.test.tsx) | Static provider-protocol fixtures cover content/delta/thought/tool request plus selected blocked, compaction, and confirmation states. The realtime payload fixture proves public stream-json `tool_use` and `tool_result` records merge by `tool_id` while preserving request parameters and terminal output. | Persisted provider history, full event-union reconciliation, and real provider E2E remain unverified. |
| OpenCode | [`agent-session-item-view-contract.test.ts`](../../scripts/agent-session-item-view-contract.test.ts), [`agentSessionProviderRealtimeEvents.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts), [`agentSessionProviderItemRouting.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts), [`agentSessionOpenCodeReplay.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionOpenCodeReplay.test.ts), [`sessionRefresh.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/sessionRefresh.test.ts), [`universal-chat-lifecycle-presentation-contract.test.tsx`](../../scripts/universal-chat-lifecycle-presentation-contract.test.tsx), and [`universal-chat-interaction-presentation-contract.test.tsx`](../../scripts/universal-chat-interaction-presentation-contract.test.tsx) | Static provider-protocol fixtures cover text/reasoning, tool state, file/tool attachments, lifecycle, and selected question state. Realtime and source-window replay tests prove full-snapshot replacement, once-only ordered deltas, authoritative part/message removal, later snapshot restoration, `callID` tool correlation, provider Session isolation, same-message part ordering, and latest-page delta reconciliation after an earlier-page snapshot arrives. The canonical pagination test also proves the returned opaque cursor is forwarded unchanged. | OpenCode-to-Agents provider cursor translation, authoritative reconnect reconciliation, complete provider event forwarding, and credentialed real-provider E2E remain unverified. |
| OpenClaw | [`agentSessionProviderToolHistory.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderToolHistory.test.ts), [`agentSessionProviderRealtimeEvents.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts), [`message-presentation.spec.ts`](../../apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts), [`universal-chat-message-presentation-contract.test.tsx`](../../scripts/universal-chat-message-presentation-contract.test.tsx), and [`chat-message-tool-calls-contract.test.ts`](../../scripts/chat-message-tool-calls-contract.test.ts) | Durable `llm-core` request/result pairs, live `AgentEvent` tool start/update/result reconciliation, retained partial output plus terminal error, bundle MCP identity, `session.approval`, and legacy exec approval projection are asserted. Work Mode E2E proves four provider history records merge into two natural expandable tool rows with success/error output at desktop width. | Kernel does not yet forward the complete gateway tool/approval stream as canonical item/Interaction events; history pagination, reconnect, and credentialed real-provider E2E remain unverified. |
| Hermes Agent | [`agentSessionProviderToolHistory.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderToolHistory.test.ts), [`agentSessionProviderRealtimeEvents.test.ts`](../../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderRealtimeEvents.test.ts), [`message-presentation.spec.ts`](../../apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts), [`universal-chat-message-presentation-contract.test.tsx`](../../scripts/universal-chat-message-presentation-contract.test.tsx), and [`chat-message-tool-calls-contract.test.ts`](../../scripts/chat-message-tool-calls-contract.test.ts) | Durable OpenAI-compatible history, `hermes.tool.progress`, direct lifecycle payloads, Responses `function_call`/`function_call_output` correlation by `call_id`, and `input_text` output flattening are asserted. Work Mode E2E proves the request/result pair becomes one expandable `filesystem / Read file` MCP row and remains overflow-free at 900 px. | The complete native gateway event union and kernel forwarding remain unverified; compression lineage, pagination, canonical Interaction continuation, and credentialed real-provider E2E also remain open. |

[`provider-protocol-docs-contract.test.mjs`](../../scripts/provider-protocol-docs-contract.test.mjs)
checks all six baselines, source authorities, and executable-evidence links. It
does not execute those tests or by itself prove adapter behavior or UI parity.
All six profiles share the provider-neutral UI policy asserted by
[`universal-chat-message-presentation-contract.test.tsx`](../../scripts/universal-chat-message-presentation-contract.test.tsx).

## Conformance Matrix

Each provider document must answer every row before a baseline update is considered complete.

| Area | Required evidence |
| --- | --- |
| Baseline | Version or commit plus local source/SDK authority |
| Envelope | Request/response/event or stream-record discriminator |
| Identity | Session, turn/run, message/item, and tool correlation keys |
| Durable model | Complete message/item/part variant inventory |
| Live model | Start, delta, replacement, progress, and terminal events |
| History | Authority, ordering, pagination token/offset, terminal condition |
| Text | Delta accumulation and final snapshot behavior |
| Reasoning | Separate channel and visibility rule |
| Tools/MCP | Request/result correlation, status state machine, attachments |
| Plans | First-class event/item or structured-tool fallback |
| Interactions | Permission, approval, question, retry, and cancellation |
| Errors | Item error versus turn/session terminal failure |
| Unknowns | Forward-compatible visible fallback and secret filtering |
| Verification | Adapter fixture plus projection, pagination, and UI test |

## Change Checklist

When a provider changes, update its baseline, compare every discriminated union and history API against the conformance matrix, add adapter fixtures, update normalization tests, and verify both tool-heavy and text-only transcripts. Record source paths and any intentionally unsupported variants in the provider document. Do not hand-copy generated SDK DTOs into BirdCoder.

Run `node scripts/provider-protocol-docs-contract.test.mjs` to verify provider directories, required protocol sections, local source authorities, and external gitlink pins.
