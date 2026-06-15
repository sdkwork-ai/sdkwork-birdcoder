# Rust Backend sdkwork-specs Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the monolithic 32,496-line `sdkwork-birdcoder-server` Rust crate into a compliant crate architecture following sdkwork-specs naming, location, separation-of-concerns, and request-context standards.

**Architecture:** Decompose the single `lib.rs` into ~23 route/service/repository crates under `crates/`, each with focused responsibility. Route crates own HTTP adaptation, service crates own business logic with port traits, repository crates own SQLite persistence, and host/server crates wire them together. The existing `iam_authority.rs` (2,549 lines) is replaced by consuming `sdkwork-appbase` IAM crates. The desktop crate is updated to depend on the new architecture.

**Tech Stack:** Rust 2021, Axum 0.8, rusqlite 0.32 (existing; SQLx migration is a future phase), tokio, tower-http, serde, sdkwork-appbase IAM crates, sdkwork-terminal crates.

---

## Current State Analysis

### Existing Crates (all under `apps/sdkwork-birdcoder-pc/packages/`)

| Crate | Lines | Current Name | Issues |
|-------|-------|-------------|--------|
| `sdkwork-birdcoder-pc-server/src-host` | 32,496 | `sdkwork-birdcoder-server` | Monolith, wrong name, wrong location |
| `sdkwork-birdcoder-pc-desktop/src-tauri` | ~2,800 | `sdkwork-birdcoder-desktop` | Wrong name, wrong location |
| `sdkwork-birdcoder-pc-codeengine/src-host` | ~14 files | `sdkwork-birdcoder-codeengine` | Wrong name, wrong location, but well-structured |
| `sdkwork-birdcoder-pc-git/src-host` | 1,211 | `sdkwork-birdcoder-git` | Wrong name, wrong location |
| `sdkwork-birdcoder-pc-host-studio/src-host` | 3 | `sdkwork-birdcoder-host-studio` | Stub, wrong name, wrong location |

### Key Statistics from `lib.rs`
- 131 structs, 2 enums, 0 traits
- 162 async handler functions
- 434 total functions
- 25+ SQLite tables (DDL in `SQLITE_PROVIDER_AUTHORITY_SCHEMA`)
- 70 route registrations in a single flat `Router::new()`
- 8,274 lines of tests (~25% of file)
- `iam_authority.rs`: 2,549 lines duplicating appbase IAM patterns
- `native_sessions.rs`: codeengine integration module

### Domain Mapping (from user-provided catalog)

| Domain | Level | Capabilities in this codebase |
|--------|-------|------------------------------|
| `iam` | L3 shared-foundation | auth, oauth, teams, policies, audit |
| `collaboration` | L2 product-feature | workspace teams |
| `platform` | L2 product-feature | workspaces, projects, git, deployments, releases |
| `system` | L3 shared-foundation | health, descriptor, route catalog, runtime, operations |
| `content` | L2 product-feature | documents |
| `intelligence` | L3 product-feature | coding sessions, turns, messages, approvals, artifacts |
| `ecosystem` | L2 product-feature | skill packages, app templates |
| `runtime` | L2 app-local-extension | engines, models, model config, native sessions |
| `commerce` | L3 shared-business | memberships, package groups |

---

## Target Crate Structure

### Complete Crate Inventory (23 new crates + 4 relocated/renamed)

#### Route Crates (under `crates/`)

| # | Crate Name | Surface | Domain/Capability |
|---|-----------|---------|-------------------|
| 1 | `sdkwork-router-system-app-api` | app-api | system (health, descriptor, routes, runtime, operations) |
| 2 | `sdkwork-router-runtime-app-api` | app-api | runtime (engines, models, model_config, native_sessions) |
| 3 | `sdkwork-router-intelligence-app-api` | app-api | intelligence (coding_sessions, turns, events, messages, artifacts, checkpoints, approvals, questions) |
| 4 | `sdkwork-router-platform-app-api` | app-api | platform (workspaces, projects, git, members, collaborators, deployments, releases, publish) |
| 5 | `sdkwork-router-content-app-api` | app-api | content (documents) |
| 6 | `sdkwork-router-ecosystem-app-api` | app-api | ecosystem (skill_packages, app_templates) |
| 7 | `sdkwork-router-commerce-app-api` | app-api | commerce (memberships, package_groups) |
| 8 | `sdkwork-router-iam-backend-api` | backend-api | iam (teams, audit_events, policies) — **consumes sdkwork-appbase crate** |
| 9 | `sdkwork-router-platform-backend-api` | backend-api | platform (deployments, releases, deployment_targets) |

#### Service Crates (under `crates/`)

| # | Crate Name | Domain/Capability |
|---|-----------|-------------------|
| 10 | `sdkwork-intelligence-coding-sessions-service` | coding sessions CRUD, turns, events, messages, artifacts, checkpoints, fork, approvals, questions |
| 11 | `sdkwork-runtime-engine-catalog-service` | engine listing, capabilities, model catalog, model config |
| 12 | `sdkwork-runtime-native-sessions-service` | native session discovery, listing, detail, summary |
| 13 | `sdkwork-platform-workspace-service` | workspace CRUD, members, realtime hub |
| 14 | `sdkwork-platform-project-service` | project CRUD, git operations, collaborators, publish |
| 15 | `sdkwork-platform-deployment-service` | deployments, releases |
| 16 | `sdkwork-ecosystem-skill-packages-service` | skill package listing, installation |
| 17 | `sdkwork-ecosystem-app-templates-service` | template listing, instantiation |
| 18 | `sdkwork-content-document-service` | document listing |
| 19 | `sdkwork-commerce-membership-service` | membership current, package groups |
| 20 | `sdkwork-system-descriptor-service` | system descriptor, route catalog, runtime metadata |

#### Repository Crates (under `crates/`)

| # | Crate Name | Notes |
|---|-----------|-------|
| 21 | `sdkwork-intelligence-coding-sessions-repository-sqlite` | Uses rusqlite (existing). Future: rename to `-sqlx` when migrated |
| 22 | `sdkwork-platform-workspace-repository-sqlite` | workspace, project, document, deployment, release tables |
| 23 | `sdkwork-ecosystem-skill-packages-repository-sqlite` | skill_package, version, capability, installation tables |
| 24 | `sdkwork-runtime-model-config-repository-sqlite` | model_config KV store |
| 25 | `sdkwork-commerce-membership-repository-sqlite` | membership tables |

#### Host/Server Crates (under `crates/`)

