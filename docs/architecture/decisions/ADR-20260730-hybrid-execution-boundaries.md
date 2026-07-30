# ADR-20260730 Hybrid Execution Ownership And Placement Boundaries

Status: proposed
Date: 2026-07-30
Owner: SDKWork maintainers
Requirement: [REQ-2026-0006](../../product/requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md)
Specs: ARCHITECTURE_DECISION_SPEC.md, COMPOSABLE_ARCHITECTURE_SPEC.md, APPLICATION_LAYERED_ARCHITECTURE_SPEC.md, API_SPEC.md, RPC_SPEC.md, SECURITY_SPEC.md, PERFORMANCE_SPEC.md

## Context

BirdCoder needs one user workflow that can execute on the developer device or
in an isolated cloud runtime. The four repositories currently contain useful
pieces but do not share one accepted placement contract. Existing terms also
describe different dimensions: desktop/browser is a client runtime,
standalone/cloud is a deployment profile, single/cluster is a Kernel
coordination mode, and local/cloud is the user's execution intent.

Without a strict separation, a client can appear to select cloud execution by
writing `hostMode: web`, while no scheduler, lease, Sandbox, workspace
attachment, cleanup, or tenant isolation exists behind it.

## Decision

Adopt one dependency direction and four cohesive owner boundaries:

```text
BirdCoder product UI and host adapters
  -> Agents product API and durable orchestration
    -> Kernel placement and execution control plane
      -> Sandbox isolated runtime and attachment data plane
```

No reverse or skip dependency is allowed. Local and cloud deployments compose
the same logical ports; topology changes adapters and deployment bindings, not
domain ownership.

### Owner Matrix

| Owner | Stable responsibility | Must not own |
| --- | --- | --- |
| BirdCoder | User intent, presentation, generated Agents SDK consumption, device-private mount capability | Business Session/Task data, placement, pool, Sandbox lifecycle |
| Agents | Workspace/Project/Session/Turn/Task semantics, authorization, durable execution intent, product-visible state, orchestration | Physical node selection, VM/device/path mechanics, provider-specific Sandbox lifecycle |
| Kernel | Placement policy execution, runtime capability inventory, execution ownership, leases, fencing, routing, cancel/recovery delivery | Product Workspace/Project semantics, tenant workspace bytes, Sandbox provider internals |
| Sandbox | Admission reservation, pool claim, isolated provider lifecycle, attachments, readiness, command boundary, cleanup/quarantine evidence | Product Session/Task authority, client UX, Kernel routing policy |

IAM remains the identity and permission authority. Drive or an approved
workspace-volume owner remains the cloud workspace byte authority. Sandbox
receives only scoped attachment capabilities and does not infer storage paths.

### Stable And Replaceable Parts

The following are stable contracts:

- execution intent and inheritance;
- placement lifecycle and server ownership;
- lease, expiry, fencing, idempotency, and cancellation semantics;
- workspace revision attachment and cleanup evidence;
- tenant, organization, owner, Workspace, Project, Session, and execution
  correlation;
- audit, event, error, capability, and readiness semantics.

The following are replaceable adapters behind those contracts:

- local device runtime versus cloud runtime;
- single-process versus clustered Kernel coordination;
- Firecracker, an approved local provider, and future isolation providers;
- placement algorithm, queue implementation, and autoscaling policy;
- PostgreSQL/Redis coordination implementation;
- workspace block volume, snapshot, and storage provider;
- RPC transport, node agent, image registry, and telemetry exporter.

Provider-specific values do not enter product API types.

### Candidate Domain Model

The names in this section require the reviews listed by REQ-2026-0006 before
they become API, SDK, RPC, or database authority.

`ExecutionTarget` has exactly `LOCAL` and `CLOUD`.

`ExecutionPlacementIntent` contains only caller-selectable policy:

- execution target;
- runtime profile id;
- resource class id;
- optional region/data-residency policy id;
- network policy id;
- deadline;
- idempotency key.

It cannot contain a node id, pool id, Sandbox id, VM id, volume/device/path,
transport, lease token, fencing token, or provider-private setting.

`ResolvedExecutionPlacement` is server-owned and contains opaque placement and
runtime binding ids, status, lease expiry, monotonic fencing generation,
capability summary, and attachment/readiness evidence references. Secrets and
raw lease credentials are never returned to BirdCoder.

`AgentExecutionPlacementBinding` records the Agents correlation to one Kernel
placement. `AgentProviderSessionBinding` separately records model/provider
continuity. The current combined Session Runtime Binding is not extended with
additional physical placement fields.

Session creation requires an execution target. A Task may specify an override;
otherwise it inherits the Session target. The effective target is immutable
for an execution attempt. Changing target creates a new attempt and placement,
not an in-place mutation of an active lease.

### Lifecycle

The minimum placement lifecycle is:

```text
REQUESTED -> ALLOCATING -> READY -> ACTIVE -> RELEASING -> RELEASED
                    \-> FAILED
READY/ACTIVE --------> EXPIRED
FAILED/EXPIRED ------> RELEASING -> RELEASED
```

Every transition is a compare-and-set against current version, lease owner,
and fencing generation. A stale worker may observe state but cannot renew,
complete, checkpoint, attach, detach, or release it.

Sandbox pool slots have an independent mechanism lifecycle:

```text
AVAILABLE -> CLAIMED -> PREPARING -> ATTACHED -> READY -> IN_USE
IN_USE -> SANITIZING -> AVAILABLE
any unsafe state -> QUARANTINED
```

