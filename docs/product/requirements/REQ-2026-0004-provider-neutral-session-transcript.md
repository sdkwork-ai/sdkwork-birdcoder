# REQ-2026-0004 Provider-Neutral Session Transcript

Status: in-progress
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-07-28
Specs: REQUIREMENTS_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, APP_PC_REACT_UI_SPEC.md, FRONTEND_SPEC.md, UI_ARCHITECTURE_SPEC.md, TYPESCRIPT_CODE_SPEC.md, TEST_SPEC.md

## Problem

BirdCoder renders canonical Agents Session Items produced by Codex, Claude
Code, OpenCode, Gemini, and future coding providers. The provider protocols
express equivalent concepts with different event and part shapes. If those
differences leak into React components, transcript behavior, density, tool
presentation, and streaming states drift by provider and become expensive to
maintain.

The PC transcript already normalizes core provider payloads, but the remaining
presentation policy must be made explicit and aligned with the proven OpenCode
App conversation hierarchy without copying OpenCode's data authority or
framework implementation.

## Required Outcome

- Canonical Agents Session Items remain the only transcript facts consumed by
  the PC surface.
- Codex, Claude Code, OpenCode, and Gemini provider payloads normalize through
  registered protocol adapters before rendering.
- One provider-neutral turn presentation owns user prompts, assistant prose,
  reasoning, tool activity, lifecycle notices, interactions, file changes,
  message actions, and the active-turn tail state.
- Provider-specific presentation profiles declare protocol identity and
  narrowly scoped capabilities without forking the shared transcript layout.
- The main transcript follows the OpenCode App's restrained hierarchy: compact
  user bubbles, a clear 24px turn rhythm, quiet inline tool rows, muted
  reasoning, bounded details, and lightweight file-change summaries.
- Unknown Session Item kinds and incomplete provider states remain visible in a
  safe generic presentation instead of being discarded or shown as success.
- User text, images, audio, files, and folder-selected text files submit through
  one composer flow. Drive-backed inputs use Agents `driveRefs`; temporary
  signed URLs are render-only and never become transcript content.

## Non-Goals

- Persisting a BirdCoder transcript, provider payload, or derived message
  presentation model.
- Replacing generated Agents SDK integration with provider HTTP calls.
- Importing OpenCode SolidJS components, theme packages, SDK DTOs, or storage.
- Giving each provider a visually incompatible transcript skin.
- Changing Agents Session Item, Turn, Interaction, or Runtime Binding ownership.

## Acceptance Criteria

1. The four built-in providers register explicit presentation profiles and
   protocol adapter ids while consuming the same shared React renderers.
2. Main-layout user messages use a bounded content-width bubble and assistant
   content uses one centered reading lane with a clear turn boundary.
3. Tool calls render as semantic, keyboard-operable inline activity rows with
   normalized title, target, status, duration, input, output, and error states.
4. Reasoning is visually subordinate, collapsed safely when historical, and
   bounded when expanded.
5. A live turn has one accessible tail indicator; historical virtualized rows
   do not create duplicate live regions.
6. File changes render as a lightweight turn summary with bounded rows, line
   impact, review, undo, and expansion behavior.
7. Lifecycle, interaction, task, resource, Markdown, attachment, copy, edit,
   delete, regenerate, and virtualization behavior remains functional.
8. Opening or switching to a populated Session reconciles a bounded contiguous
   newest authority window and positions the transcript at the latest message
   after progressive rendering and row measurement settle. Initial hydration
   requests 50-item pages until it covers eight visible user turns, reaches
   authority exhaustion, or consumes the five-page budget. A stale tail that
   cannot overlap within that budget is replaced rather than joined across a
   silent gap; unconfirmed transient items remain at the newest edge. Pages
   that violate the requested descending sequence order are never committed.
9. New or streaming content follows the viewport only while the user remains
   near the bottom; reading older content is never interrupted by autoscroll.
10. Reaching the transcript top automatically reveals the next local window or
    starts one cancellable, deduplicated history operation while history remains
    available. That operation may skip at most ten duplicate-only or
    filter-only offset pages to obtain a genuinely older visible item and must
    persist its advanced page metadata even when no visible item is added.
11. Revealing or prepending history preserves the current reading anchor and
    does not jump the viewport to the newly inserted first message.
