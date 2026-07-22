# ADR-20260722 Domain Ownership And Single-Write Authority

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-22
Requirement: [REQ-2026-0002](../../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOMAIN_SPEC.md`, `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `DATABASE_SPEC.md`, `SCHEMA_REGISTRY_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `MIGRATION_SPEC.md`

## Context

BirdCoder has not launched, but its current initialization database and API
authority contain multiple platform domains. AI coding sessions, assistant
chat, skills, IAM, documents, templates, deployments, models, settings, and
commerce are represented as BirdCoder-owned tables and operations even though
dedicated SDKWork repositories exist. That structure creates duplicate
systems of record and encourages local SDK and DTO forks.

The word `chat` caused an additional ambiguity. BirdCoder's current
`chat_conversation` and `chat_message` records contain user, assistant, and
system roles and trigger model generation. They are agent-session content, not
human IM messages. IM itself currently depends on Agents for agent invocation,
so moving this content into IM would invert responsibility and couple Agents
back to a communication channel.

## Decision

BirdCoder owns only the coding-workbench bounded context. Its durable facts are
workspace and project identity, project-to-document binding, target-scoped
runtime locations and preferences, and project-to-sandbox binding. The exact
ten-table target is authoritative in `specs/domain-ownership.spec.json`.

All AI execution and assistant conversation state is owned by
`sdkwork-agents` under this vocabulary:

```text
Agent Project -> Session -> Turn -> Session Item -> Interaction
```

A BirdCoder project stores one optional stable
`default_agent_project_id`. It never stores an Agents session or a copy of
session state. Session items represent durable model/user/tool content;
interactions represent approvals, questions, and other input required to
continue a turn. Transport events and UI view adapters are not additional
business aggregates.

Human communication remains owned by `sdkwork-im`:

```text
Conversation -> Message -> Member -> ReadCursor
```

IM may call Agents through the public Agents SDK or facade and may store stable
correlation ids. The Agent session item and an IM-visible message remain two
different facts with different ownership and lifecycle. Dependency direction
is `sdkwork-im -> sdkwork-agents -> sdkwork-kernel`; Agents never depends on IM.

Skills owns package identity, immutable artifacts, normalized capabilities,
artifact-capability relations, installations, assets, and actions. JSON arrays
do not remain a competing capability or category authority.

All other capabilities move to the owners declared by the machine contract.
BirdCoder consumes their generated SDK families or approved runtime facades.
It does not copy dependency OpenAPI into its app SDK, does not write another
module's tables, and does not add cross-repository foreign keys.

Persistent projection tables, replay-built read authorities, synchronized
shadow tables, and dual-write are prohibited. A pure in-memory UI mapping may
adapt a provider or SDK DTO to a view model, but it must be named as an adapter
or view model and cannot become durable state or a second domain contract.

Because the application is pre-launch, the migration is a direct cutover.
Obsolete operations, tables, crates, packages, SDK types, tests, and current
documentation are removed after their owner replacement passes parity tests.
No compatibility facade or deprecated alias is retained.

## Alternatives

### Keep BirdCoder as an aggregate database and API

Rejected. Physical co-deployment does not transfer domain ownership. It would
retain multiple write owners and make independent module evolution unsafe.

### Move AI chat records to IM

Rejected. The records are model-session content, not human communication. It
would mix business semantics and risk a dependency cycle between IM and Agents.

### Keep local projections for fast reads

Rejected. The requested architecture excludes projection authorities, and the
current product scale does not justify duplicate persistence. Owners instead
provide indexed canonical queries and bounded pagination.

### Keep compatibility routes and dual-write

Rejected. BirdCoder is pre-launch. Compatibility would add failure modes and
technical debt without protecting a released consumer.

## Consequences

- Agents and Skills must reach SQLite/PostgreSQL, API, SDK, and operational
  parity before BirdCoder removes their local implementations.
- BirdCoder clients use multiple owner SDK families composed at the runtime or
  core boundary; feature UI remains transport-independent.
- The BirdCoder app SDK becomes smaller and contains only workbench operations.
- Backend and Open API authorities are retired unless a future BirdCoder-owned
  bounded context is approved through a new ADR.
- Database bootstrap composes owner registries without copying dependency DDL
  into the BirdCoder-owned schema contract.
- Active documentation describes only the final ownership model. Migration
  evidence records temporary implementation state.

## Verification

- The ownership checker derives forbidden tables, paths, and components from
  `specs/domain-ownership.spec.json`.
- Database registries and both DDL engines contain exactly the owned table set.
- Owner OpenAPI and SDK generation succeed; BirdCoder generated inputs contain
  no dependency-owned operations.
- Cargo and pnpm graphs contain no forbidden BirdCoder session/chat/skills
  components after cutover.
- Static scans prove Agents has no IM dependency and persistent projection
  authorities are absent.
- Cross-tenant, idempotency, concurrency, pagination, migration, security, and
  documentation gates pass before release promotion.

## Supersedes / Superseded By

This decision supersedes every active BirdCoder statement that treats
`codingSessionId`, AI chat conversation/message, skill packages, or copied
platform APIs as BirdCoder-owned. It does not supersede
ADR-20260716's encrypted project runtime-location boundary; that capability
remains part of the workbench context and is narrowed by this decision.

