# PLAN-2026-0002 Commercial Hybrid Execution Delivery

Status: blocked
Owner: SDKWork maintainers
Updated: 2026-07-30
Requirement: [REQ-2026-0006](../../product/requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md)
Decision: [ADR-20260730](../../architecture/decisions/ADR-20260730-hybrid-execution-boundaries.md)
Review: [REVIEW-20260730](../reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md)
Specs: ENGINEERING_WORKFLOW_SPEC.md, QUALITY_GATE_SPEC.md, CODE_REVIEW_SPEC.md, TEST_SPEC.md, RELEASE_SPEC.md

## Delivery Rule

Each phase is a separately reviewable slice. A later phase cannot use a draft
contract, mock, static check, or optimistic UI as evidence that an earlier
protected gate is complete. The dependency direction remains
`BirdCoder -> Agents -> Kernel -> Sandbox` in local and cloud topologies.

## Phase 0: Contract And Authority Approval

Scope:

- accept the BirdCoder umbrella REQ and ADR;
- create and accept the Agents execution-intent/orchestration REQ and ADR;
- resolve and accept Kernel PRD-05, then create its placement control-plane
  REQ and ADR;
- review Sandbox REQ-0019 and REQ-0021 with their dependency closure;
- select and review the cloud workspace/checkpoint byte authority;
- approve public vocabulary, tenancy, migration, SLO, security, and release
  decisions.

Exit gate:

- each owner REQ is `ready` or `accepted`;
- each boundary ADR is `accepted`;
- each required REVIEW is `Approved`;
- machine contracts agree on owner, version, state, and dependency ids;
- no contract required for implementation says
  `implementationAuthorized: false`.

No runtime, API, SDK, migration, provider, deployment, or destructive storage
change is authorized in this phase.

## Phase 1: Commercial Local Slice

Scope:

- keep BirdCoder local selection explicit and mount-before-Session;
- persist Agents business data in the approved local owner store and project
  bytes in the user-authorized filesystem or persistent volume;
- compose the local Kernel execution adapter;
- remove process-memory identity or audit stores from the production local
  profile;
- define backup, restore, purge, upgrade, and offline/degraded behavior;
- prove no implicit workspace upload.

Exit gate:

- local Session and Task intent is durable and organization-isolated;
- restart preserves required data and resumes or terminates work according to
  policy;
- missing mount, owner service, permission, or runtime fails closed;
- local cancel and restore affect real execution;
- desktop security, persistence, recovery, upgrade, and uninstall evidence is
  accepted.

## Phase 2: Agents Orchestration Slice

Scope:

- add reviewed Session target and Task override to domain, commands, DTOs,
  OpenAPI, generated SDKs, persistence, audit, and outbox;
- split provider continuity from execution placement correlation;
- replace transient Task Session stubs with canonical persisted Session links;
- add one Kernel placement port and capability negotiation;
- enforce tenant, organization, owner, Workspace, Project, and Session scope;
- implement idempotency, admission request correlation, and failure mapping.

Exit gate:

- API/SDK/database/security reviews are approved;
- generated SDKs, not handwritten transports, are used by BirdCoder;
- organization isolation, inheritance, retries, outbox atomicity, and real
  cancel/restore have focused integration tests;
- no client can write placement, lease, fencing, node, Sandbox, or attachment
  facts;
- App API operation inventory and documentation agree.

## Phase 3: Kernel Placement Control Plane

Scope:

- implement single and cluster placement behind one reviewed port;
- implement capability inventory, admission handoff, execution ownership,
  lease renewal/expiry, monotonic fencing, routing, cancellation, recovery,
  reconciliation, drain, and rollout;
- distinguish Kernel execution placement from Sandbox capacity placement;
- provide authenticated internal RPC and topology configuration;
- emit bounded metrics, traces, logs, audit correlation, and health.

Exit gate:

- claim races, stale completion, lease loss, node loss, duplicate delivery,
  gateway replacement, drain, and rollback tests pass;
- single/cluster parity and migration behavior are accepted;
- load and failure tests use real distributed coordination dependencies;
- no local-only in-process semaphore is counted as cluster admission.

## Phase 4: Cold Cloud Sandbox Slice

Scope:

- deliver one approved isolation provider without warm reuse;
- implement node trust, artifact verification, admission reservation, provider
  lifecycle, workspace/resource/network/secret attachment, command boundary,
  readiness, output, cleanup, quarantine, and persistence/reconciliation;
- attach immutable authorized Workspace revisions through the selected byte
  authority;
- prove runtime root and tenant data separation.

Exit gate:

- real KVM/provider, jailer, cgroup, network, block-volume, KMS, PostgreSQL,
  artifact provenance, escape, and cross-tenant tests are accepted;
- cleanup failure quarantines capacity;
- command cancellation, timeout, output truncation, checkpoint, restore, and
  node recovery are real environment tests;
- no draft/no-runtime marker remains on a required contract.

## Phase 5: Runtime Pool Slice

Scope:

- add tenant-neutral prewarm inventory and fenced pool claims;
- attach tenant Workspace/network/resource/secret grants only after claim;
- sanitize and verify residue-clear evidence before reuse;
- implement quota, fairness, bounded queues, capacity reservation,
  backpressure, autoscaling policy, and pool operations;
- add quarantine, image retirement, drain, and replacement workflows.

Exit gate:

- allocation races, tenant leakage, residue, pool exhaustion, fairness,
  starvation, burst, autoscaling, cleanup, and quarantine tests pass;
- warm and cold latency/capacity SLOs are proven against the approved model;
- pool reuse never weakens the cold Sandbox isolation baseline.

## Phase 6: End-To-End Commercial Release

Scope:

- enable Agents-derived cloud capability negotiation in BirdCoder;
- remove the hard-coded cloud-disabled gate only when reviewed evidence is
  live and version-compatible;
- run local and cloud end-to-end workflows including Task override, cancel,
  restore, reconnect, failover, drain, rollback, backup, and data deletion;
- produce operations dashboards, alerts, incident runbooks, tenant support
  diagnostics, capacity plans, and release artifacts.

Exit gate:

- every acceptance criterion in REQ-2026-0006 maps to accepted evidence;
- all four owner release gates pass on one immutable revision set;
- SBOM, signatures, provenance, vulnerability policy, image/volume lifecycle,
  migration, rollback, RTO/RPO, load, and security evidence is accepted;
- the readiness contract may change from `blocked` only in the same reviewed
  change that verifies all referenced evidence.

## Checkpoints

At the end of every phase record:

- exact repository revisions and contract versions;
- approved requirement, ADR, review, migration, and release ids;
- files and generated artifacts changed;
- commands, environments, important outputs, and evidence links;
- open risks, deferred criteria, expiration dates, and accountable owners;
- rollback and recovery result.

## Current Checkpoint

As of 2026-07-30:

- BirdCoder separates local/cloud intent from host mode and fails cloud closed;
- local mount resolution occurs before Session persistence and has focused
  tests;
- Agents execution placement intent and orchestration are not implemented;
- Kernel PRD-05 remains draft;
- Sandbox runtime-pool and workspace-transaction contracts remain draft and
  runtime implementation is not authorized;
- Phase 0 is blocked on the decisions in REVIEW-20260730.