12. Leaving the sticky-bottom threshold exposes a keyboard-operable return-to-
    latest control; conversation-map navigation also relinquishes sticky
    ownership until the user returns to the latest message.
13. The fixed provider E2E fixture renders without horizontal overflow at
   1440x900 and 900x800 and produces reviewable visual evidence.
14. Focused transcript contracts, PC typecheck, lint, architecture checks, and
   production build pass.
15. Immediate and busy-state queued Turns preserve the same ordered Drive
    references, and image/audio resources obtain temporary playback or preview
    URLs only when rendered.
16. Attachment uploads, provider resource arrays, file-change collections,
    before/after snapshots, unified-diff rows, and Restore inputs enforce tested
    concurrency and memory bounds.
17. Full Diff review keeps the adjacent transcript at least 320 pixels wide by
    collapsing the file explorer first; critically narrow workspaces dedicate
    the visible surface to the Diff without discarding the mounted chat draft.
18. Canonical transcript deduplication and ordered-window reconciliation use
    indexed linear passes, preserve exact-ID updates and concurrent latest
    items, isolate provisional suppression by Session, and pass the 10,000-item
    performance contract without allocating a set for every unique key.
19. OpenCode part update/delta envelopes and text/reasoning/file/tool parts,
    Codex JSON-RPC item/delta envelopes and agent-message/plan/reasoning/image
    items, Claude assistant/stream text/thinking/tool-use blocks, and Gemini
    core/JSONL content/thought/citation/tool events remain visible when
    delivered inside a provider-event Session Item. Unknown non-system kinds
    degrade to a bounded generic notice; only explicit internal instruction
    kinds are hidden.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Cohesion | Protocol normalization, presentation policy, and React rendering remain separate focused modules. |
| Extensibility | A future provider adds a profile and adapter without modifying shared render branches. |
| Performance | Existing progressive loading, server pagination, virtualization, bounded previews, lazy Markdown rendering, four-slot attachment upload scheduling, and bounded file-change parsing remain intact; native provider normalization visits at most 128 payload values and retains at most 64,000 visible text characters, head reconciliation is capped at five 50-item pages (250 raw items), one history operation at ten pages, and loaded-window deduplication/ordered reconciliation at indexed `O(n + m)` time with operation-scoped `O(n + m)` temporary memory. |
| Reliability | Missing provider fields degrade to neutral generic labels and never invent completion; scroll anchoring survives local-window and server-page prepends; authority windows never merge across an unproven gap and pagination metadata never regresses under concurrent commits. |
| Accessibility | Disclosures, status, actions, and the active-turn tail remain keyboard and screen-reader operable. |
| Security | Provider payloads are rendered only through normalized, bounded, sanitized presentation paths. |

## Traceability

- [ADR-20260728](../../architecture/decisions/ADR-20260728-provider-neutral-session-transcript.md)
- [Product requirements](../prd/PRD.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [PC product supplement](../../../apps/sdkwork-birdcoder-pc/docs/product/prd/PRD.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)

## Verification

```bash
node scripts/chat-message-renderer-contract.test.ts
node scripts/chat-message-view-contract.test.ts
node scripts/chat-message-tool-calls-contract.test.ts
node scripts/chat-message-reasoning-contract.test.ts
node scripts/universal-chat-message-presentation-contract.test.tsx
node scripts/run-local-tsx.mjs scripts/universal-chat-composer-attachment-contract.test.tsx
node scripts/run-local-tsx.mjs scripts/agent-turn-input-queue-contract.test.ts
node scripts/run-local-tsx.mjs scripts/agent-session-item-view-contract.test.ts
node scripts/run-local-tsx.mjs scripts/agent-session-item-merge-performance-contract.test.ts
node scripts/run-local-tsx.mjs scripts/file-change-restore-contract.test.ts
node scripts/run-local-tsx.mjs scripts/agent-session-pagination-refresh-contract.test.ts
node scripts/transcript-top-load-contract.test.mjs
node scripts/drive-standard-contract.test.mjs
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test:e2e -- message-presentation.spec.ts
node ../sdkwork-specs/tools/check-application-layering.mjs --root .
pnpm --dir apps/sdkwork-birdcoder-pc build
```