| # | Crate Name | Purpose |
|---|-----------|---------|
| 26 | `sdkwork-birdcoder-api-server` | HTTP server: mounts routes, constructs services, injects repos, starts listener |
| 27 | `sdkwork-birdcoder-service-host` | In-process service container (for desktop embedding) |
| 28 | `sdkwork-birdcoder-tauri-host` | Tauri desktop host: commands, adapters, terminal bridge |

#### Retained Crates (relocated + renamed, under `crates/`)

| # | New Name | Old Name | Notes |
|---|---------|---------|-------|
| 29 | `sdkwork-birdcoder-codeengine` | `sdkwork-birdcoder-codeengine` | Move to `crates/`, keep internal structure |
| 30 | `sdkwork-birdcoder-git` | `sdkwork-birdcoder-git` | Move to `crates/`, keep internal structure |

#### Removed Crates

| Old Name | Action |
|---------|--------|
| `sdkwork-birdcoder-server` | Dissolved into route/service/repo/server crates |
| `sdkwork-birdcoder-desktop` | Renamed to `sdkwork-birdcoder-tauri-host` |
| `sdkwork-birdcoder-host-studio` | Absorbed into `sdkwork-birdcoder-api-server` or removed |

### IAM Integration Strategy

**Delete** `iam_authority.rs` (2,549 lines) and **consume** sdkwork-appbase crates instead:

| Local Code | Replacement |
|-----------|-------------|
| `iam_authority::IamState` | `sdkwork_iam_context_service::IamContextService` |
| `iam_authority::resolve_session()` | `sdkwork_router_iam_app_api` middleware/extractor |
| `iam_authority::login/register/refresh/logout` | Routes from `sdkwork_router_iam_app_api` |
| `iam_authority::ensure_sqlite_iam_schema()` | `sdkwork_iam_directory_repository_sqlx` schema management |
| `iam_authority::ensure_sqlite_iam_bootstrap_user()` | `sdkwork_iam_context_service` bootstrap |
| All IAM SQLite tables (19 tables) | Managed by `sdkwork_iam_directory_repository_sqlx` |
| `IamLoginRequest`, `IamSessionPayload`, etc. | Types from `sdkwork_router_iam_app_api` |

The `sdkwork-router-iam-backend-api` crate in this project **consumes** (not duplicates) `sdkwork_router_iam_backend_api` from appbase.

---

## File Structure per Crate

### Route Crate Example: `crates/sdkwork-router-intelligence-app-api/`

```
crates/sdkwork-router-intelligence-app-api/
  Cargo.toml
  src/
    lib.rs          (~80 lines: pub mod declarations, re-exports)
    paths.rs        (path constants: CODING_SESSIONS, CODING_SESSION_TURNS, etc.)
    routes.rs       (build_intelligence_app_api_router() -> Router)
    handlers.rs     (thin handlers: decode request, call service, map response)
    manifest.rs     (deterministic route manifest for route catalog)
    error.rs        (intelligence-specific error -> ProblemDetails mapping)
    mapper/
      mod.rs
      request.rs    (CreateCodingSessionRequest -> CreateCodingSessionCommand)
      response.rs   (CodingSessionResult -> CodingSessionPayload)
      problem.rs    (ServiceError -> ProblemDetails)
```

### Service Crate Example: `crates/sdkwork-intelligence-coding-sessions-service/`

```
crates/sdkwork-intelligence-coding-sessions-service/
  Cargo.toml
  src/
    lib.rs          (~80 lines)
    error.rs        (CodingSessionError enum)
    context.rs      (SessionContext: tenant_id, user_id, etc. — NOT HTTP types)
    domain/
      mod.rs
      models.rs     (CodingSession, CodingSessionTurn, etc.)
      commands.rs   (CreateCodingSessionCommand, UpdateCodingSessionCommand)
      results.rs    (CodingSessionResult, CodingSessionListResult)
      events.rs     (CodingSessionEvent domain events)
    ports/
      mod.rs
      repository.rs (CodingSessionRepository trait)
      provider.rs   (CodeEngineProvider trait — bridges to codeengine crate)
      events.rs     (RealtimeEventPublisher trait)
    service/
      mod.rs
      coding_session_service.rs  (CRUD operations)
      coding_session_turn_service.rs (turn lifecycle)
      approval_service.rs (approval decisions)
      question_service.rs (question answers)
    test_support/
      mod.rs
      fixtures.rs
      fakes.rs      (FakeCodingSessionRepository, FakeRealtimeEventPublisher)
```

### Repository Crate Example: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/`

```
crates/sdkwork-intelligence-coding-sessions-repository-sqlite/
  Cargo.toml
  src/
    lib.rs          (~80 lines)
    error.rs
    db/
      mod.rs
      schema.rs     (CREATE TABLE statements for ai_coding_session*)
      rows.rs       (row structs matching SQLite columns)
      columns.rs    (column name constants)
    mapper/
      mod.rs
      row_mapper.rs (SQLite row -> domain model)
    repository/
      mod.rs
      coding_session_repository.rs   (impl CodingSessionRepository)
      coding_session_turn_repository.rs
      coding_session_event_repository.rs
      coding_session_artifact_repository.rs
      coding_session_checkpoint_repository.rs
```

### API Server Crate: `crates/sdkwork-birdcoder-api-server/`

```
crates/sdkwork-birdcoder-api-server/
  Cargo.toml
  src/
    main.rs         (process startup only)
    lib.rs          (~100 lines: module assembly)
    bootstrap/
      mod.rs
      config.rs     (BirdServerConfig from env/file)
      state.rs      (AppState construction)
      database.rs   (SQLite connection pool setup)
      repositories.rs (wire concrete repository implementations)
      services.rs   (wire service instances with repo ports)
      adapters.rs   (wire codeengine, git, realtime hub adapters)
      routers.rs    (mount all route crates into one Router)
    server/
      mod.rs
      listen.rs     (bind + serve)
      shutdown.rs   (graceful shutdown signal)
      middleware.rs  (CORS, request-id, logging)
    preflight/
      mod.rs
      config.rs     (validate config)
      database.rs   (schema migration check)
      dependency_surfaces.rs (verify all route surfaces mount)
    health.rs       (health check endpoint)
```

### Tauri Host Crate: `crates/sdkwork-birdcoder-tauri-host/`

```
crates/sdkwork-birdcoder-tauri-host/
  Cargo.toml
  src/
    lib.rs          (~100 lines)
    commands/
      mod.rs
      host_commands.rs        (host_mode, desktop_runtime_config)
      filesystem_commands.rs  (fs_snapshot_folder, fs_list_directory, etc.)
      terminal_commands.rs    (terminal_cli_profile_detect, bridge)
      window_commands.rs      (window controls)
      local_store_commands.rs (local_store_get/set/delete/list)
      sql_commands.rs         (local_sql_execute_plan)
    host/
      mod.rs
      state.rs      (TauriHostState)
      permissions.rs
    adapters/
      mod.rs
      filesystem.rs
      notifications.rs
    bootstrap/
      mod.rs
      services.rs   (wire services for Tauri commands)
    embedded_server.rs (start embedded Axum server using sdkwork-birdcoder-api-server)
```

