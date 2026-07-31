# REQ-2026-0007 Durable Turn Input Queue

Status: accepted
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-07-31
Specs: REQUIREMENTS_SPEC.md, API_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DATABASE_SPEC.md, FRONTEND_SPEC.md, SECURITY_SPEC.md, TEST_SPEC.md

## Problem

UnifiedChat must accept additional inputs while an Agents Session Turn is
active. A renderer-only queue loses inputs on application restart and cannot
safely coordinate browser windows, recover uncertain delivery, or distinguish
an executing entry from one that may still be edited or removed.

The queue must preserve the exact Agent, Session, runtime binding, model,
access mode, attachments, command identity, and content used at creation. It
must advance only after authoritative Turn completion and must handle failure,
cancellation, deletion, logout, reconnect, expired leases, and concurrent
mutations without duplicate Turns or silent data loss.

## Required Outcome

- Agents owns an authenticated durable FIFO queue nested by Agent and Session.
- BirdCoder uses only the generated Agents App SDK through an injected service
  port and retains a bounded disposable projection.
- Busy submissions are durable before the composer clears.
- One atomic, leased, fenced claim admits execution across every client window.
- Claimed dispatch uses the queue-owned idempotency key and payload hash.
- Completion advances FIFO; uncertain acceptance waits for owner
  reconciliation; failure or cancellation pauses the head.
- Queued and failed entries support versioned edit, reorder, removal, clear,
  and retry. Executing entries are immutable.
- Application restart, reconnect, focus, visibility, and cross-window
  invalidation rehydrate from Agents.

## Non-Goals

- Persisting queue content in Web Storage, Tauri device state, or a BirdCoder
  database.
- Replacing the existing Agents Turn streaming and completion authority.
- Broadcasting queue content between windows.
- Treating clear as cancellation of an executing Turn.
- Implementing provider-specific queue branches in UnifiedChat.

## Acceptance Criteria

1. Creating an entry persists all bounded execution metadata and returns a
   stable `queueEntryId`, version, position, idempotency key, and payload hash.
2. Owner, Agent, and Session identity is validated for every list and mutation;
   another owner cannot observe or mutate the queue.
3. Concurrent `claim_next` calls across windows lease at most one head, return
   a fencing token, and cannot claim while the Session has an active Turn.
4. A completed claimed Turn is deleted and the next FIFO entry becomes
   claimable. A failed or cancelled Turn becomes a failed head and blocks later
   inputs.
5. A lease that expires without an accepted Turn requeues safely and increments
   fencing so stale fail or mutation commands are rejected.
6. An accepted but uncertain client delivery remains executing for later owner
   reconciliation. A rejected pre-acceptance delivery invokes the fenced fail
   command exactly once.
7. Edit, reorder, remove, retry, and clear use stable entry identity and
   optimistic version checks. Executing entries reject those mutations; clear
   preserves executing work.
8. Session deletion removes the nested queue. Logout clears only the local
   projection and does not delete durable entries.
9. BirdCoder hydrates on startup and after online, focus, visibility, or
   validated cross-window invalidation. A response from a previous Session
   generation cannot overwrite the selected Session projection or processing
   lock.
10. The PC projection retains at most 32 entries per Session, 32 Session
    scopes, 4 MiB per Session, and 16 MiB total. Broadcast messages contain no
    queue content.
11. The UnifiedChat queue surface exposes queued, executing, and failed states;
    failed entries can be retried and executing entries cannot be edited,
    reordered, or removed.
12. Generated SDK regeneration is idempotent, focused Rust and TypeScript tests
    pass, architecture/security/storage validators pass, and restart plus
    multi-window E2E scenarios pass.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Cohesion | Agents owns durable state and admission; infrastructure adapts the generated SDK; Workbench coordinates lifecycle; UnifiedChat renders and invokes typed commands. |
| Performance | Indexed owner/Session access, atomic bounded claims, 32-entry API pages, bounded projections, and invalidation-only broadcasts avoid polling or unbounded client retention. |
| Reliability | FIFO progression is driven by authoritative Turn state, leases and fencing reject stale actors, and idempotency prevents duplicate accepted Turns. |
| Security | Every operation is owner-scoped, nested identities are validated, content is not broadcast or locally persisted, and executing work cannot be mutated through stale UI state. |
| Extensibility | Provider-neutral queue metadata and the existing Turn service allow future Agents without modifying the queue state machine or UnifiedChat transport. |

## Traceability

- [ADR-20260731](../../architecture/decisions/ADR-20260731-durable-turn-input-queue.md)
- [Product requirements](../prd/PRD.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [PC product supplement](../../../apps/sdkwork-birdcoder-pc/docs/product/prd/PRD.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Agents/BirdCoder alignment](../../../specs/agents-birdcoder-alignment.spec.json)

## Verification

```bash
cargo test -p sdkwork-intelligence-agents-service --all-features --test http_axum_contracts durable_turn_input_queue_serializes_claims_and_reconciles_terminal_turns -- --nocapture
node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace ../sdkwork-agents
node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace ../sdkwork-agents
node ../sdkwork-specs/tools/check-pagination.mjs --workspace ../sdkwork-agents
node ../sdkwork-specs/tools/check-route-path-collisions.mjs --workspace ../sdkwork-agents
node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root ../sdkwork-agents
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentTurnInputQueue.test.ts agentTurnInputQueueHook.test.tsx
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm --dir apps/sdkwork-birdcoder-pc test:e2e -- durable-turn-input-queue.spec.ts
pnpm --dir apps/sdkwork-birdcoder-pc build
```
