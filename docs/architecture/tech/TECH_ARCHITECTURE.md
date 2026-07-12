# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-12
Specs: `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`

## 1. Architecture Overview

BirdCoder has one product model and two runtime topologies:

```text
standalone desktop
  React/Tauri -> embedded Rust gateway -> coding-session service/store
  -> BirdCoder kernel bridge -> sdkwork-agents runtime facade -> sdkwork-kernel provider
  -> authorized local project

cloud
  web/desktop/mobile -> stateless control plane -> durable operation store/scheduler
  -> isolated workspace runner -> sdkwork-agents runtime facade -> sdkwork-kernel provider
  -> encrypted workspace volume
```

Only `standalone` and `cloud` are deployment profiles. `local-host` and `cloud-workspace` describe where one session executes.

## 2. Current Implementation Truth

| Area | State |
| --- | --- |
| Turn contract | Implemented: cwd, model/options, timeout/output budget, approval/sandbox policy, and provider-native session flow through the BirdCoder bridge. |
| Persistence | Implemented: turn/session/event finalization and native-session persistence use repository transactions and tenant-scoped project lookup. Event sequence allocation is transaction-safe. Multi-step operations (edit/delete message, approval, question answer) are wrapped in single transactions. Durable operation SQL is validated and correct. |
| OOM protection | Implemented: Codex CLI stdout capped at 10 MB, stderr at 1 MB, file reads at 8 MB. Process output is truncated or errored before unbounded memory growth. |
| Provider scope | Implemented: BirdCoder exposes only Codex, Claude Code, Gemini, and OpenCode P0 slots. |
| Provider honesty | Partially implemented: runtime and desktop CLI checks fail closed, but the server catalog still needs one authoritative runtime-health projection. |
| Installed runtime | Blocked: current artifacts do not yet contain a complete versioned provider-runtime bundle and must not depend on repository-relative worker paths. |
| Cloud execution | Blocked: no production durable scheduler, lease/fencing model, or strongly isolated workspace runner is complete yet. |

Route counts, generated SDK output, static catalog status, or synthetic smoke fixtures are contract evidence only. They are not installed-runtime evidence.

## 3. Ownership And Dependency Boundaries

- PC/H5/Flutter own presentation, session workflows, and generated SDK consumption.
- HTTP routes decode/encode SDKWork contracts and delegate to services; they do not own business policy or SQL.
- Coding-session services own validation and orchestration through repository/provider ports.
- SQLx repositories own SQLite/PostgreSQL persistence and scoped transactions.
- The standalone gateway owns process bootstrap and dependency wiring, not durable scheduling.
- The Tauri host owns native dialogs, filesystem/process/credential adapters, and embedded gateway startup, not business routes.
- `sdkwork-birdcoder-kernel-bridge` adapts BirdCoder records to `sdkwork-agents-runtime-facade`.
- `sdkwork-agents` owns managed-agent business behavior; `sdkwork-kernel` owns provider SPI and transports.
- `SDKWORK_APP_ROOT` or `SDKWORK_BIRDCODER_APP_ROOT` selects the BirdCoder application profile; `SDKWORK_IAM_APP_ROOT` remains the sibling `sdkwork-iam` catalog/database-assets root.

BirdCoder application code must not import provider internals, bypass the agents facade, handwrite HTTP around generated SDKs, or persist agents-owned business state locally.

## 4. Execution Contract

A provider turn carries the authorized working directory, engine/model, provider-native session id, approval and sandbox policies, sampling options, deadline, cancellation, and output budget. The bridge rejects empty output, probes, mocks, stubs, failed live SDK fallbacks, and any other result that cannot prove a real provider completion.

Local paths are canonicalized and must remain inside the selected project root. Cloud requests never provide a server filesystem path; the control plane resolves an opaque workspace id to an authorized runner and volume.

Provider state is split into four facts:

1. cataloged: the product knows the provider contract;
2. runtime available: required binary/worker/assets exist and authentication can be attempted;
3. conformance passed: a real installed-artifact test passed;
4. production enabled: policy allows selection for the current deployment.

Only the fourth state may be presented as ready for production use.

## 5. Data Isolation And Concurrency

