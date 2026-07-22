# REQ-2026-0002 Domain Ownership Convergence

Status: in-progress
Owner: SDKWork maintainers
Source: customer
Priority: P0
Date: 2026-07-22
Specs: `DOMAIN_SPEC.md`, `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `DATABASE_SPEC.md`, `SCHEMA_REGISTRY_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `MIGRATION_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`

## Problem

BirdCoder currently persists and publishes capabilities that already have
dedicated SDKWork owners. AI coding sessions and assistant transcripts overlap
Agents, skill packages overlap Skills, human access and governance overlap IAM,
and documents, templates, deployments, model configuration, and commerce facts
overlap their respective modules. The duplicated schemas and APIs create more
than one write authority, make dependency direction ambiguous, and force every
client to understand product-local variants of platform contracts.

The AI transcript tables named `chat_conversation` and `chat_message` are not
human IM facts. Their roles and reply generation are part of an agent session.
Moving them to IM would preserve the ambiguity instead of removing it.

## Goals

- Keep one system of record and one write owner for every business fact.
- Use the Agents `Agent Project -> Session -> Turn -> Session Item ->
  Interaction` model for every BirdCoder AI coding and assistant workflow.
- Keep IM `Conversation -> Message -> Member -> ReadCursor` semantics exclusive
  to human or channel communication.
- Move reusable skill package, artifact, capability, and installation facts to
  Skills.
- Reduce BirdCoder persistence to coding-workbench workspace, project, document
  binding, runtime-location, and sandbox-binding facts.
- Generate and consume each dependency API through its owning SDK family. Do
  not copy dependency OpenAPI operations into BirdCoder SDK generation input.
- Remove persistent projections, synchronized shadow tables, local cache
  authorities, compatibility facades, and long-term dual-write.
- Make SQLite and PostgreSQL contracts equivalent and production-verifiable.

## Non-Goals

- Moving AI assistant messages into IM because both concepts use the word
  message.
- Adding a second BirdCoder session identifier beside the Agents session id.
- Keeping product-local DTO or HTTP compatibility layers for an application
  that has not launched.
- Sharing database tables or creating cross-repository foreign keys.
- Replacing generated SDK integration with raw HTTP or manual credentials.
- Treating UI view adaptation as a persistent projection or a second business
  authority.

## Acceptance Criteria

1. `specs/domain-ownership.spec.json` is the machine-readable BirdCoder
   ownership contract and all active contracts agree with it.
2. BirdCoder owns exactly the ten tables declared by that contract. Both
   SQLite and PostgreSQL baselines, registries, repository SQL, and tests agree.
3. BirdCoder contains no AI session, assistant transcript, skill package,
   identity/governance, document content, template, deployment, model setting,
   membership, order, invoice, payment, or notification table authority.
4. BirdCoder persists only `studio_project.default_agent_project_id` as the
   stable link to Agents. It stores no Agents session, turn, item, interaction,
   event, artifact, checkpoint, or runtime snapshot.
5. AI session APIs and clients use Agents Project/Session/Turn/SessionItem/
   Interaction terminology. BirdCoder has no `/coding_sessions` or
   `/chat/conversations` AI routes.
6. Human IM continues to use Conversation/Message/Member/ReadCursor and may
   invoke Agents through a public SDK/facade. Agents has no IM dependency.
7. Skills is the only owner of skill package/artifact/capability/installation
   persistence and exposes SQLite/PostgreSQL-parity APIs and SDKs.
8. BirdCoder Backend API and Open API each contain zero application-owned
   operations. The App API contains only coding-workbench-owned operations.
9. Dependency OpenAPI, generated DTOs, SDK transports, route crates, services,
   repositories, tests, and active documentation have no stale BirdCoder-owned
   copies after cutover.
10. Tenant and organization isolation, object authorization, idempotency,
    optimistic concurrency, bounded SQL pagination, audit redaction, and
    sensitive runtime-location handling pass on both database engines.
11. Architecture, database, API, SDK, dependency, documentation, security,
    performance, migration, and release-readiness gates pass without an
    allow-known-debt mode.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Cohesion | Each module owns a complete business capability, including persistence, service policy, API, SDK, specs, tests, and current documentation. |
| Coupling | Cross-domain integration uses stable ids, generated SDKs, runtime facades, or declared ports; no shared-table writes or private-source imports. |
| Performance | Online lists paginate in the owning store with tenant-leading indexes and stable tie-breakers; no full-table load or replay-built read authority. |
| Security | Typed request context, dual-token enforcement, object authorization, redacted logging, bounded idempotency keys, and no cross-tenant fallback are mandatory. |
| Reliability | Direct pre-launch cutover is deterministic and forward-fixable; no compatibility dual-write or silent fallback remains. |
| Operations | Database bootstrap, health, drift, backup/restore, migration verification, SDK reproducibility, observability, and rollback evidence are required before release. |

## Affected Components

- `sdkwork-birdcoder`: product persistence, API assembly, app SDKs, PC/H5/
  Flutter consumers, runtime composition, specs, and docs.
- `sdkwork-agents`: Agent Project, Session, Turn, Session Item, Interaction,
  runtime binding, artifact, checkpoint, API, SDK, and runtime facade.
- `sdkwork-skills`: package, artifact, capability, installation, dual-engine
  persistence, API, and SDK.
- `sdkwork-im`: normalized human communication model and one-way Agents
  integration.
- Owner modules listed in `specs/domain-ownership.spec.json`.

## Traceability

- [ADR-20260722: Domain ownership and single-write authority](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [MIG-2026-0002: Domain ownership cutover](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Implementation plan](../../engineering/plans/PLAN-2026-0001-domain-boundary-cutover.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Machine ownership contract](../../../specs/domain-ownership.spec.json)

## Verification

- `pnpm check:domain-ownership`
- `pnpm db:validate`
- `pnpm check:arch`
- `pnpm check:api-response-envelope`
- `node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .`
- `node ../sdkwork-specs/tools/check-route-path-collisions.mjs --workspace .`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict`
- `node ../sdkwork-specs/tools/check-application-layering.mjs --root .`
- `node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .`
- `pnpm docs:build`

