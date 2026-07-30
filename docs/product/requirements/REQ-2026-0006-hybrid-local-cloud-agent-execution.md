# REQ-2026-0006 Hybrid Local And Cloud Agent Execution

Status: blocked
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-07-30
Specs: REQUIREMENTS_SPEC.md, ARCHITECTURE_DECISION_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, PERFORMANCE_SPEC.md, QUALITY_GATE_SPEC.md, DEPLOYMENT_SPEC.md, TEST_SPEC.md

## Problem

BirdCoder must let a developer choose local or cloud execution when creating
an Agents Session, and must support an explicit Task-level override without
turning the PC application into a scheduler, Sandbox client, or second data
authority. Local work must keep project bytes and execution data on the
developer device by default. Cloud work must run only in an isolated Sandbox
whose runtime image, persistent workspace data, cache, temporary data, and
secrets have separate ownership and lifecycles.

The current repositories do not yet provide an end-to-end commercial cloud
execution path. In particular, Agents does not own a reviewed execution intent
or placement orchestration contract, Kernel's distributed runtime PRD remains
draft, and Sandbox production runtime contracts explicitly prohibit runtime
implementation until their protected reviews are accepted.

## Goals

- Present a per-Session execution choice with exactly one reviewed local/cloud
  vocabulary and an optional Task override.
- Preserve the dependency direction
  `BirdCoder -> Agents -> Kernel -> Sandbox` in every topology.
- Keep BirdCoder a zero-business-table composition host.
- Keep local project bytes, transcripts, runtime artifacts, and execution
  state on the local deployment's owner stores unless the user explicitly
  selects cloud execution or a separate synchronization feature.
- Allocate cloud execution from a tenant-neutral Sandbox runtime pool, attach
  an authorized immutable workspace revision only after claim, and require
  sanitization evidence before reuse.
- Enforce tenant, organization, owner, Workspace, Project, Session, and
  execution scope through authorization, admission, placement, storage,
  audit, and cleanup.
- Support bounded high concurrency through distributed admission, quota,
  fairness, placement leases, fencing, backpressure, retry, and recovery.
- Separate stable domain contracts from replaceable providers, transports,
  schedulers, storage adapters, and isolation technologies.

## Non-Goals

- Adding BirdCoder-owned Workspace, Project, Session, Task, placement, or
  Sandbox persistence.
- Letting a client choose a physical node, pool slot, Sandbox id, host path,
  volume device, transport, lease token, or fencing token.
- Treating `hostMode`, `runtimeTarget`, `deploymentProfile`, or Kernel
  coordination mode as the user's per-Session execution choice.
- Treating the current client-created Runtime Binding as commercial cloud
  placement evidence.
- Uploading a local directory implicitly when the user selects local
  execution.
- Claiming container process isolation as equivalent to the reviewed cloud
  Firecracker/KVM boundary without explicit security acceptance and evidence.
- Enabling cloud UI through a build-time boolean, environment variable, or
  optimistic fallback before server capability evidence is ready.

## Candidate Product Contract Requiring Human Approval

The following vocabulary is a candidate, not a published API contract:

- `ExecutionTarget = LOCAL | CLOUD`.
- Session creation requires `executionTarget`.
- A Task may supply `executionTargetOverride`; absence inherits the Session
  target.
- Execution intent may describe a runtime profile, resource class, region or
  data-residency policy, network policy, deadline, and idempotency key.
- Resolved placement is server-owned and returns only opaque identifiers,
  lifecycle state, bounded expiry, and capability summaries to product
  clients.
- Provider/model Session continuity is a separate binding from execution
  placement.

Approval of this section is required before changing Agents OpenAPI, generated
SDKs, database schema, Kernel RPC, or Sandbox runtime ports.

## Acceptance Criteria

1. BirdCoder exposes local/cloud selection only while composing a new Session
   or explicit Task override; it never maps browser/desktop directly to
   local/cloud.
2. Selecting local resolves a valid opaque device runtime location before any
   Session is persisted. Cancellation, stale mount, missing permission, or an
   empty identity creates no Session or Runtime Binding.
3. Selecting cloud fails before Session persistence until Agents returns a
   reviewed, authenticated capability proving the complete Kernel and Sandbox
   release gate for the requested policy.
4. BirdCoder calls only generated Agents App SDK operations or approved
   composed facades. It has no direct Kernel or Sandbox dependency.
5. Local business records are persisted by the local Agents deployment and
   local project bytes remain in the user-authorized device filesystem or an
   explicitly selected local persistent volume. BirdCoder SQLite stores only
   allowlisted device facts.
6. Agents authorizes and durably stores Session execution intent and optional
   Task override. A Task references a persisted Session, Project, Workspace,
   tenant, organization, and owner; no transient `session_stub` is accepted.
7. Agents invokes one Kernel placement port for reserve, renew, release,
   cancellation, and checkpoint restore. Agents has no direct Sandbox
   lifecycle dependency.
8. Kernel owns placement selection, execution ownership, lease expiry,
   monotonic fencing, node routing, cancellation delivery, reconciliation,
   and recovery. Callers cannot write those facts.
