# Step 17Q - App-Level Coding Session Projection Consumer Adoption Lane

## Goal

Adopt the implemented shared core projection read facade into one default app-level coding-session detail consumer boundary without reopening not-yet-promoted core writes or rebuilding projection request paths locally.

## Closed Scope

- `packages/sdkwork-birdcoder-commons/src/context/ideServices.ts`
- `packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx`
- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts`
- `packages/sdkwork-birdcoder-commons/src/index.ts`
- `scripts/coding-session-projection-app-consumer-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17Q-1` app-level coding-session detail reads must stay on `ICoreReadService`, which already fronts the shared `BirdCoderCoreReadApiClient`.
- `CP17Q-2` `loadCodingSessionProjection()` must load `getCodingSession()` first, then load `events / artifacts / checkpoints` through the same service boundary without rebuilding route strings or DTOs locally.
- `CP17Q-3` `useCodingSessionProjection()` must expose one reusable app consumer boundary for coding-session detail, event, artifact, and checkpoint reads.
- `CP17Q-4` direct Node contracts must be able to import the projection consumer module without inventing a second runtime-only service path; shared service access must therefore stay available from a non-JSX module.
- `CP17Q-5` `check:release-flow` must execute the projection consumer contract.

## Verification

- `node --experimental-strip-types scripts/coding-session-projection-app-consumer-contract.test.ts`
- `pnpm.cmd run test:coding-session-projection-app-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep not-yet-promoted core writes outside any shared high-level facade until the corresponding typed facade is closed.
3. Only after projection-read consumer adoption stays stable under release-flow governance may higher-level typed write/response facades advance on top of real server-backed operations.
