# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-07-16
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, API_SPEC.md, DATABASE_SPEC.md, SDK_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, DEPLOYMENT_SPEC.md

## 1. Product And Problem

BirdCoder is a coding workbench that must keep a complete, unambiguous record
of where a project exists and where it may execute. A project can be checked
out on a Windows desktop, a server workspace, an isolated runner, or a
container volume. Each target can have a different absolute path, Git state,
worktree, capability set, and owner.

The previous project model saved desktop paths only as local mount cache
state. This made an imported project appear selected while terminal, Git, and
other actions could not reliably identify its root after recovery. A single
Project.path field would be incorrect because it would overwrite different
locations of the same project on different targets.

BirdCoder therefore keeps Project as shared identity and authorization
metadata, and persists each physical root as a separately scoped
ProjectRuntimeLocation. The complete absolute path is protected data: it is
encrypted in server persistence, accepted only through an authenticated
write-only registration flow, and decrypted only inside the verified owning
target. It is not returned in generic project data or runtime-location app API
responses.

## 2. Target Users And Outcomes

| User | Surface | Outcome |
| --- | --- | --- |
| Individual developer | Windows Tauri IDE | Import a directory once, recover its local binding, and open a terminal in the selected runtime location's verified local root without process-directory fallback. |
| Individual developer | Browser | Use project metadata and a browser directory handle without fabricating or exposing an OS path. |
| Team member | Private or cloud server | Select a project and a permitted runtime location without receiving another target's plaintext filesystem layout. |
| Runtime operator | Server, container, or runner | Register and verify project locations under a controlled service identity, with auditable capabilities and no request-path execution. |
| Support and security operator | Governed support workflow | Diagnose target/location state using safe identifiers, verification status, and trace IDs without collecting plaintext paths in ordinary logs. |

## 3. Goals And Non-Goals

Goals:

- Persist complete target-specific root information for every imported or
  provisioned project location.
- Support multiple runtime locations per project and explicit location
  selection for terminal, Git (including worktree), build, and file-system
  workflows.
- Preserve a stable Project identity while separating target-specific path,
  Git, health, and execution state.
- Use the same composed BirdCoder app SDK contract for Browser and Tauri while
  keeping native local execution behind a narrow host adapter.
- Provide per-subject, per-capability location preferences so one user's
  desktop path cannot become another user's default.
- Make import, registration, verification, rebind, recovery, and migration
  outcomes observable and safe to retry.

Non-goals:

- Exposing plaintext absolute paths, browser handles, credentials, tokens, or
  credential-bearing Git URLs in app API responses, generated SDKs, logs,
  traces, telemetry, or general project metadata.
- Treating a stored absolute path as sufficient authorization to execute on a
  remote desktop, server, container, or runner.
- Mapping a user-provided path into a server workspace without target
  authentication, canonicalization, capability validation, and authorization.
- Using process current-directory or an unrelated project root when a selected
  project has no verified location.
- Enabling a production remote runner before durable scheduling, isolation,
  secret brokering, quotas, recovery, and operator evidence exist.

## 4. In-Scope User Scenarios

1. A user imports a Tauri folder. BirdCoder creates or selects the Project,
   registers a write-only absolute path for a desktop runtime location, saves
   the local host binding, and reports success only when the required
   persistence steps complete.
2. The user restarts the desktop application, selects the project, and opens a
   terminal. BirdCoder resolves the current-device local binding for the
   terminal capability, canonicalizes the root in the native host, and starts
   the terminal there. It does not use a default process directory.
3. A local binding is unavailable or stale. The desktop user selects a folder
   again; BirdCoder performs an explicit rebind that invalidates the previous
   verification and Git snapshot before the location can become executable.
4. A browser user selects a directory. BirdCoder stores the browser handle
   only in the browser capability store. The browser handle is not converted
   to an absolute path or registered as a remote executable target.
5. A server, container, or future runner registers a location under its
   trusted target identity. Its resolver validates the project, target,
   capability, health lease, and canonical root before any filesystem action.
6. A project has locations on multiple targets. A current-subject terminal,
   Git, build, or file-system preference may guide interactive selection, but
   the resulting action carries an exact runtimeLocationId; worktree uses the
   Git selection preference. No global desktop preference leaks across users
   or devices.
7. A Git operation runs for a selected location. The target verifies repository
   state and records credential-free remote, branch, revision, and worktree
   snapshot metadata. The project-wide identity is not overwritten by a local
   branch or path.
8. A developer starts a coding session by explicitly selecting one P0 provider
   (`codex`, `claude-code`, `gemini`, or `opencode`) and an active model for
   that provider together with one terminal-capable runtime location. The
   resulting `runtimeLocationId`, provider, and model are immutable logical
   session bindings. Selecting another provider, model, or location starts
   another logical coding session rather than mutating the existing session.
   Historic sessions without a location binding remain readable but cannot run
   turns or perform native-session discovery.