---

## Migration Phases

### Phase 0: Workspace Preparation

**Goal:** Set up `crates/` directory, update root `Cargo.toml`, create empty crate scaffolds.

#### Task 0.1: Create crate directory scaffolds

Create all 30 crate directories under `crates/` with `Cargo.toml` and empty `src/lib.rs` files.

**Files:**
- Create: `crates/sdkwork-router-system-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-runtime-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-intelligence-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-platform-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-content-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-ecosystem-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-commerce-app-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-iam-backend-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-router-platform-backend-api/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-runtime-engine-catalog-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-runtime-native-sessions-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-platform-workspace-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-platform-project-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-platform-deployment-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-ecosystem-skill-packages-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-ecosystem-app-templates-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-content-document-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-commerce-membership-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-system-descriptor-service/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-platform-workspace-repository-sqlite/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-ecosystem-skill-packages-repository-sqlite/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-runtime-model-config-repository-sqlite/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-commerce-membership-repository-sqlite/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-birdcoder-api-server/Cargo.toml`, `src/main.rs`, `src/lib.rs`
- Create: `crates/sdkwork-birdcoder-service-host/Cargo.toml`, `src/lib.rs`
- Create: `crates/sdkwork-birdcoder-tauri-host/Cargo.toml`, `src/lib.rs`

**Verification:**
```bash
# All crates should be listed
ls crates/
# Each should have Cargo.toml
find crates/ -name Cargo.toml | wc -l  # expect 30
```

#### Task 0.2: Update root Cargo.toml workspace members

**Files:**
- Modify: `Cargo.toml` (root)

Add all new crate paths to `[workspace] members`. Keep old members temporarily for backward compatibility.

```toml
[workspace]
members = [
  # Legacy (will be removed in Phase 6)
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host",
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri",
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src-host",
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-git/src-host",
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-studio/src-host",
  # New route crates
  "crates/sdkwork-router-system-app-api",
  "crates/sdkwork-router-runtime-app-api",
  "crates/sdkwork-router-intelligence-app-api",
  "crates/sdkwork-router-platform-app-api",
  "crates/sdkwork-router-content-app-api",
  "crates/sdkwork-router-ecosystem-app-api",
  "crates/sdkwork-router-commerce-app-api",
  "crates/sdkwork-router-iam-backend-api",
  "crates/sdkwork-router-platform-backend-api",
  # New service crates
  "crates/sdkwork-intelligence-coding-sessions-service",
  "crates/sdkwork-runtime-engine-catalog-service",
  "crates/sdkwork-runtime-native-sessions-service",
  "crates/sdkwork-platform-workspace-service",
  "crates/sdkwork-platform-project-service",
  "crates/sdkwork-platform-deployment-service",
  "crates/sdkwork-ecosystem-skill-packages-service",
  "crates/sdkwork-ecosystem-app-templates-service",
  "crates/sdkwork-content-document-service",
  "crates/sdkwork-commerce-membership-service",
  "crates/sdkwork-system-descriptor-service",
  # New repository crates
  "crates/sdkwork-intelligence-coding-sessions-repository-sqlite",
  "crates/sdkwork-platform-workspace-repository-sqlite",
  "crates/sdkwork-ecosystem-skill-packages-repository-sqlite",
  "crates/sdkwork-runtime-model-config-repository-sqlite",
  "crates/sdkwork-commerce-membership-repository-sqlite",
  # New host/server crates
  "crates/sdkwork-birdcoder-api-server",
  "crates/sdkwork-birdcoder-service-host",
  "crates/sdkwork-birdcoder-tauri-host",
  # Relocated crates
  "crates/sdkwork-birdcoder-codeengine",
  "crates/sdkwork-birdcoder-git",
]
```

Also add workspace dependency declarations for all new internal crates and update the dependency aliases.

**Verification:**
```bash
cargo check --workspace  # All crates should compile (empty libs)
```

#### Task 0.3: Create shared error types crate

**Files:**
- Create: `crates/sdkwork-birdcoder-errors/Cargo.toml`
- Create: `crates/sdkwork-birdcoder-errors/src/lib.rs`
- Create: `crates/sdkwork-birdcoder-errors/src/problem_details.rs`

Extract `ProblemDetailsPayload` and `ApiEnvelope`/`ApiListEnvelope` response wrappers into a shared errors crate that all route crates depend on. This implements RFC 9457 Problem Details.

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-errors
```

---

### Phase 1: Domain Models and Shared Types Extraction

**Goal:** Extract DTOs, domain models, and shared types from the monolith into service crates.

#### Task 1.1: Extract intelligence domain models

Extract from `lib.rs` lines 1678-2135 (CodingSession*, CodingSessionTurn*, CodingSessionEvent*, CodingSessionArtifact*, CodingSessionCheckpoint*, CodingSessionOperation*, approval/question types).

**Files:**
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/domain/models.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/domain/commands.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/domain/results.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/domain/events.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/domain/mod.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/error.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/context.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/ports/repository.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/ports/provider.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/ports/events.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/ports/mod.rs`
- Modify: `crates/sdkwork-intelligence-coding-sessions-service/src/lib.rs`
- Modify: `crates/sdkwork-intelligence-coding-sessions-service/Cargo.toml`