A slot is tenant-neutral only in `AVAILABLE`. It cannot return to that state
without accepted cleanup and residue-clear evidence.

### Local Flow

1. BirdCoder resolves a user-authorized opaque device mount before creating a
   local Session.
2. Agents stores local execution intent in the local Agents deployment.
3. Agents calls the local Kernel placement adapter.
4. Kernel binds execution to the enrolled local runtime without uploading
   workspace bytes.
5. The local host resolves the opaque mount inside its trust boundary.
6. Session/Turn/Task data, transcripts, checkpoints, and runtime metadata use
   local owner persistence for this topology.

The transitional BirdCoder-created Runtime Binding is permitted only for the
current local pre-launch path. It is not a placement contract and must be
retired when the reviewed Agents placement port is delivered.

### Cloud Flow

1. BirdCoder submits reviewed execution intent to Agents through the generated
   App SDK.
2. Agents authorizes tenant, organization, owner, Workspace, Project, Session,
   policy, quota eligibility, and idempotency.
3. Kernel acquires execution ownership and asks Sandbox for a fenced admission
   reservation and pool claim.
4. Sandbox claims a tenant-neutral slot, applies resource/network grants, and
   attaches an authorized immutable workspace revision.
5. Sandbox verifies provider readiness and attachment acknowledgement.
6. Kernel exposes placement readiness to Agents; Agents activates its
   placement binding.
7. Execution commands flow through the same lease and fencing scope.
8. Completion or cancellation drains commands, detaches workspace data,
   sanitizes or quarantines the slot, releases placement, and records audit and
   outbox evidence.

No step may publish `READY` optimistically. Each owner publishes readiness
only for the facts it controls.

### Capability Negotiation

BirdCoder enables a target only from an authenticated Agents capability result
that proves the requested target and policy are currently available. The
result is versioned, bounded by expiry, and reports a stable unavailability
reason. Agents derives cloud availability from Kernel and Sandbox evidence; it
does not mirror an environment flag.

Deployment profile, client runtime target, and coordination mode remain
separate fields and cannot substitute for this result.

### Consistency And Recovery

- Product commands use caller idempotency keys and canonical payload hashes.
- Owner state and outbox/audit facts use one transactional boundary or a
  reviewed equivalent.
- Kernel placement and Sandbox allocation commands have independent provider
  idempotency scopes.
- Cancellation is durable intent plus confirmed delivery; UI status alone is
  insufficient.
- Expired leases are reconciled before reassignment, and stale completions are
  rejected by fencing.
- Checkpoints identify immutable Workspace and execution revisions. Restore
  creates a new fenced placement attempt.
- Pool cleanup failure quarantines capacity and never silently returns it.

### Tenancy And Data Separation

Tenant and organization scope is explicit in every authorization and storage
query. Database constraints and indexes lead with the required isolation
scope. Cache keys, queues, object prefixes, volume grants, metrics labels,
audit records, and logs follow the same scope without exposing secrets or
high-cardinality raw ids.

Runtime image/root, persistent workspace, cache, temp, output staging, and
secret injection use distinct capabilities and cleanup policies. Workspace
attachments are revision-bound and cannot be derived from business ids.

## Alternatives

### BirdCoder Calls Kernel Or Sandbox Directly

Rejected because it bypasses product authorization, duplicates orchestration,
and binds UI releases to infrastructure mechanics.

### Agents Calls Sandbox Directly

Rejected because placement, execution ownership, node routing, lease/fencing,
and recovery would be split across two control planes.

### Reuse `hostMode` As Execution Target

Rejected because client host and execution location are independent. A desktop
client can request cloud execution and a browser client can connect to a local
deployment.

### Persist Workspace Bytes In The Sandbox Runtime Root

Rejected because runtime replacement, pooling, cleanup, backup, retention, and
data residency would share one unsafe lifecycle.

### Allocate A Fresh Image And Workspace For Every Command

Rejected as the only strategy because it prevents bounded low-latency reuse.
The accepted design permits verified tenant-neutral warm capacity while
keeping tenant data attached only during a fenced claim.

## Consequences

- Cloud execution remains disabled until upstream authorities are reviewed and
  implemented.
- Agents needs a public contract and persistence migration; Kernel needs a
  reviewed control-plane/RPC contract; Sandbox needs approval and real provider
  evidence. These are protected changes.
- Local and cloud behavior share domain vocabulary while retaining different
  data-residency and adapter implementations.
- Pooling improves allocation latency but adds strict sanitization,
  quarantine, observability, and capacity-accounting obligations.
- Provider and storage implementations can evolve without changing BirdCoder
  or Agents product semantics.

## Verification

- BirdCoder contract tests prove host/execution separation and local
  mount-before-Session behavior.
- Agents tests must prove intent inheritance, organization isolation,
  idempotency, canonical Session use, placement orchestration, real cancel and
  restore, and transactional outbox behavior.
- Kernel tests must prove placement races, lease renewal/expiry, monotonic
  fencing, stale completion rejection, routing, recovery, drain, and failover.
- Sandbox tests must prove admission fairness, pool claim races, attachment
  authorization, readiness, residue cleanup, quarantine, cross-tenant denial,
  provider isolation, and operational recovery.
- Release evidence must include real KVM/provider, persistent volume,
  PostgreSQL/coordination, load, failover, supply-chain, security, and rollback
  environments. Mocks and static contracts are not production evidence.

## Supersedes / Superseded By

This ADR narrows the future hybrid execution extension of
ADR-20260722. It does not change BirdCoder's zero-business-table ownership.
It remains proposed until every protected decision in its linked review is
accepted.
