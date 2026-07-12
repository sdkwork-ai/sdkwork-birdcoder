# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: `sdkwork-birdcoder`
Updated: 2026-07-12
Specs: `REQUIREMENTS_SPEC.md`, `DOCUMENTATION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`

## 1. Product And Problem

BirdCoder is a coding workbench that runs the same user workflow in two places:

- `standalone`: a desktop installation operates on a user-selected local project.
- `cloud`: a web or desktop client operates on an isolated managed workspace.

The first product milestone is real, resumable coding turns through Codex, Claude Code, Gemini CLI, and OpenCode. A catalog entry, a detected executable, a mock response, or a green route test is not a completed turn. Readiness is proven by an installed artifact changing the requested project and by the persisted session being resumable.

## 2. Users And Modes

| User | Mode | Outcome |
| --- | --- | --- |
| Individual developer | Local desktop | Edit, run, inspect, and continue work in a local directory. |
| Individual or team developer | Cloud workspace | Resume the same workspace from multiple devices without exposing another user's files or credentials. |
| Operator | Cloud control plane | Observe capacity, isolate failures, drain workers, and recover accepted work. |

PC is the primary editing client. Web, H5, and Flutter provide progressively narrower session, event, approval, and artifact workflows until full editor parity is justified by usage evidence.

## 3. Goals And Non-Goals

Goals:

- Keep only the SDKWork deployment profiles `standalone` and `cloud`; execution placement is a session property, not a third profile.
- Execute real turns with the effective project directory, model, approval/sandbox policy, timeout, output budget, cancellation, and provider-native session continuation.
- Fail closed when a provider runtime, credential, or conformance check is missing. Never persist a fake successful assistant turn.
- Keep local files local unless the user explicitly imports or synchronizes them.
- Isolate cloud tenant, organization, membership, user, workspace, provider state, credentials, temporary files, processes, network, and resource budgets.
- Bound concurrency and storage so idle workspaces can suspend and active work can recover after worker loss.

Non-goals for the first release:

- Implicitly uploading a local directory or tunneling a cloud request into a user's machine.
- Exposing OpenClaw, Hermes, Rig, or another experimental provider as a P0 coding engine.
- Claiming public multi-tenant arbitrary-code execution on a shared kernel without a reviewed strong sandbox.

## 4. P0 Functional Requirements

1. A user can create/select a workspace and project, submit a turn, observe bounded events, inspect file changes, cancel the turn, and continue the same coding session.
2. Local execution is restricted to the authorized project root and uses user-private runtime/database files.
3. Cloud execution is accepted durably, runs in a workspace-bound runner, and exposes one ordered terminal outcome after reconnect or worker recovery.
4. Provider selection shows declaration, runtime availability, authentication, and conformance as separate states. Unavailable providers cannot become the default.
5. Tenant and membership checks are enforced on every read, write, dispatch, attach/resume, secret grant, and interaction answer.
6. H5 and Flutter use the same generated SDK contracts and receive typed unavailable, cancelled, failed, and indeterminate outcomes.

## 5. Isolation And Capacity Requirements

Cloud metadata is scoped by tenant, organization, user/membership, and workspace. Workspace storage, `HOME`, provider state, credentials, temporary files, process tree, and network policy are private to the active binding. Credentials are short-lived, scoped, redacted, and removed when a binding ends.

The control plane admits work through durable idempotency and bounded queues. Initial defaults are one active turn per user and four globally, configurable via `BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS` and `BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS_PER_USER` environment variables. Provider and cluster limits are measured and configurable. Idle workspaces may suspend after ten minutes. PostgreSQL is the cloud source of truth; Redis is a delivery/cache projection and never the authorization source.

Rate-limit API key buckets use SHA-256 hash of the bearer token (first 16 bytes, hex-encoded) to avoid storing any part of the secret in the rate limit store. Turn list queries use SQL-level `LIMIT`/`OFFSET` pagination with total count, aligned with `PAGINATION_SPEC.md` §2. Event sequence allocation, message edit/delete, and approval decisions are wrapped in single database transactions to guarantee atomicity.

## 6. Acceptance Gates

| Gate | Evidence required |
| --- | --- |
| Local provider | Clean installed package, real file edit, effective cwd, model, native-session continuation, bounded output, cancellation, cleanup. |
| Cloud isolation | Cross-tenant denial tests, separate workspace volumes and credentials, concurrent queue/load test, worker-loss recovery. |
| Release | Runtime asset manifest with versions/checksums, signed artifacts, SBOM, readiness probe, rollback and operator evidence. |

The current repository has the turn propagation, transaction-safe persistence, OOM-protected process output (stdout capped at 10 MB, stderr at 1 MB), SQL-level pagination, SHA-256 rate-limit bucket hashing, and fail-closed bridge tests. Packaged provider runtime assets and the cloud runner/scheduler remain release blockers until their gates pass.

## 7. Delivery Phases

1. Local alpha: complete runtime asset packaging and real conformance for all four P0 providers.
2. Durable execution beta: asynchronous operation state, idempotency, cancellation, ordered events, and restart-safe finalization.
3. Isolated cloud beta: runner lifecycle, encrypted workspace storage, secret broker, admission control, recovery, and denial evidence.
4. Enterprise/public release: HA, backup/restore, capacity evidence, signed/SBOM artifacts, runbooks, and cross-surface release smokes.

## 8. Traceability

- The product contract is defined by this PRD and the technical contract in
  [TECH_ARCHITECTURE.md](../../architecture/tech/TECH_ARCHITECTURE.md).
- Normative API, security, deployment, persistence, SDK, and test rules remain
  in the relative sdkwork-specs files; this document does not duplicate them.

## 9. Decisions Still Required

- Select the provider-runtime bundle format and CI build source for the first signed desktop/server packages.
- Select the strong sandbox implementation for public cloud arbitrary-code execution.
- Set provider mix and absolute concurrency ceilings from measured capacity, not estimates.