**Structs to extract (from lib.rs):**
- `CodingSessionRow` (line 1678) → `domain/models.rs`
- `CodingSessionRuntimeRow` (line 1692) → `domain/models.rs`
- `CodingSessionTurnRow` (line 1705) → `domain/models.rs`
- `CodingSessionEventRow` (line 1717) → `domain/models.rs`
- `CodingSessionArtifactRow` (line 1729) → `domain/models.rs`
- `CodingSessionCheckpointRow` (line 1741) → `domain/models.rs`
- `CodingSessionOperationRow` (line 1752) → `domain/models.rs`
- `CodingSessionPayload` (line 1773) → `domain/results.rs`
- `CodingSessionTurnPayload` (line 1976) → `domain/results.rs`
- `CodingSessionEventPayload` (line 1992) → `domain/results.rs`
- `CodingSessionCheckpointPayload` (line 2074) → `domain/results.rs`
- `CodingSessionArtifactPayload` (line 2086) → `domain/results.rs`
- `ApprovalDecisionPayload` (line 2099) → `domain/results.rs`
- `UserQuestionAnswerPayload` (line 2115) → `domain/results.rs`
- `OperationPayload` (line 1763) → `domain/results.rs`
- `CreateCodingSessionRequest` (line 1801) → `domain/commands.rs`
- `CreateCodingSessionInput` (line 1810) → `domain/commands.rs`
- `UpdateCodingSessionRequest` (line 1821) → `domain/commands.rs`
- `UpdateCodingSessionInput` (line 1829) → `domain/commands.rs`
- `ForkCodingSessionRequest`/`Input` (line 1844) → `domain/commands.rs`
- `EditCodingSessionMessageRequest`/`Input` (line 1854) → `domain/commands.rs`
- `CreateCodingSessionTurnRequest`/`Input` (line 1889/1918) → `domain/commands.rs`
- `SubmitApprovalDecisionRequest`/`Input` (line 1948) → `domain/commands.rs`
- `SubmitUserQuestionAnswerRequest`/`Input` (line 1960) → `domain/commands.rs`
- `CodingSessionTurnCurrentFileContextPayload` (line 1864) → `domain/models.rs`
- `CodingSessionTurnIdeContextPayload` (line 1872) → `domain/models.rs`
- `CodingSessionTurnOptionsPayload` (line 1881) → `domain/models.rs`
- `PendingProjectionTurnExecution` (line 1930) → `domain/events.rs`
- `FinalizedProjectionTurnExecution` (line 1941) → `domain/events.rs`
- `ProjectionMutationEvent<T>` (line 2129) → `domain/events.rs`

**Ports to define:**
- `CodingSessionRepository` trait: `list_sessions`, `get_session`, `create_session`, `update_session`, `delete_session`, `create_turn`, `list_turns`, `list_events`, `list_artifacts`, `list_checkpoints`, etc.
- `CodeEngineProvider` trait: `execute_turn`, `submit_approval`, `submit_question_answer` (bridges to `sdkwork-birdcoder-codeengine`)
- `RealtimeEventPublisher` trait: `publish_workspace_event` (bridges to `WorkspaceRealtimeHub`)

**Verification:**
```bash
cargo check -p sdkwork-intelligence-coding-sessions-service
```

#### Task 1.2: Extract platform domain models

Extract workspace, project, deployment, release, document, team types from `lib.rs`.

**Files:**
- Create: `crates/sdkwork-platform-workspace-service/src/domain/models.rs`
- Create: `crates/sdkwork-platform-workspace-service/src/domain/commands.rs`
- Create: `crates/sdkwork-platform-workspace-service/src/domain/results.rs`
- Create: `crates/sdkwork-platform-workspace-service/src/ports/repository.rs`
- Create: `crates/sdkwork-platform-workspace-service/src/ports/events.rs`
- Modify: `crates/sdkwork-platform-workspace-service/src/lib.rs` + `Cargo.toml`
- Create: `crates/sdkwork-platform-project-service/src/domain/` (same structure)
- Create: `crates/sdkwork-platform-project-service/src/ports/`
- Modify: `crates/sdkwork-platform-project-service/src/lib.rs` + `Cargo.toml`
- Create: `crates/sdkwork-platform-deployment-service/src/domain/` (same structure)
- Modify: `crates/sdkwork-platform-deployment-service/src/lib.rs` + `Cargo.toml`

**Structs to extract:**
- `WorkspacePayload` (line 845), `CreateWorkspaceRequest` (1107), `UpdateWorkspaceRequest` (1136)
- `WorkspaceMemberPayload` (1394), `UpsertWorkspaceMemberRequest` (1453)
- `WorkspaceScopedQuery` (1089)
- `ProjectPayload` (900), `CreateProjectRequest` (1163), `UpdateProjectRequest` (1207)
- `ProjectCollaboratorPayload` (1423), `UpsertProjectCollaboratorRequest` (1465)
- `PublishProjectRequest` (1520), `PublishProjectResultPayload` (1533)
- `DeploymentPayload` (1313), `DeploymentTargetPayload` (1477)
- `ReleasePayload` (1498)
- `DocumentPayload` (1290)
- `TeamPayload` (1340), `TeamMemberPayload` (1372)
- Git request DTOs: `CreateProjectGitBranchRequest` (1237), `SwitchProjectGitBranchRequest` (1243), `CommitProjectGitChangesRequest` (1249), `PushProjectGitBranchRequest` (1255), `CreateProjectGitWorktreeRequest` (1262), `RemoveProjectGitWorktreeRequest` (1269)

**Verification:**
```bash
cargo check -p sdkwork-platform-workspace-service
cargo check -p sdkwork-platform-project-service
cargo check -p sdkwork-platform-deployment-service
```

#### Task 1.3: Extract remaining domain models

Extract ecosystem, content, commerce, runtime, system types.

**Files:**
- Create: `crates/sdkwork-ecosystem-skill-packages-service/src/domain/` (models, commands, results)
- Create: `crates/sdkwork-ecosystem-app-templates-service/src/domain/`
- Create: `crates/sdkwork-content-document-service/src/domain/`
- Create: `crates/sdkwork-commerce-membership-service/src/domain/`
- Create: `crates/sdkwork-runtime-engine-catalog-service/src/domain/`
- Create: `crates/sdkwork-runtime-native-sessions-service/src/domain/`
- Create: `crates/sdkwork-system-descriptor-service/src/domain/`

**Structs to extract:**
- `SkillCatalogEntryPayload` (969), `SkillPackagePayload` (1000), `SkillInstallationPayload` (1033), `InstallSkillPackageRequest` (1200)
- `AppTemplatePayload` (1055)
- `DocumentPayload` (1290)
- `CommerceMembershipBenefitPayload` (1585), `CommerceMembershipCurrentPayload` (1605), `CommerceMembershipPackagePayload` (1630), `CommerceMembershipPackageGroupPayload` (1649)
- `AuthoritativeEngineRuntimeProfile` (1837), `NativeSessionQueryParams` (1902), `NativeSessionLookupQueryParams` (1912)
- `HealthPayload` (771), `DescriptorPayload` (788), `GatewayDescriptorPayload` (788), `RouteCatalogEntryPayload` (817), `RuntimePayload` (837)
- `AuditPayload` (1541), `PolicyPayload` (1561)
- `ProjectionOperationsField` (4290)
- All OpenAPI types (lines 2202-2291)

**Verification:**
```bash
cargo check --workspace  # All service crates compile with domain types
```

---

### Phase 2: Repository Layer

**Goal:** Extract SQLite operations from the monolith into repository crates implementing service-defined ports.

#### Task 2.1: Extract intelligence repository

Extract all `ai_coding_session*` table operations from `lib.rs`.