Standalone desktop uses user-private SQLite/runtime files and the selected project directory. It does not upload local source by default.

Cloud metadata is scoped by tenant, organization, membership/user, workspace, project, session, and operation. PostgreSQL is authoritative for admission, idempotency, lease/fencing, ordered events, final outcome, and outbox state. Redis may accelerate realtime delivery and queue projections but cannot grant authorization or become the only operation record.

Each active runner binding receives private workspace storage, `HOME`, provider state, credentials, temporary files, process namespace, network policy, and CPU/memory/time budgets. Membership is revalidated before dispatch, attach/resume, secret grant, interaction answer, and continuation. Public arbitrary-code multi-tenancy requires a reviewed strong sandbox such as gVisor, Kata, microVM, or evidenced equivalent.

Initial admission defaults are one active turn per user and four globally, configurable via `BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS` and `BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS_PER_USER` environment variables. Leases use fencing tokens so a recovered worker cannot commit after ownership changes. Idle workspaces are suspendable and resume from durable metadata plus encrypted snapshots.

## 6. Runtime Packaging And Readiness

Desktop, server, and container releases need one provider-runtime asset contract containing:

- Node/runtime executable where a Node worker is required;
- provider worker scripts and built SDK/CLI dependencies;
- platform/architecture, versions, checksums, and license/source metadata;
- an install-root-relative resolver with no compiled repository path fallback;
- a manifest consumed by startup health, release packaging, and smoke tests.

Missing assets are a typed unavailable state. Development may use explicit environment overrides; release mode must resolve only packaged or operator-configured assets. A packaged smoke installs or extracts into a clean temporary root, starts the real binary, checks readiness, executes enabled providers, verifies cwd and native-session continuation, and confirms cleanup.

## 7. Deployment Topology

- Standalone desktop: signed Tauri bundle, embedded gateway, SQLite, user-private data, selected local project, packaged runtime manifest, and OS credential integration.
- Standalone server/appliance: one application unit with PostgreSQL where shared state is required; code execution is disabled unless an approved runtime bundle or isolated runner is configured.
- Cloud: stateless control services, PostgreSQL, scheduler/workspace manager, strong-isolation runners, encrypted workspace storage, secret broker, Redis projections, autoscaling, observability, backup, and rollback.

Cloud and standalone expose the same shared API contract. A topology that cannot execute code returns a typed unavailable capability instead of changing schemas or silently falling back.

## 8. Architecture Decisions

The product contract is [PRD.md](../../product/prd/PRD.md). Normative API,
security, deployment, persistence, SDK, and test rules are referenced from the
relative sdkwork-specs files. Historical ADRs, lane notes, and step documents
are intentionally not maintained as parallel sources of truth.

## 9. Verification

```bash
pnpm run check:arch
pnpm run check:server
pnpm run check:kernel-birdcoder-alignment
pnpm run check:agents-birdcoder-alignment
cargo test -p sdkwork-birdcoder-kernel-bridge
cargo test -p sdkwork-birdcoder-standalone-gateway
cargo test -p sdkwork-birdcoder-coding-sessions-service
cargo test -p sdkwork-birdcoder-coding-sessions-repository-sqlx
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```

## 10. Database Integrity

SQLite and PostgreSQL baselines declare inline `REFERENCES` foreign-key constraints for all session, skill, project, team, workspace, template, deployment, and commerce order tables. SQLite enables `PRAGMA foreign_keys = ON` on every connection. `studio_project_document`, `studio_deployment_target`, and `studio_deployment_record` use `INTEGER`/`BIGINT` `project_id` matching `studio_project.id`. Commerce membership numeric fields (`total_spent`, `growth_value`, `price`) use `NUMERIC`; integer counters (`points`, `remaining_days`, `duration_days`, `sort_weight`) use `INTEGER`.

Rate-limit API key buckets use SHA-256 hash of the bearer token (first 16 bytes, hex-encoded) to avoid storing any part of the secret in the rate limit store.

`list_turns` uses SQL-level `LIMIT`/`OFFSET` pagination with total count, aligned with `PAGINATION_SPEC.md` §2.

Release promotion additionally requires clean-install provider runtime smokes with mock fallback disabled and credential-backed evidence for every enabled provider.
