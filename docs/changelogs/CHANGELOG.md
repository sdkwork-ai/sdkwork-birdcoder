# BirdCoder Changelog

Status: active
Owner: SDKWork maintainers
Specs: `DOCUMENTATION_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `DEPLOYMENT_SPEC.md`

## 2026-07-16

### Changed

- Superseded the project/device-mount-only architecture with
  [ADR-20260716](../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
  and [REQ-2026-0001](../product/requirements/REQ-2026-0001-distributed-project-runtime-locations.md).
- Established ProjectRuntimeLocation as the server-persisted authority for a
  project root on one target, including encrypted absolute-path storage,
  target identity, capability/health lifecycle, Git snapshot, and
  subject-scoped terminal/Git/build preferences.
- Defined write-only path registration, redacted app API responses,
  target-owned decryption/canonicalization, explicit rebind, and no process-cwd
  fallback for terminal, Git, build, worktree, or file actions.
- Added the runtime-location operator runbook and updated product,
  architecture, topology, desktop, environment, deployment, and Windows Server
  documentation to use the same authority.

### Compatibility

BirdCoder is pre-launch. Obsolete public path behavior is removed directly.
The superseded ADR remains historical evidence; legacy path stores are
migration inputs only and must not remain parallel authorities after cutover.

### Verification

- Runtime-location repository/service/route/OpenAPI/SDK/desktop contract tests.
- Database, migration, API envelope, operation-pattern, pagination,
  SDK-consumer, server, desktop, and documentation checks.

## 2026-07-14

### Changed

- Established the unified Project, ClientMount, ProjectWorkspaceRoot,
  ExecutionLocation, and DeploymentProfile boundary in
  [ADR-20260713](../architecture/decisions/ADR-20260713-unified-project-runtime-boundary.md).
- Removed client-local project paths from the public project contract. Browser
  directory handles and Tauri native paths remain device-private capabilities.
- Documented Browser IndexedDB structured-clone recovery, Tauri host-private
  `local_store_*` SQLite KV recovery, scope isolation, explicit rebind, and the
  Tauri plaintext-at-rest limitation.
- Added the Windows Server control-plane operating model and clarified that a
  configured server workspace root does not enable remote code execution.
- Declared remote execution and real project deployment unavailable until a
  durable isolated runner and deployment executor are implemented and verified.
- Aligned deployment templates on app-scoped runtime identity, explicit
  PostgreSQL/cloud prerequisites, and non-wildcard browser origins.

### Compatibility

This is a pre-launch breaking cleanup. There is no compatibility layer for
legacy client path fields, legacy deployment-mode variables, or metadata-only
project deployment success.

### Verification

- Project API, SDK, server-root, and cross-runtime contract checks.
- Deployment template and documentation validation recorded with this change.