**Files:**
- Create: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/src/db/schema.rs`
  - Extract DDL for: `ai_coding_session`, `ai_coding_session_message`, `ai_coding_session_runtime`, `ai_coding_session_turn`, `ai_coding_session_event`, `ai_coding_session_artifact`, `ai_coding_session_checkpoint`, `ai_coding_session_operation`, `ai_coding_session_prompt_entry`
- Create: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/src/db/rows.rs`
  - Extract row structs matching SQLite columns
- Create: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/src/mapper/row_mapper.rs`
  - Extract `build_*_payload_from_row` functions (lines 7720-8000+)
- Create: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/src/repository/coding_session_repository.rs`
  - Implement `CodingSessionRepository` trait
  - Extract SQL queries from handler bodies and `ProjectionAuthorityState` methods
- Modify: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/src/lib.rs`
- Modify: `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/Cargo.toml`
  - Dependencies: `rusqlite`, `serde`, `serde_json`, `uuid`, `time`, `sdkwork-intelligence-coding-sessions-service`

**Key functions to extract:**
- `ProjectionAuthorityState::create_coding_session` (line 13827)
- `ProjectionAuthorityState::session` / `sessions` / `session_snapshot` (lines 13762-13777)
- All `load_provider_*_rows` functions (lines 7374-7720)
- All `build_*_payload_from_row` functions (lines 7720-8000+)
- SQL INSERT/UPDATE/DELETE queries from handler bodies

**Verification:**
```bash
cargo check -p sdkwork-intelligence-coding-sessions-repository-sqlite
```

#### Task 2.2: Extract platform repository

**Files:**
- Create: `crates/sdkwork-platform-workspace-repository-sqlite/src/db/schema.rs`
  - Tables: `studio_workspace`, `studio_project`, `studio_project_document`, `studio_deployment_target`, `studio_deployment_record`, `studio_team`, `studio_team_member`, `ops_release_record`, `ops_audit_event`, `ops_governance_policy`
- Create: `crates/sdkwork-platform-workspace-repository-sqlite/src/repository/` (workspace, project, deployment, document, team repositories)
- Modify: `crates/sdkwork-platform-workspace-repository-sqlite/Cargo.toml`

**Key functions to extract:**
- All workspace CRUD SQL from `app_workspaces`, `app_create_workspace`, `app_update_workspace`, `app_delete_workspace` handlers
- All project CRUD SQL from `app_projects`, `app_create_project`, etc.
- `resolve_tenant_id_from_parent` (line 4958)
- `has_workspace` (line 15037)
- Team/deployment/release SQL from backend handlers

**Verification:**
```bash
cargo check -p sdkwork-platform-workspace-repository-sqlite
```

#### Task 2.3: Extract remaining repositories

**Files:**
- Create: `crates/sdkwork-ecosystem-skill-packages-repository-sqlite/src/` (schema + repositories for `ai_skill_package*`, `studio_app_template*`)
- Create: `crates/sdkwork-runtime-model-config-repository-sqlite/src/` (model config KV store)
- Create: `crates/sdkwork-commerce-membership-repository-sqlite/src/` (membership tables)
- Modify: All corresponding `Cargo.toml` files

**Verification:**
```bash
cargo check -p sdkwork-ecosystem-skill-packages-repository-sqlite
cargo check -p sdkwork-runtime-model-config-repository-sqlite
cargo check -p sdkwork-commerce-membership-repository-sqlite
```

#### Task 2.4: Extract seed data and schema migration logic

Extract `ensure_sqlite_catalog_seed_data` (line 3147) and all schema migration helpers.

**Files:**
- Move to: `crates/sdkwork-birdcoder-api-server/src/bootstrap/database.rs` (or a shared migration crate)
- Extract: `sqlite_column_exists`, `sqlite_column_is_not_null`, `ensure_sqlite_table_column`, `ensure_sqlite_table_column_is_not_null`, `backfill_workspace_business_columns` (lines 4514-4611)

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-api-server
```

---

### Phase 3: Service Layer

**Goal:** Implement service logic that orchestrates business rules using repository ports.

#### Task 3.1: Implement intelligence coding sessions service

**Files:**
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/service/coding_session_service.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/service/coding_session_turn_service.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/service/approval_service.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/service/question_service.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/service/mod.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/test_support/fixtures.rs`
- Create: `crates/sdkwork-intelligence-coding-sessions-service/src/test_support/fakes.rs`
- Modify: `crates/sdkwork-intelligence-coding-sessions-service/src/lib.rs`

**Business logic to extract from lib.rs handlers:**
- Session CRUD: validation, engine/model immutability check (`ensure_coding_session_engine_model_immutable`, line 3594), projection state management
- Turn lifecycle: create turn → execute via codeengine → stream events → finalize
- Approval/question forwarding: `submit_live_provider_approval_decision` (line 14965), `submit_live_provider_user_question_answer` (line 14990)
- Fork logic: `resolve_fork_source_session_and_events` (line 23756)
- Session state: `ProjectionSnapshot`, `ProjectionReadState`, `ProjectionAuthorityState` (lines 2135-2166)

**Key design decisions:**
- Service receives `SessionContext` (tenant_id, user_id) — NOT HTTP headers
- Service calls repository via trait, not concrete SQLite
- Service calls codeengine via trait, not direct SDK
- Service publishes realtime events via trait, not direct WebSocket

**Verification:**
```bash
cargo check -p sdkwork-intelligence-coding-sessions-service
cargo test -p sdkwork-intelligence-coding-sessions-service  # fakes + fixtures compile
```

#### Task 3.2: Implement platform services

**Files:**
- Create: `crates/sdkwork-platform-workspace-service/src/service/workspace_service.rs`
  - Extract: workspace CRUD, member management, realtime hub publishing
- Create: `crates/sdkwork-platform-project-service/src/service/project_service.rs`
  - Extract: project CRUD, git operations (delegates to `sdkwork-birdcoder-git`), collaborator management, publish
- Create: `crates/sdkwork-platform-deployment-service/src/service/deployment_service.rs`
  - Extract: deployment/release listing
- Modify: All `lib.rs` and `Cargo.toml` files

**Verification:**
```bash
cargo check -p sdkwork-platform-workspace-service
cargo check -p sdkwork-platform-project-service
cargo check -p sdkwork-platform-deployment-service
```

#### Task 3.3: Implement remaining services

**Files:**
- Create service files for: `sdkwork-runtime-engine-catalog-service`, `sdkwork-runtime-native-sessions-service`, `sdkwork-ecosystem-skill-packages-service`, `sdkwork-ecosystem-app-templates-service`, `sdkwork-content-document-service`, `sdkwork-commerce-membership-service`, `sdkwork-system-descriptor-service`

**Key extractions:**
- Engine catalog: `build_engine_catalog` (line 3403), `build_model_config` (line 3456), `resolve_authoritative_engine_runtime_profile` (line 3549)
- Native sessions: `list_native_sessions_async`, `get_native_session_async`, `get_native_session_summary_async` (lines 21935-21982)
- System descriptor: `core_descriptor`, `core_route_catalog`, `core_runtime` handler logic
- Seed data: `ensure_sqlite_catalog_seed_data` (line 3147)

**Verification:**
```bash
cargo check --workspace
```

---

### Phase 4: Route Crates and IAM Integration

**Goal:** Create route crates with thin handlers that consume typed `AppRequestContext` and call services.

#### Task 4.1: Set up AppRequestContext

The existing `sdkwork-appbase` crates provide `AppRequestContext`. Wire it as an Axum extractor.

**Files:**
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/routers.rs` (context injection middleware)
- Modify: All route crate `handlers.rs` to consume `AppRequestContext` instead of raw headers

