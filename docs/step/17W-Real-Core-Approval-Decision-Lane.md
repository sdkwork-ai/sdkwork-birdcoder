# Step 17W - Real Core Approval Decision Lane

## Status

- Closed on `2026-04-11`.

## Goal

Close real server behavior for `core.submitApprovalDecision`, promote it only when approval authority truth is real, and wire the first governed consumer path for approval handling.

## Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- approval authority projection/persistence slice
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- first approval-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17W-1` Rust host must stop returning `not_implemented` for `POST /api/core/v1/approvals/:approvalId/decision`.
- `CP17W-2` approval decisions must mutate one real approval authority truth, not a demo-only placeholder.
- `CP17W-3` shared core governance must promote `core.submitApprovalDecision` only when the typed write facade is executable.
- `CP17W-4` one real consumer path must submit approval decisions through the shared facade instead of rebuilding the route locally.
- `CP17W-5` docs/release must state the approval truth source, blocked conditions, and verification evidence explicitly.

## Verification

- targeted Rust approval-decision route tests
- typed shared core write facade contract for `core.submitApprovalDecision`
- shared-core governance contract
- first approval consumer contract
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves a real `POST /api/core/v1/approvals/:approvalId/decision` authority write route instead of `not_implemented`.
- Approval decisions now mutate one approval truth path in both execution modes:
  - demo/snapshot-backed host: shared in-memory projection authority
  - sqlite provider-backed host: provider tables followed by authoritative projection reload
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now promotes `core.submitApprovalDecision` into the shared core write facade; `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` is now empty.
- `ICoreWriteService`, `ApiBackedCoreWriteService`, and default IDE/context wiring now expose approval submission as a first-class shared write boundary.
- `loadCodingSessionApprovalState()`, `submitCodingSessionApprovalDecision()`, and `useCodingSessionApprovalState()` now close the first approval-facing consumer path on top of the shared facade.
- Canonical approval-resolution replay is now stable:
  - checkpoint state persists `decision`, `decisionReason`, `runtimeStatus`, `operationStatus`, `turnId`, and `operationId`
  - `operation.updated` emits `approvalDecision`, `decisionReason`, `runtimeStatus`, and `operationStatus`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Next non-environmental lane: `docs/step/17X-Real-App-Document-Catalog-Lane.md`.
3. Do not reopen approval governance unless one of the recorded verification commands fails.

## Serial Notes

1. This lane is serial because it changes shared write governance and approval truth together.
2. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.
3. Do not promote approval writes before approval reads/state are real and replayable.