9. Sandbox owns admission reservation, runtime pool claim, provider lifecycle,
   workspace/network/resource attachment mechanisms, readiness, cleanup,
   quarantine, and sanitization evidence. It does not own Agents Workspace,
   Project, Session, or Task semantics.
10. A pooled runtime is tenant-neutral before claim. Workspace attachment,
    tenant secrets, and tenant network grants occur only after the claim is
    fenced. Release removes all tenant state before the slot can return to the
    available pool.
11. Runtime root, persistent workspace, cache, temporary storage, and secrets
    use distinct mounts or capabilities with independent retention and cleanup
    policy. A workspace id can never be converted into a host path.
12. Every command, cancellation, renewal, completion, checkpoint, restore,
    release, and cleanup transition validates tenant scope, idempotency,
    current lease ownership, and fencing token before committing.
13. Admission enforces tenant and organization quotas, per-user limits,
    resource-class capacity, bounded queues, fairness, deadlines, and explicit
    retry guidance. No process-local semaphore is accepted as distributed
    capacity evidence.
14. Aggregate state changes, audit facts, and outbox events are committed
    atomically or through an explicitly proven transactional pattern. Event
    consumers are idempotent and ordering scope is documented.
15. Cancel, timeout, stale reconciliation, and checkpoint restore affect the
    actual Kernel/Sandbox execution, not only database status.
16. Capability responses are derived from live reviewed dependencies and
    include a contract version and reason when unavailable. BirdCoder never
    infers readiness from deployment profile or client runtime.
17. Security evidence covers authorization, cross-tenant negative tests,
    KVM/provider isolation, network egress, secret handling, image provenance,
    workspace residue, escape attempts, and compromised-node response.
18. Reliability evidence covers worker loss, gateway loss, lease expiry,
    duplicate delivery, stale completion, pool exhaustion, attachment failure,
    cleanup failure, restore, failover, drain, rollout, and rollback.
19. Performance evidence measures warm and cold allocation, queue latency,
    command-start latency, concurrent Sessions, allocation rate, fairness, and
    recovery under the approved commercial capacity model.
20. Cloud execution remains unavailable and release status remains blocked
    until every owner review and real environment evidence item in
    `REVIEW-20260730-hybrid-execution-commercial-gate.md` is accepted.

## Non-Functional Requirements

| Area | Required outcome |
| --- | --- |
| Security | Default-deny authorization, server-owned placement, tenant-isolated compute/storage/network/secrets, signed runtime artifacts, and auditable cleanup. |
| Privacy | Local workspace bytes are not uploaded by local execution; cloud data residency and retention are explicit and policy-bound. |
| Performance | Capacity and latency SLOs are approved before implementation and proven under steady-state, burst, and failure load. |
| Reliability | Durable intent, idempotent orchestration, lease/fencing, real cancellation, reconciliation, checkpoint policy, and no silent fallback. |
| Availability | Control-plane and data-plane availability targets, RTO, RPO, degradation, drain, and rollback policy are approved and monitored. |
| Operability | Fixed-cardinality metrics, correlated logs/traces/audit, tenant-safe diagnostics, pool/quota dashboards, alerts, and runbooks exist. |
| Portability | Stable ports do not expose provider-specific node, device, VM, path, or transport fields. |

## Affected Surfaces

- BirdCoder PC browser and Tauri workbench
- Agents App API, generated SDKs, domain service, persistence, and runtime facade
- Kernel placement, execution ownership, routing, recovery, and deployment
- Sandbox lifecycle, admission, pool, attachment, isolation, persistence, and
  operations

## Traceability

- [ADR-20260730 Hybrid execution ownership and placement boundaries](../../architecture/decisions/ADR-20260730-hybrid-execution-boundaries.md)
- [PLAN-2026-0002 Commercial hybrid execution delivery](../../engineering/plans/PLAN-2026-0002-commercial-hybrid-execution-delivery.md)
- [REVIEW-20260730 Commercial gate](../../engineering/reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md)
- [Hybrid execution readiness contract](../../../specs/hybrid-execution-commercial-readiness.spec.json)
- [Agents hybrid execution orchestration](../../../../sdkwork-agents/docs/product/requirements/REQ-2026-0730-hybrid-agent-execution-orchestration.md)
- [Kernel distributed runtime PRD](../../../../sdkwork-kernel/docs/product/prd/PRD-05-distributed-agent-runtime.md)
- [Sandbox runtime pool requirement](../../../../sdkwork-sandbox/docs/product/requirements/REQ-2026-0019-sandbox-runtime-pool-and-fast-allocation.md)
- [Sandbox workspace transaction requirement](../../../../sdkwork-sandbox/docs/product/requirements/REQ-2026-0021-sandbox-workspace-runtime-transaction-and-checkpoint.md)

## Verification

```bash
node scripts/hybrid-execution-commercial-readiness-contract.test.mjs
node scripts/new-task-run-mode-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/new-session-command-contract.test.ts
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentSessionProvisioning.test.ts
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
```

Cross-repository commercial verification is intentionally not listed as a
passing command until the owner requirements approve exact environments,
SLOs, security evidence, and release profiles.