**Design:**
```rust
// In api-server middleware (before route handlers):
// 1. Resolve session from Authorization/Access-Token/x-sdkwork-iam-session-id headers
// 2. Build AppRequestContext with tenant_id, user_id, session_id, etc.
// 3. Insert as request extension
// 4. Route handlers extract via Extension<AppRequestContext>

// handlers.rs pattern:
async fn handler(
    Extension(ctx): Extension<AppRequestContext>,
    State(state): State<IntelligenceServiceState>,
    Json(body): Json<CreateCodingSessionRequest>,
) -> Result<Json<ApiEnvelope<CodingSessionPayload>>, ProblemDetails> {
    let command = map_create_request_to_command(body, &ctx);
    let result = state.service.create_session(ctx.principal(), command).await?;
    Ok(Json(ApiEnvelope::new(map_result_to_payload(result))))
}
```

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-api-server
```

#### Task 4.2: Create intelligence route crate

**Files:**
- Create: `crates/sdkwork-router-intelligence-app-api/src/paths.rs`
  - Constants: `CODING_SESSIONS`, `CODING_SESSION`, `CODING_SESSION_TURNS`, `CODING_SESSION_EVENTS`, `CODING_SESSION_ARTIFACTS`, `CODING_SESSION_CHECKPOINTS`, `CODING_SESSION_MESSAGES`, `APPROVALS`, `QUESTIONS`
- Create: `crates/sdkwork-router-intelligence-app-api/src/routes.rs`
  - `build_intelligence_app_api_router() -> Router`
- Create: `crates/sdkwork-router-intelligence-app-api/src/handlers.rs`
  - Extract all coding session handlers (lines 22628-23859)
  - Each handler: thin adapter — extract context, call service, map response
- Create: `crates/sdkwork-router-intelligence-app-api/src/manifest.rs`
  - Route manifest for `/app/v3/api/coding_sessions*` routes
- Create: `crates/sdkwork-router-intelligence-app-api/src/error.rs`
  - `CodingSessionError` → `ProblemDetails` mapping
- Create: `crates/sdkwork-router-intelligence-app-api/src/mapper/` (request.rs, response.rs, problem.rs)
- Modify: `crates/sdkwork-router-intelligence-app-api/src/lib.rs`
- Modify: `crates/sdkwork-router-intelligence-app-api/Cargo.toml`

**Handlers to extract:**
- `core_sessions` (GET /coding_sessions) → line 22628
- `core_create_session` (POST /coding_sessions) → line 22862
- `core_session` (GET /coding_sessions/{id}) → line 22787
- `core_update_session` (PATCH /coding_sessions/{id}) → line 22989
- `core_delete_session` (DELETE /coding_sessions/{id}) → line 23049
- `core_fork_session` (POST /coding_sessions/{id}/fork) → line 22915
- `core_create_turn` (POST /coding_sessions/{id}/turns) → line 23286
- `core_session_events` (GET /coding_sessions/{id}/events) → line 23680
- `core_session_artifacts` (GET /coding_sessions/{id}/artifacts) → line 23808
- `core_session_checkpoints` (GET /coding_sessions/{id}/checkpoints) → line 23859
- `core_delete_session_message` (DELETE /coding_sessions/{id}/messages/{messageId}) → line 23116
- `core_edit_session_message` (PATCH /coding_sessions/{id}/messages/{messageId}) → line 23195
- `core_submit_approval_decision` (POST /approvals/{approvalId}/decision) → line 23553
- `core_submit_user_question_answer` (POST /questions/{questionId}/answer) → line 23612

**Verification:**
```bash
cargo check -p sdkwork-router-intelligence-app-api
```

#### Task 4.3: Create remaining route crates

Repeat the pattern from Task 4.2 for all other route crates.

**Files:**
- `crates/sdkwork-router-system-app-api/src/` (paths, routes, handlers, manifest, error, mapper)
  - Handlers: `core_health`, `core_descriptor`, `core_route_catalog`, `core_runtime`, `core_operation`
- `crates/sdkwork-router-runtime-app-api/src/`
  - Handlers: `core_engines`, `core_engine_capabilities`, `core_models`, `core_model_config`, `core_sync_model_config`, `core_native_sessions`, `core_native_session`, `core_native_session_providers`
- `crates/sdkwork-router-platform-app-api/src/`
  - Handlers: all workspace, project, git, member, collaborator, deployment, publish handlers
- `crates/sdkwork-router-content-app-api/src/`
  - Handlers: `app_documents`
- `crates/sdkwork-router-ecosystem-app-api/src/`
  - Handlers: `app_skill_packages`, `app_install_skill_package`, `app_templates`
- `crates/sdkwork-router-commerce-app-api/src/`
  - Handlers: `app_commerce_membership_current`, `app_commerce_membership_package_groups`
- `crates/sdkwork-router-iam-backend-api/src/`
  - Consumes `sdkwork_router_iam_backend_api` from appbase, adds birdcoder-specific admin routes
- `crates/sdkwork-router-platform-backend-api/src/`
  - Handlers: `admin_deployment_targets`, `admin_releases`, `admin_deployments`

**Verification:**
```bash
cargo check --workspace
```

#### Task 4.4: Wire IAM integration via appbase

**Files:**
- Modify: `crates/sdkwork-birdcoder-api-server/Cargo.toml` (add appbase IAM deps)
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/iam.rs`
  - Initialize `sdkwork_iam_context_service::IamContextService`
  - Set up IAM middleware that resolves `AppRequestContext` from tokens
  - Mount `sdkwork_router_iam_app_api` routes for auth/OAuth/profile endpoints
