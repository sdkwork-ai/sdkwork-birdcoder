# Provider Message Protocols

This directory records the provider-native message contracts that BirdCoder must preserve and the projection rules used to render them consistently. It is a compatibility reference, not a replacement for provider source code or SDK types.

## Baselines

| Provider | Baseline | Local authority |
| --- | --- | --- |
| [Codex](codex/README.md) | source commit `3725f02cf38d856bc82bb46dd68ab61bb96ec6fc` | `external/codex/` |
| [OpenCode](opencode/README.md) | `1.18.9`, commit `7565e03536d19e850f9996c407f9bf5e932b5f7a` | `external/opencode/` |
| [Gemini CLI](gemini/README.md) | `0.55.0-nightly.20260728.gd29268d36`, commit `3499c84f7b8e70c86600e7cd2c67a7c65a667f5e` | `external/gemini/` |
| [Claude Code](claude-code/README.md) | Agent SDK `0.3.220` | kernel adapter plus published SDK contract |
| [OpenClaw](openclaw/README.md) | `2026.7.2`, commit `819961a292dc224d57bc110dd8c6d8364709de13` | `external/openclaw/` |
| [Hermes Agent](hermes-agent/README.md) | `0.19.0`, commit `cff9728587da4f3c0beed0786f9bea528e489f13` | `external/hermes-agent/` |

## Canonical BirdCoder Model

The canonical persisted hierarchy is:

```text
Project
  Session
    Turn
      Session Item
```

`sdkwork-agents` owns these facts. Provider adapters in `sdkwork-kernel` translate provider history into them. BirdCoder owns only presentation and must consume the Agents App SDK rather than issue provider or Agents HTTP requests directly.

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
| `sessionId` | Provider session/thread identity after resume or fork resolution. |
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

An adapter must not emit an empty visible item merely because a source record is recognized. Records that are transport-only or secret-bearing are retained as bounded metadata or omitted by an explicit rule; all other unknown durable records receive a generic visible representation.

## Correlation Keys

Correlation is provider-native first:

| Concern | Preferred key |
| --- | --- |
| Session | thread/session/conversation ID returned by the provider |
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
3. Text deltas are ordered and append-only within their declared content channel. Duplicate events must be idempotent.
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
