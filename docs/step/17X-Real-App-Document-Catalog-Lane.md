# Step 17X - Real App Document Catalog Lane

## Status

- Closed on `2026-04-11`.

## Goal

Turn `GET /api/app/v1/documents` from a `not_implemented` placeholder into a real representative app-surface authority read, then wire the first shared facade and first consumer path without reopening already-closed core lanes.

## Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- representative document authority slice on shared provider/UoW truth
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- default IDE app/admin service wiring for document reads
- first document-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17X-1` Rust host must stop returning `not_implemented` for `GET /api/app/v1/documents`.
- `CP17X-2` document catalog truth must come from one replayable authority path, not a page-local mock list.
- `CP17X-3` the shared typed app/admin facade must promote `app.listDocuments` only after server behavior is real.
- `CP17X-4` one real consumer path must read documents through the shared service/facade instead of rebuilding the route locally.
- `CP17X-5` docs/release must state which representative app/admin routes remain blocked after the document lane closes.

## Verification

- targeted Rust app-document route tests
- generated app/admin facade contract for `app.listDocuments`
- provider-backed console contract for `project_documents`
- first document consumer contracts
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves a real `GET /api/app/v1/documents` authority read route instead of `not_implemented`.
- Document catalog truth now converges on one replayable authority path in all current execution modes:
  - demo host: in-process `AppState.documents`
  - legacy sqlite `kv_store`: materialized into provider-side `project_documents`
  - direct sqlite provider: loaded from `project_documents`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now promotes `app.listDocuments` into the shared generated app/admin facade through `listDocuments()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now close the representative document repository/query/transport slice on top of shared provider truth.
- `IDocumentService`, `ApiBackedDocumentService`, `createDefaultBirdCoderIdeServices()`, shared contexts, `loadDocuments()`, and `useDocuments()` now close the first document-facing consumer path on the shared facade boundary.
- `check:release-flow` now executes document service and document consumer governance alongside the existing app/admin facade contracts.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Next non-environmental lane: `docs/step/17Y-Real-Admin-Audit-Lane.md`.
3. Do not reopen document governance unless one of the recorded verification commands fails.

## Serial Notes

1. This lane is serial because it changes representative app-surface route truth, shared app/admin facade governance, and consumer adoption together.
2. Keep `app.listDeployments`, `admin.listAuditEvents`, `admin.listPolicies`, and `admin.listDeployments` blocked until their own real authority lanes close.
3. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.