- Modify: `crates/sdkwork-birdcoder-api-server/src/bootstrap/routers.rs`
  - Mount IAM routes from appbase crate

**What gets deleted:**
- `iam_authority.rs` (2,549 lines) — replaced by appbase
- All IAM-related handler functions in old `lib.rs` — replaced by appbase route mounts
- All IAM SQLite table DDL — managed by appbase repository

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-api-server
# Integration test: IAM login/session/refresh/logout flow works
```

---

### Phase 5: Server and Host Assembly

**Goal:** Wire everything together in the API server and Tauri host crates.

#### Task 5.1: Implement API server bootstrap

**Files:**
- Create: `crates/sdkwork-birdcoder-api-server/src/main.rs`
- Create: `crates/sdkwork-birdcoder-api-server/src/lib.rs`
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/config.rs`
  - Extract: `BirdServerRuntimeConfigFile`, `BirdServerAuthorityConfigFile`, `AuthorityBootstrapConfig` (lines 1659-1678)
  - Extract: `resolve_authority_bootstrap` (line 4271)
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/state.rs`
  - Construct `AppState` that holds service instances, realtime hub, etc.
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/database.rs`
  - SQLite connection setup, schema migration, seed data
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/repositories.rs`
  - Wire concrete SQLite repository implementations
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/services.rs`
  - Wire service instances with repository ports
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/adapters.rs`
  - Wire codeengine provider registry, git operations, realtime hub
- Create: `crates/sdkwork-birdcoder-api-server/src/bootstrap/routers.rs`
  - Mount all route crates: `build_app_api_router()` = merge(system, runtime, intelligence, platform, content, ecosystem, commerce, iam)
  - Mount backend routes: `build_backend_api_router()` = merge(iam_backend, platform_backend)
  - Apply CORS middleware
- Create: `crates/sdkwork-birdcoder-api-server/src/server/listen.rs`
- Create: `crates/sdkwork-birdcoder-api-server/src/server/shutdown.rs`
- Create: `crates/sdkwork-birdcoder-api-server/src/server/middleware.rs`
  - Extract: `build_local_cors_layer` (line 24182)
- Create: `crates/sdkwork-birdcoder-api-server/src/preflight/` (config, database, dependency_surfaces)
- Create: `crates/sdkwork-birdcoder-api-server/src/health.rs`
- Modify: `crates/sdkwork-birdcoder-api-server/Cargo.toml`

**Verification:**
```bash
cargo build -p sdkwork-birdcoder-api-server
# Server starts, health endpoint responds
```

#### Task 5.2: Implement service host

**Files:**
- Create: `crates/sdkwork-birdcoder-service-host/src/lib.rs`
- Create: `crates/sdkwork-birdcoder-service-host/src/bootstrap/` (config, state, database, repositories, services, adapters)
- Create: `crates/sdkwork-birdcoder-service-host/src/host/service_container.rs`
- Modify: `crates/sdkwork-birdcoder-service-host/Cargo.toml`

This crate provides the in-process service container that the Tauri host embeds. It shares the same service/repository wiring as the API server but without HTTP routes.

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-service-host
```

#### Task 5.3: Implement Tauri host

**Files:**
- Create: `crates/sdkwork-birdcoder-tauri-host/src/lib.rs`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/host_commands.rs`
  - Extract: `host_mode`, `desktop_runtime_config` from old desktop lib.rs
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs`
  - Extract: `fs_snapshot_folder`, `fs_list_directory`, `fs_read_file`, `fs_write_file`, `fs_create_file`, `fs_create_directory`, `fs_delete_entry`, `fs_rename_entry`, `fs_get_file_revision`, `fs_get_file_revisions`, `fs_get_directory_revisions`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/terminal_commands.rs`
  - Extract: `terminal_cli_profile_detect`, terminal bridge integration
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/window_commands.rs`
  - Extract: window control bridge
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/local_store_commands.rs`
  - Extract: `local_store_get`, `local_store_set`, `local_store_delete`, `local_store_list`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/commands/sql_commands.rs`
  - Extract: `local_sql_execute_plan`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/host/state.rs`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/adapters/filesystem.rs`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/bootstrap/services.rs`
- Create: `crates/sdkwork-birdcoder-tauri-host/src/embedded_server.rs`
  - Start embedded Axum server using `sdkwork-birdcoder-api-server`
- Modify: `crates/sdkwork-birdcoder-tauri-host/Cargo.toml`

**Verification:**
```bash
cargo check -p sdkwork-birdcoder-tauri-host
```

#### Task 5.4: Relocate codeengine and git crates

**Files:**
- Move: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/` → `crates/sdkwork-birdcoder-codeengine/`
- Move: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-git/` → `crates/sdkwork-birdcoder-git/`
- Modify: Root `Cargo.toml` workspace members (remove old paths, keep new)
- Update all internal dependency paths

**Verification:**
```bash
cargo check --workspace
```

---

### Phase 6: Test Migration and Cleanup

**Goal:** Migrate the 8,274 lines of tests and remove old crates.

#### Task 6.1: Migrate tests to appropriate crates

The test module (lines 24222-32496) should be distributed:

**Files:**
- Service unit tests → `crates/sdkwork-intelligence-coding-sessions-service/src/test_support/` and `tests/`
- Repository tests → `crates/sdkwork-intelligence-coding-sessions-repository-sqlite/tests/`
- Route integration tests → `crates/sdkwork-router-intelligence-app-api/tests/`
- API server bootstrap tests → `crates/sdkwork-birdcoder-api-server/tests/`
- Move test fixtures: `TestGitRepositoryFixture` → `crates/sdkwork-birdcoder-git/src/test_support/`
- Move test fixtures: `FakeCodexCliGuard`, `FakeCodexHomeGuard` → `crates/sdkwork-birdcoder-codeengine/src/test_support/`

**Verification:**
```bash
cargo test --workspace
```

#### Task 6.2: Remove old crates

**Files:**
- Remove: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/` (entire directory)
- Remove: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/` (entire directory)
- Remove: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/` (moved)
- Remove: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-git/` (moved)
- Remove: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-studio/` (absorbed)
- Modify: Root `Cargo.toml` (remove old workspace members)

**Verification:**
```bash
cargo check --workspace
cargo test --workspace
```

#### Task 6.3: Update TypeScript desktop host references

The TypeScript `sdkwork-birdcoder-pc-desktop` package likely has Tauri command imports. Update any `invoke()` calls or type imports to match new command names if they changed.

