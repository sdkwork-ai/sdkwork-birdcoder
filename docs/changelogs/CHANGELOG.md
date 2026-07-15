# BirdCoder Changelog

Status: active
Owner: SDKWork maintainers
Specs: `DOCUMENTATION_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `DEPLOYMENT_SPEC.md`

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
