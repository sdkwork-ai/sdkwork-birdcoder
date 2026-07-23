# REQ-2026-0002 Domain Ownership Convergence

Status: accepted
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-07-23
Specs: REQUIREMENTS_SPEC.md, DOMAIN_SPEC.md, API_SPEC.md, SDK_SPEC.md, DATABASE_SPEC.md, SECURITY_SPEC.md, DOCUMENTATION_SPEC.md

## Problem

BirdCoder previously overlapped with established SDKWork owners for Project,
AI execution, assistant content, Skills, human messaging, and local runtime
state. The product is pre-launch, so compatibility structures would create
technical debt without protecting a production consumer.

Each fact must have one cohesive owner, one write lifecycle, and one canonical
SDK contract. Similar UI wording must not merge distinct business semantics:
AI assistant content is part of an Agents Session; human communication is part
of IM.

## Required Outcome

- BirdCoder server owns zero business tables.
- BirdCoder owns four System App API operations, zero Backend API operations,
  zero Open API operations, and four matching IAM permissions.
- Agents owns Project, composition, Session, Turn, Session Item, Interaction,
  Runtime Binding, Artifact, and Checkpoint.
- Skills owns package, version, artifact, capability, and installation facts.
- IM owns human Conversation, Message, Member, and ReadCursor.
- IAM organization scope plus Agents Project replaces the former workbench
  Workspace grouping.
- PC uses one canonical `projectId` for owner API calls, local mounts, and
  Sessions.
- Tauri stores only allowlisted device state; local filesystem, Git, worktree,
  and terminal capabilities do not become server facts.

## Non-Goals

- A migration projection, compatibility facade, shadow record, synchronized
  copy, or dual write.
- A BirdCoder alias for Agents Project or Session identifiers.
- Moving AI Session Items into IM because the UI displays both as messages.
- Copying owner OpenAPI, DTOs, transports, or private source into BirdCoder.
- Adding a remote execution authority to the BirdCoder gateway.
- Including H5 or Flutter implementation in the Rust-and-PC cutover.

## Acceptance Criteria

1. Root application and component contracts agree on 0 server tables, 4 App
   API operations, 0 Backend API operations, 0 Open API operations, and 4 IAM
   permissions.
2. The BirdCoder OpenAPI and generated SDK contain only the four System
   operations.
3. Rust assembly and gateway contain no BirdCoder business database, Project
   service, Workspace service, persistence repository, or matching route.
4. PC Project operations use the Agents SDK and exactly one `projectId`.
5. PC Session operations use the Agents Session hierarchy and
   `sessionRuntimeBindings`; no parallel Session or transcript authority
   remains.
6. AI Session Items and human IM Messages have separate types, services,
   lifecycle descriptions, and storage owners.
7. Project sandbox composition uses the Agents `drive/drive` slot.
8. Document composition accepts only Agents `document/documents` slots,
   resolves content through the Documents App SDK, and fails closed on an
   invalid pairing or reference before transport.
9. `ProjectDeviceMountRegistry` is subject-scoped, keyed by canonical
   `projectId`, and remains local to PC.
10. Tauri `device_state_entry` enforces its scope/key allowlist and maximum
    value size at both command and database boundaries.
11. Runtime code and authored docs contain no active local ownership claim for
    retired business aggregates or dependency APIs.
12. Rust, PC typecheck/lint, API, SDK, IAM, architecture, security,
    documentation, and reverse-scan gates pass without an accepted-debt
    allowlist.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Cohesion | Each module owns its complete business lifecycle and contract. |
| Coupling | Cross-module calls use generated owner SDKs, stable ids, or explicit ports. |
| Security | Authorization and missing local capability fail closed; sensitive local state never enters server payloads or telemetry. |
| Performance | Owner-side pagination remains authoritative; PC adaptation is bounded and in memory. |
| Reliability | Generation is reproducible and runtime composition has no hidden fallback. |
| Operability | The stateless gateway exposes health, readiness, metrics, and immutable rollback evidence. |

## Traceability

- [ADR-20260722](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [PLAN-2026-0001](../../engineering/plans/PLAN-2026-0001-domain-boundary-cutover.md)
- [MIG-2026-0002](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Machine ownership contract](../../../specs/domain-ownership.spec.json)

## Verification

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:arch
pnpm check:api-transport-standard
pnpm check:desktop
pnpm check:server
pnpm typecheck
pnpm lint
pnpm docs:build
```