**Files:**
- Modify: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/` (TS files referencing Tauri commands)

**Verification:**
```bash
pnpm run typecheck
pnpm run lint
```

#### Task 6.4: Update documentation and AGENTS.md

**Files:**
- Modify: `AGENTS.md` (update crate references)
- Modify: `crates/README.md` (update with actual crate listing)
- Create: `crates/sdkwork-*/README.md` for each crate (brief description)

**Verification:**
```bash
pnpm run check:arch
```

---

### Phase 7: Verification and Compliance

**Goal:** Full compliance check against sdkwork-specs.

#### Task 7.1: Naming compliance audit

```bash
# Verify no forbidden suffixes in crate names
grep -r "product\|runtime\|backend\|core\|common\|manager\|server-runtime" crates/*/Cargo.toml

# Verify all crates follow naming patterns
# Route: sdkwork-router-<capability>-<surface>
# Service: sdkwork-<domain>-<capability>-service
# Repository: sdkwork-<domain>-<capability>-repository-sqlite
# Server: sdkwork-<app>-api-server
# Host: sdkwork-<app>-tauri-host
```

#### Task 7.2: Structure compliance audit

```bash
# Verify lib.rs is < 150 lines in each crate
find crates/ -name lib.rs -exec wc -l {} \;

# Verify no SQL in route crates
grep -r "SELECT\|INSERT\|UPDATE\|DELETE\|CREATE TABLE" crates/sdkwork-router-*/src/

# Verify no HTTP types in service crates
grep -r "axum\|StatusCode\|Json\|Extension" crates/sdkwork-*/service/src/

# Verify no business logic in handlers (check handler line counts)
find crates/sdkwork-router-*/src/handlers.rs -exec wc -l {} \;
```

#### Task 7.3: Request context compliance

```bash
# Verify no raw header parsing in route handlers
grep -r "header.*Authorization\|header.*Access-Token\|header.*X-API-Key\|header.*tenant_id" crates/sdkwork-router-*/src/handlers.rs

# Verify all handlers consume AppRequestContext
grep -c "AppRequestContext" crates/sdkwork-router-*/src/handlers.rs
```

#### Task 7.4: Full build and test

```bash
cargo build --workspace
cargo test --workspace
cargo clippy --workspace
pnpm run lint
pnpm run typecheck
pnpm run check:arch
```

---

## Dependency Graph (Target State)

```
sdkwork-birdcoder-api-server
├── sdkwork-router-system-app-api
│   └── sdkwork-system-descriptor-service
├── sdkwork-router-runtime-app-api
│   ├── sdkwork-runtime-engine-catalog-service
│   │   └── sdkwork-birdcoder-codeengine
│   ├── sdkwork-runtime-native-sessions-service
│   │   └── sdkwork-birdcoder-codeengine
│   └── sdkwork-runtime-model-config-repository-sqlite
├── sdkwork-router-intelligence-app-api
│   └── sdkwork-intelligence-coding-sessions-service
│       ├── sdkwork-intelligence-coding-sessions-repository-sqlite
│       ├── sdkwork-birdcoder-codeengine (via port trait)
│       └── sdkwork-birdcoder-git (via port trait)
├── sdkwork-router-platform-app-api
│   ├── sdkwork-platform-workspace-service
│   │   └── sdkwork-platform-workspace-repository-sqlite
│   ├── sdkwork-platform-project-service
│   │   ├── sdkwork-platform-workspace-repository-sqlite
│   │   └── sdkwork-birdcoder-git
│   └── sdkwork-platform-deployment-service
│       └── sdkwork-platform-workspace-repository-sqlite
├── sdkwork-router-content-app-api
│   └── sdkwork-content-document-service
├── sdkwork-router-ecosystem-app-api
│   ├── sdkwork-ecosystem-skill-packages-service
│   │   └── sdkwork-ecosystem-skill-packages-repository-sqlite
│   └── sdkwork-ecosystem-app-templates-service
│       └── sdkwork-ecosystem-skill-packages-repository-sqlite
├── sdkwork-router-commerce-app-api
│   └── sdkwork-commerce-membership-service
│       └── sdkwork-commerce-membership-repository-sqlite
├── sdkwork-router-iam-backend-api (consumes appbase)
│   └── sdkwork_router_iam_backend_api (from sdkwork-appbase)
├── sdkwork-router-platform-backend-api
│   └── sdkwork-platform-deployment-service
├── sdkwork_iam_context_service (from sdkwork-appbase)
├── sdkwork_router_iam_app_api (from sdkwork-appbase)
└── sdkwork_birdcoder_errors

sdkwork-birdcoder-tauri-host
├── sdkwork-birdcoder-api-server (embedded server)
├── sdkwork-birdcoder-service-host
├── sdkwork-terminal-* crates
└── sdkwork_appbase_tauri_host
```

---

## Risk Mitigation

### Backward Compatibility During Migration

1. **Phase 0-3:** Old crates remain in workspace. New crates are additive only. No behavior changes.
2. **Phase 4:** Route crates are created alongside old handlers. The API server can mount EITHER old or new routes via feature flag.
3. **Phase 5:** New API server starts alongside old one on a different port for integration testing.
4. **Phase 6:** Old crates removed only after all tests pass on new architecture.

### SQLite Schema Stability

The migration does NOT change the SQLite schema. Repository crates use the same tables and columns. Schema migration code is extracted verbatim.

### Desktop Embedding

The Tauri host embeds the API server. During migration, the desktop can use either the old monolithic server or the new API server via a feature flag in `Cargo.toml`.

### SDK Compatibility

Generated Rust SDKs (`sdkwork-birdcoder-app-sdk-rust`, `sdkwork-birdcoder-backend-sdk-rust`) are NOT changed by this migration. They consume the HTTP API contract, which remains identical.

---

## Summary of Changes by Phase

| Phase | New Crates | Lines Extracted | Lines Deleted |
|-------|-----------|----------------|---------------|
| 0 | 30 scaffolds + shared errors | 0 (empty) | 0 |
| 1 | 0 (fill service crates) | ~3,500 (DTOs/models) | 0 |
| 2 | 0 (fill repo crates) | ~6,000 (SQL/mappers) | 0 |
| 3 | 0 (fill service logic) | ~5,000 (business logic) | 0 |
| 4 | 0 (fill route crates) | ~4,000 (handlers) | 0 |
| 5 | 0 (fill server/host) | ~2,000 (bootstrap) | 0 |
| 6 | 0 (migrate tests) | ~8,274 (tests) | ~32,496 (old lib.rs) + 2,549 (iam_authority.rs) |
| **Total** | **30 new crates** | **~28,774 lines redistributed** | **~35,045 lines removed** |

The net result: a 32,496-line monolith becomes ~30 focused crates, each under 1,000 lines, with clear responsibility boundaries, proper IAM integration via appbase, and full sdkwork-specs compliance.
