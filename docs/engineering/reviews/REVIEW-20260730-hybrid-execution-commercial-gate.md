# REVIEW-20260730 Hybrid Execution Commercial Gate

Status: pending-human-review
Outcome: No-Go
Date: 2026-07-30
Owner: SDKWork maintainers
Requirement: [REQ-2026-0006](../../product/requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md)
Decision: [ADR-20260730](../../architecture/decisions/ADR-20260730-hybrid-execution-boundaries.md)
Plan: [PLAN-2026-0002](../plans/PLAN-2026-0002-commercial-hybrid-execution-delivery.md)
Specs: CODE_REVIEW_SPEC.md, QUALITY_GATE_SPEC.md, GOVERNANCE_SPEC.md, SECURITY_SPEC.md, RELEASE_SPEC.md

## Review Scope

This is the product-level entry review for the workflow spanning BirdCoder,
Agents, Kernel, Sandbox, and the selected cloud Workspace/checkpoint byte
authority. It links owner reviews but cannot approve their protected changes.

## Current Findings

| Severity | Owner | Finding | Current evidence |
| --- | --- | --- | --- |
| P0 | Agents | No reviewed Session/Task execution intent, capability negotiation, or Kernel placement orchestration exists. | Existing canonical Session REQ does not define these contracts. |
| P0 | Agents | Runtime Binding mixes placement-like fields with provider/model continuity, and the persisted binding is not consumed for real Turn placement. | Service/OpenAPI/runtime audit. |
| P0 | Agents | Task execution uses a transient Session stub; cancel, restore, and reconciliation do not stop or recover the real runtime. | Application/runtime audit. |
| P0 | Agents | Distributed admission, quota, fairness, transactional outbox, active lease/fencing, and complete organization isolation are not proven. | Repository and database audit. |
| P0 | Kernel | Distributed placement, routing, failover, and topology authority remains a draft PRD with unresolved decisions. | PRD-05 status and open questions. |
| P0 | Kernel | No accepted Agents-to-Kernel placement port and Kernel-to-Sandbox lifecycle/attachment boundary is implemented end to end. | Cross-repository dependency audit. |
| P0 | Sandbox | Required pool and workspace-transaction contracts say `implementationAuthorized: false`. | REQ-0019/0021 and machine contracts. |
| P0 | Sandbox | Real KVM/provider, network, volume, KMS, tenant isolation, residue cleanup, load, and failover evidence is missing. | Sandbox review records and delivery gates. |
| P0 | Cross-owner | Cloud Workspace/checkpoint byte authority is not approved. | Candidate is Drive or a separately reviewed block-volume owner. |
| P0 | Release | No immutable four-repository revision set has end-to-end security, load, recovery, supply-chain, migration, rollback, and operations evidence. | Release evidence absent. |
| P1 | BirdCoder | Current local pre-launch path still creates a combined Runtime Binding from the client. | Accepted only as a transitional local path, never cloud evidence. |
| P1 | BirdCoder | Cloud capability is hard-disabled rather than negotiated from reviewed Agents capability evidence. | Fail-closed implementation is correct for current state but not the final contract. |

## Decisions Requiring Explicit Approval

Each row needs an accountable owner and a recorded decision before the related
implementation phase starts.

The machine authority for the decision ids, owners, and wording is
[`hybrid-execution-commercial-readiness.spec.json`](../../../specs/hybrid-execution-commercial-readiness.spec.json).
This table mirrors that authority and is checked for exact drift.

| Id | Decision | Required reviewers | Status |
| --- | --- | --- | --- |
| HXR-001 | Approve executionPreference with LOCAL and CLOUD as user intent, and keep resolvedExecutionTarget plus placement fields server-owned. | sdkwork-agents product and API owners | pending-human-review |
| HXR-002 | Approve Session and Task migration, existing-row backfill, organization-scoped stable UUID transition, composite Task-to-Agent organization foreign key, rollback, retention, and standalone/cloud default behavior. | sdkwork-agents database and migration owners | pending-human-review |
| HXR-003 | Approve placement reserve, renew, release, cancel, and restore SPI with leases, monotonic fencing, idempotency, immutable accepted placement, and single/cluster parity. | sdkwork-kernel architecture and runtime owners | pending-human-review |
| HXR-004 | Approve the exact Local and Firecracker delivery-gate dependencies before changing implementationAuthorized. | sdkwork-sandbox architecture, security, and operations owners | pending-human-review |
| HXR-005 | Select the block-volume and checkpoint byte authority, encryption-key authority, revision promotion protocol, recovery behavior, and residue-destruction evidence. | workspace storage, KMS, Agents, and Sandbox owners | pending-human-review |
| HXR-006 | Assign reproducible Linux KVM x86_64 and aarch64 runners, Firecracker artifact tuple, signing provenance, node attestation authority, and failure-drill owners. | runtime operations and release engineering owners | pending-human-review |
| HXR-007 | Approve fallbackPolicy values none and before_start_only and remove all implicit cross-target fallback after any accepted or externally visible side effect. | sdkwork-agents and sdkwork-kernel runtime owners | pending-human-review |
| HXR-008 | Set tested bounds for admission, pool classes, allocation latency, execution deadline, reconnect grace, lifecycle retention, load, failover, recovery, and tenant fairness. | product, SRE, database, and capacity owners | pending-human-review |
| HXR-009 | Define whether LOCAL means compute placement only or complete device-only data residency; for complete residency, approve the device-local Agents authority, cloud-session routing boundary, synchronization prohibition or explicit revision-transfer protocol, purge, backup, and recovery evidence. | BirdCoder product, sdkwork-agents, privacy, and deployment owners | pending-human-review |

## Required Owner Review Chain

BirdCoder approval requires links to accepted owner evidence:

- BirdCoder product/API-consumer/data-residency review;
- Agents domain, public API/SDK, database migration, tenant authorization, and
  orchestration review;
- Kernel PRD, placement/RPC, topology, resilience, and operations review;
- Sandbox architecture/security reviews for every required provider,
  lifecycle, persistence, command, node trust, network, resource, quota,
  scheduling, pool, attachment, cleanup, and telemetry contract;
- cloud Workspace/checkpoint storage owner review;
- integrated security, performance, reliability, privacy, supply-chain,
  migration, and release review.

## Minimum Evidence For Go

- All linked REQs are `ready` or `accepted`; all boundary ADRs are `accepted`.
- Every required owner REVIEW has outcome `Approved` with no unresolved P0/P1.
- Required machine contracts authorize implementation and agree on versions
  and dependency ids.
- Local and cloud flows pass real end-to-end authorization, data residency,
  cancel, restore, restart, failover, cleanup, and deletion tests.
- Cross-tenant negative and residue tests run against the production-equivalent
  isolation and storage stack.
- Load tests prove the approved capacity/SLO model including burst, fairness,
  pool exhaustion, dependency degradation, and recovery.
- Release artifacts are signed, reproducible, traceable to an immutable
  revision set, and have SBOM/provenance/vulnerability evidence.
- Operations have dashboards, alerts, capacity forecasts, backup/restore,
  incident, drain, quarantine, rollback, and disaster-recovery runbooks.

## Current Decision

No-Go for cloud runtime implementation and commercial readiness claims.

Approved current work is limited to documentation, candidate machine
contracts, static/contract validation, and BirdCoder's fail-closed local
preflight. Public API/SDK, database migration, Kernel/Sandbox port, provider,
production topology, security policy, destructive storage, and release changes
remain blocked until their owner reviews are accepted.
