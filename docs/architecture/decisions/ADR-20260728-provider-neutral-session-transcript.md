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

The adapter accepts both canonical Agents Session Items and provider-native
payloads that have not yet been split by the runtime. It normalizes OpenCode
`message.part.updated` / `message.part.delta` envelopes and text, reasoning,
file, tool, and attachment parts; Codex JSON-RPC item/delta envelopes,
`agentMessage`, `plan`, `reasoning`, `output_text`, and `imageView` items;
Claude assistant and `stream_event` text, thinking, and nested tool-use blocks;
and Gemini core events, JSONL assistant messages, thoughts, citations, and tool
events into the same presentation fields. The traversal retains at most 128
payload values, 64,000 visible text characters, and 32 text or reasoning
entries. Unknown
non-system Session Item kinds receive a bounded generic notice; explicit
`system_instruction` facts and injected Codex `AGENTS.md` instructions remain
the internal-noise allowlist and never enter the transcript.

Turn grouping prefers canonical `turnId`; when it is unavailable, it falls back
to the user-to-user transcript boundary. This grouping is rendering-only,
memory-only state and is never persisted or described as an authority.

Composer attachments follow the owner SDK chain instead of becoming Markdown
transport. The PC uploads through the Drive App SDK, retains the returned
`driveSpaceId` and `driveNodeId`, and submits those identities through the
Agents Turn `driveRefs` field with the semantic `attachment`, `image`, or
`audio` role. The canonical presentation URI is
`drive://spaces/{spaceId}/nodes/{nodeId}`. Signed download URLs are requested
only when a renderer needs an image or audio source; they remain transient UI
state and never enter a Session Item, queued Turn input, draft, or device
storage. The Agents-owned durable Turn input queue preserves ordered `driveRefs`
alongside visible text and immutable dispatch identity so delayed dispatch is
protocol-equivalent to immediate dispatch. BirdCoder retains only a bounded,
disposable in-memory projection of those owner records.

Provider data is bounded before it reaches React. A Session Item retains at
most 32 resources and 256 file-change rows. Each file-change path is limited to
4,096 characters, each diff or before/after snapshot to 2 MiB, and the retained
file-change text for one rendering pass to 16 MiB. Oversized before/after content is
dropped atomically and is not eligible for Restore. Composer uploads use four
independent-file slots; Drive remains responsible for chunk-level concurrency.
The full unified-diff view creates at most 20,000 styled line elements.
When a full Diff would compress the adjacent transcript below 320 pixels, the
workspace first hides the file explorer. At critically narrow widths the Diff
temporarily owns the visible workspace, while the mounted chat component keeps
its draft and Session state for the reversible close transition.

Transcript synchronization reads the newest Agents Session Items in descending
sequence order, rejects a page whose sequence order is ascending, and
normalizes accepted items back to chronological presentation order. Each page
contains 50 raw items. Initial hydration continues until it covers eight
visible user turns, reaches authority exhaustion, or consumes the five-page
(250-item) budget. Refresh of an existing window also traverses within that
budget until continuity and sufficient recent visible context are proven; if
it cannot prove continuity, the PC replaces the disconnected authority tail
instead of rendering a silent gap.
Unconfirmed transient items remain at the newest edge. Upward history loading
is one cancellable operation and may advance across at most three opaque cursor
pages that contain only duplicates or filtered internal items before returning.
Pagination metadata advances monotonically when history and head refreshes
commit concurrently.

Transcript reconciliation indexes canonical `sessionId + itemId` identities
instead of repeatedly scanning the growing message window. Provisional blank-ID
matching builds its content-bearing logical index only when such an item is
actually queried, and index buckets allocate a set only for real key
collisions. Deduplication and ordered-window reconciliation are therefore
`O(n + m)` in the loaded windows with `O(n + m)` temporary index memory in the
worst case, while the common all-canonical path avoids retaining duplicate
content keys. Temporary indexes are scoped to one commit and are not cached
across Sessions.

The Agents Session Item list is an owner-declared P1 opaque keyset cursor API.
The cursor is bound to authenticated scope, Session, filters, and sort order;
clients reject malformed or non-progressing continuation metadata instead of
falling back to an offset or guessing a continuation position.

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
- Attachment previews require a fresh Drive grant after remount or expiry;
  temporary grant failure falls back to the stable Drive action.
- Bounded payloads may show a truncation or unavailable state rather than
  risking a main-thread stall, OOM, or restoration from incomplete content.
- A highly stale transcript may replace its previously loaded authority tail
  with a bounded contiguous head and expose older data again through upward
  paging rather than displaying two disconnected ranges as one conversation.

## Verification

- Provider adapter contracts cover OpenCode, Codex, Claude, Gemini, canonical,
  and unknown fallback tool records.
- Renderer contracts cover profile registration, turn grouping, tool details,
  reasoning disclosure, live-tail uniqueness, and file summary behavior.
- Attachment contracts cover immediate and queued `driveRefs`, canonical Drive
  URIs, bounded upload concurrency, image/audio grant resolution, and the
  absence of signed URLs from persisted content.
- File-change contracts cover provider adapters, collection and text budgets,
  bounded line rendering, and refusal to restore incomplete snapshots.
- Pagination contracts cover bounded head overlap, disconnected-window reset,
  optimistic-tail retention, duplicate-only cursor pages, monotonic commit
  metadata, and top-prepend scroll anchoring.
- A 10,000-item performance contract covers canonical deduplication,
  overlapping ordered-window updates, concurrent latest-item retention,
  collision-only index buckets, and the absence of nested window scans.
- Playwright uses fixed provider fixtures at desktop and constrained widths and
  captures visual evidence for human review.
- PC typecheck, lint, architecture layering, and production build remain the
  release gate.

## Supersedes / Superseded By

This decision narrows the existing owner-composed BirdCoder architecture for
Session Item presentation. It does not supersede Agents ownership, SDK
integration, or Session Activity decisions.
