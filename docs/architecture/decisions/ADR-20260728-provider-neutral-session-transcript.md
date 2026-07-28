# ADR-20260728 Provider-Neutral Session Transcript

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-28
Requirement: [REQ-2026-0004](../../product/requirements/REQ-2026-0004-provider-neutral-session-transcript.md)
Specs: ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, APP_PC_REACT_UI_SPEC.md, FRONTEND_SPEC.md, UI_ARCHITECTURE_SPEC.md, TYPESCRIPT_CODE_SPEC.md

## Context

Codex, Claude Code, OpenCode, and Gemini expose different native event and part
protocols for the same user-visible concepts. BirdCoder must preserve those
semantics while presenting one coherent commercial coding workbench. Direct
provider branching in message components would couple protocol churn to visual
layout and would eventually produce four inconsistent transcript products.

OpenCode's App source demonstrates a useful presentation hierarchy: messages
are grouped by user turn, assistant parts share one vertical flow, tool calls
are quiet semantic rows, reasoning is subordinate, details are bounded, and
file changes are summarized after the turn. BirdCoder can align with that
hierarchy while retaining React, Agents Session Item authority, and SDKWork
component boundaries.

## Decision

The PC transcript uses three explicit layers:

| Layer | Responsibility |
| --- | --- |
| Provider protocol adapters | Normalize OpenCode parts, Codex items, Claude content blocks, Gemini events, and canonical tool records into provider-neutral Session Item presentation fields |
| Presentation policy | Resolve provider profile, turn position, density, live-tail behavior, disclosure defaults, and semantic labels without reading transport clients |
| Shared React renderers | Render user text, assistant Markdown, reasoning, tools, lifecycle, interactions, tasks, resources, and file changes from the normalized presentation only |

Every built-in provider declares a profile containing its stable engine id,
surface label, and protocol adapter id. The shared profile defaults own visual
behavior. Provider profiles may narrow semantic capabilities, but they do not
fork the base transcript spacing, typography, action placement, or component
tree.

Turn grouping prefers canonical `turnId`; when it is unavailable, it falls back
to the user-to-user transcript boundary. This grouping is rendering-only,
memory-only state and is never persisted or described as an authority.

## Alternatives

### Separate Transcript Component Per Provider

Rejected because common behavior, accessibility, virtualization, and fixes
would drift across four implementations.

### Copy OpenCode Session UI Into BirdCoder

Rejected because it would import a different framework, SDK DTOs, theme
authority, and session data model instead of aligning the product hierarchy.

### Flatten Every Provider Event To Plain Markdown

Rejected because tool status, interactions, reasoning, resources, lifecycle,
and file changes would lose semantic actions and accessibility.

### Keep Provider Branches Inside Shared Components

Rejected because the shared renderers would no longer be open for extension
and closed for provider-specific modification.

## Consequences

- New providers integrate through a protocol adapter and presentation profile.
- The transcript can evolve visually without changing provider decoding.
- Provider protocol fixes can be tested independently from React layout.
- The UI intentionally shares one visual language; provider identity remains
  available as metadata and quiet contextual labeling rather than a skin.
- The presentation layer must continue to preserve unknown kinds and bounded
  raw detail fallbacks for forward compatibility.

## Verification

- Provider adapter contracts cover OpenCode, Codex, Claude, Gemini, canonical,
  and unknown fallback tool records.
- Renderer contracts cover profile registration, turn grouping, tool details,
  reasoning disclosure, live-tail uniqueness, and file summary behavior.
- Playwright uses fixed provider fixtures at desktop and constrained widths and
  captures visual evidence for human review.
- PC typecheck, lint, architecture layering, and production build remain the
  release gate.

## Supersedes / Superseded By

This decision narrows the existing owner-composed BirdCoder architecture for
Session Item presentation. It does not supersede Agents ownership, SDK
integration, or Session Activity decisions.
