# ADR-20260731 Durable Turn Input Queue

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-31
Requirement: [REQ-2026-0007](../../product/requirements/REQ-2026-0007-durable-turn-input-queue.md)
Specs: ARCHITECTURE_DECISION_SPEC.md, API_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DATABASE_SPEC.md, FRONTEND_SPEC.md, SECURITY_SPEC.md, TEST_SPEC.md

## Context

UnifiedChat must accept later inputs while a Session Turn is active and execute
them in FIFO order after authoritative completion. A renderer-owned queue loses
work on restart, cannot serialize multiple windows, cannot determine whether an
interrupted delivery was accepted, and can duplicate a Turn when transport
recovery races a retry. Attachments, runtime binding, model selection, access
mode, and command identity must remain equivalent to immediate submission.

Queue operations also need unambiguous removal behavior. Editing, reordering,
clearing, Session deletion, logout, cancellation, failed Turns, expired claims,
and concurrent windows must not silently drop accepted work or execute mutable
content under an earlier idempotency identity.

## Decision

`sdkwork-agents` owns an authenticated, owner-scoped durable Turn input queue
nested below Agent and Session. BirdCoder consumes its generated Agents App SDK
surface through the injected `IAgentSessionService`; no UI package calls raw
HTTP or persists queue content locally.

Each entry has a stable `queueEntryId`, FIFO position, optimistic version,
status, original execution metadata, queue-owned idempotency key and payload
hash, optional claim lease, and monotonically increasing fencing token. The
state set is deliberately small:

| State | Meaning | Allowed user mutations |
| --- | --- | --- |
| `queued` | Durable and eligible in FIFO order | edit, reorder, remove, clear |
| `executing` | Atomically claimed or associated with a non-terminal Turn | none |
| `failed` | Terminal failure at the head; automatic advancement paused | edit, retry, reorder, remove, clear |

`claim_next` is the single execution admission command. In one transaction it
reconciles the previous executing head against the authoritative Turn and then
either claims the next entry, reports `busy` or `active_turn`, reports
`blocked`, or reports `empty`. Completion deletes the reconciled entry. Failed
or cancelled Turn state produces a failed head. An expired lease with no
accepted Turn returns the entry to `queued` and increases its fencing token.

BirdCoder submits a claimed entry through the existing Turn stream with the
entry's exact Agent, Session, runtime binding, model, access mode, client request
id, idempotency key, and payload hash. Accepted but uncertain delivery remains
`executing` until owner reconciliation. Rejection before authoritative
acceptance uses the claim token, expected version, and fencing token to fail the
entry once. The next claim after completed dispatch performs reconciliation and
continues FIFO execution.

Clear deletes queued and failed entries while preserving executing work.
Executing entries reject update, reorder, retry, and delete. Deleting a Session
removes its nested queue. Logout clears only BirdCoder's disposable projection;
durable records remain owner-scoped and reappear after authenticated startup or
reconnect hydration.

BirdCoder retains a bounded in-process projection for rendering: at most 32
entries per Session, 32 Session scopes, 4 MiB per Session, and 16 MiB total.
Startup, focus, visibility, connectivity, and cross-window invalidation refresh
from Agents. `BroadcastChannel` carries only Agent/Session/source identities.
A generation fence discards late work after Session identity changes.

## Alternatives

### Persist In Browser Or Tauri Storage

Rejected because device storage cannot provide owner authorization,
cross-device restart recovery, atomic multi-window claims, or authoritative
Turn reconciliation, and queue content is not allowlisted device state.

### Keep The Existing In-Memory Busy Queue

Rejected because restart loses inputs and delivery uncertainty can duplicate or
drop work.

### Submit Every Input Immediately

Rejected because providers and Sessions may require serialized Turns, and
client-side timing cannot replace authoritative active-Turn admission.

### Use A Generic Background Job Queue

Rejected because Turn input mutation, Session deletion, attachment identity,
Turn reconciliation, and owner authorization belong to the Agents Session
aggregate rather than an infrastructure job payload.

## Consequences

- Restart, reconnect, and multi-window behavior is deterministic and durable.
- A failed head intentionally requires user action before later inputs run.
- Queue mutations use stable identity and optimistic concurrency; stale UI
  actions fail and refresh instead of overwriting another window.
- An executing entry is temporarily immutable, so clear and delete actions do
  not create ambiguous cancellation semantics.
- BirdCoder can discard all queue memory on logout without deleting business
  data or weakening account isolation.
- The Agents migration, indexes, owner filtering, lease reconciliation, and
  generated SDK surface become release-critical contracts.

## Verification

- Agents HTTP integration covers persistence, owner isolation, concurrent
  claims, mutation rejection while executing, FIFO completion, failed-head
  pause/retry, lease fencing, clear preservation, and Session deletion.
- API response, operation-pattern, pagination, route-collision, database, and
  SDK generation validators pass, and SDK regeneration is idempotent.
- BirdCoder service tests prove generated SDK usage, nested identity validation,
  and authoritative idempotency propagation.
- Workbench Hook tests cover restart hydration, serial completion, uncertain
  delivery, rejected dispatch, blocked heads, broadcast refresh, and Session
  generation isolation.
- PC TypeScript, architecture, local-storage, E2E restart/multi-window, lint,
  and production build gates remain required.

## Supersedes / Superseded By

This decision supersedes the memory-only busy-state queue described by the
initial provider-neutral transcript implementation. It does not supersede
Agents Session/Turn ownership or the provider-neutral presentation decision.
