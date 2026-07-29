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

## Lifecycle Rules

1. History reads establish authority. Streaming notifications may update the loaded window but do not replace durable history.
2. A start event creates an in-progress item. Deltas patch that same stable identity. A completed event is the authoritative final snapshot.
3. Text deltas are ordered and append-only within their declared content channel. Duplicate events must be idempotent.
4. Tool request and result records correlate by provider call ID even when they arrive as different messages.
5. Plan notifications update `taskProgress`; they are not treated as transcript text unless the provider also emits a durable plan item.
6. Pagination continues until overlap, a terminal page, useful initial conversation context, cancellation, or the refresh timeout. Fixed page-count cutoffs are not valid completeness boundaries.
7. Unknown non-system provider items must remain visible through a bounded generic presentation. Unknown system/developer payloads fail closed to avoid exposing internal instructions.

## Rendering Rules

- Plain, stable text transcripts may use estimated-height virtualization.
- Tool calls, commands, plans, resources, file changes, reasoning, lifecycle events, and interactions have disclosure-dependent heights. They use progressive mounting without estimated spacer virtualization to prevent blank regions.
- Tool rows are compact by default. Arguments, output, errors, and raw payloads are bounded and disclosed on demand.
- MCP rows show `server / tool`, lifecycle status, duration when available, and structured output.
- Plans show the current position (`Step n / total`) and preserve completed, running, pending, blocked, and cancelled states.

## Change Checklist

When a provider changes, update its baseline, compare its discriminated unions and history API, add adapter fixtures, update normalization tests, and verify both tool-heavy and text-only transcripts. Do not hand-copy generated SDK DTOs into BirdCoder.