## 5. Functional Requirements

1. ProjectRuntimeLocation is the authoritative remote record for a physical
   project root. It includes project and scope identity, location kind, target
   identity, logical root locator, encrypted absolute path, safe display
   metadata, capability status, health status, verification time, version, and
   audit fields.
2. Generic Project requests and responses remain free of location path fields.
   Runtime-location list and detail responses expose safe metadata only.
3. Runtime-location creation accepts a typed, write-only absolute-path input
   over authenticated TLS. The service encrypts it before persistence and
   never returns it in an app API response.
4. A location can be used only after its owning target validates the
   ProjectRuntimeLocation identifier, authorization scope, target identity,
   capability, health state, and canonical root. Raw path input is not an
   execution parameter.
5. Location changes use an explicit rebind lifecycle that resets verification
   and Git snapshot state. Generic metadata update does not silently replace a
   root.
6. Git remote URLs are credential-free. Git branch, revision, worktree, and
   capability information are target-verified location snapshots rather than
   mutable project-global state.
7. Preferences for terminal, Git, build, and file-system are scoped to the
   current subject, project, and capability. A preference points to a
   runtimeLocationId and may guide interactive selection only; an execution
   request must carry the exact identifier. Worktree uses the Git selection
   preference rather than a separate capability.
8. Browser and Tauri recovery share lifecycle states, while their capability
   implementations differ: Browser stores a permissioned directory handle;
   Tauri stores and verifies a current-device native binding.
9. API list/search behavior uses standard server pagination. Create, update,
   delete, verification, and preference operations follow SDKWork response,
   error, idempotency, and concurrency contracts.
10. A coding session stores an immutable provider/model/runtime-location
    binding. Its `codingSessionId` remains the BirdCoder logical identity,
    while the raw provider `nativeSessionId` is bound after the first
    successful provider turn and cannot be replaced by a different provider
    conversation. Every turn and native-session lookup resolves the persisted
    `runtimeLocationId`; historic sessions with no binding fail closed rather
    than using a project root, preference, session CWD, or process CWD.

## 6. Quality, Security, And Commercial Gates

| Gate | Required evidence |
| --- | --- |
| Data completeness | Project locations, target identity, path protection, capability state, Git snapshot, lifecycle, and audit metadata are persisted and retrievable through authorized service boundaries. |
| Path confidentiality | Absolute paths are encrypted at rest, write-only at the app API edge, redacted from all responses and diagnostics, and decrypted only by the authorized owning target. |
| Target isolation | Tests deny cross-tenant, cross-organization, cross-project, cross-subject, and cross-target location access or execution. |
| Location correctness | Terminal, Git, build, worktree, file, Coding Session, and native-session workflows use an exact runtime location and reject project-root, preference, process-CWD, or unrelated-root fallback. |
| Desktop recovery | Tests cover persisted binding, missing record, canceled selection, unsupported host, invalid root, stale subject, rebind, and persistence-failure compensation. |
| Browser safety | Tests prove browser handles remain local capabilities and cannot become a server path or executable target. |
| API and SDK | OpenAPI, route manifests, generated SDKs, composed SDK imports, typed ProblemDetail errors, pagination, permissions, idempotency, and concurrency checks pass. |
| Remote runtime | A pending or unverified server/runner location does not advertise or permit remote execution. Isolated-runner promotion remains separately governed. |
| Release | Database, migration, API, SDK, desktop, server, documentation, and operational evidence pass for the enabled runtime target. |

## 7. Delivery Phases

1. Distributed location foundation: ProjectRuntimeLocation persistence,
   permissions, API contracts, generated SDK, path encryption, target identity,
   verification lifecycle, and location preferences.
2. Desktop convergence: import, local binding recovery, terminal default path,
   Git/worktree resolution, explicit rebind, and failure compensation use the
   runtime-location authority.
3. Server and runner convergence: server-workspace locations, target agent
   authentication, health leases, Git/build/file resolvers, migration of
   legacy path sources, and operational runbooks.
4. Qualified remote execution: durable scheduler, isolated runner lifecycle,
   resource limits, secret boundary, recovery, audit, and capacity evidence.
5. Commercial promotion: signed packages, rollback evidence, production
   monitoring, capacity validation, and successful release gates for each
   enabled capability.

## 8. Traceability

- [REQ-2026-0001: Distributed project runtime locations](../requirements/REQ-2026-0001-distributed-project-runtime-locations.md)
- [ADR-20260716: Distributed project runtime locations](../../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Engine and coding-session lifecycle](../../reference/engine-sdk-integration.md)
- [Deployment operations](../../guides/operator/deployment-operations.md)
- [Windows Server control plane](../../guides/operator/windows-server-control-plane.md)

Global API, database, SDK, security, privacy, deployment, and test rules
remain authoritative in the corresponding sdkwork-specs documents. This PRD
records product outcomes and does not replace those contracts.
