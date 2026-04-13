# Step 17D - PostgreSQL Live Smoke Preflight

## Goal

Close the PostgreSQL live-smoke preflight as an executable contract so BirdCoder can distinguish `blocked`, `passed`, and `failed` outcomes without fabricating DSN-backed closure.

## Closed Scope

- scripts/postgresql-live-smoke.ts
- scripts/run-postgresql-live-smoke.ts
- scripts/postgresql-live-smoke-contract.test.ts
- scripts/release-flow-contract.test.mjs
- scripts/governance-regression-report.mjs
- scripts/governance-regression-report.test.mjs
- package.json

## Checkpoints

- CP17D-1 `resolveBirdCoderPostgresqlLiveSmokeConfig()` resolves DSN input in this fixed order:
  - `BIRDCODER_POSTGRESQL_DSN`
  - `BIRDCODER_DATABASE_URL`
  - `DATABASE_URL`
  - `PGURL`
- CP17D-2 `runBirdCoderPostgresqlLiveSmoke()` returns one auditable state only: `blocked | passed | failed`.
- CP17D-3 blocked outcomes must expose explicit reason codes:
  - `missing_postgresql_dsn`
  - `missing_postgresql_driver`
- CP17D-3A blocked outcomes must expose executable recovery hints:
  - `dsnCmdSetExample`
  - `dsnExample`
  - `dsnEnvPriority`
  - `dsnEnvStatus`
  - `dsnPowerShellSetExample`
  - `rerunCommand`
  - `resolutionSteps`
  - `resolutionHint`
- CP17D-3B DSN-configured connection-open failures must stay auditable:
  - `runBirdCoderPostgresqlLiveSmoke()` must return `status: failed`
  - provider cleanup must not replace that report with an uncaught exception
  - `dsnSource`, `reasonCode`, and the backend error message must survive the CLI entrypoint
- CP17D-4 the CLI entry `run-postgresql-live-smoke.ts` preserves executable status semantics:
  - `0` = passed
  - `2` = blocked
  - `1` = failed
- CP17D-5 the representative smoke transaction must verify migration execution, transaction-local visibility, transaction isolation, and rollback cleanup on `release_record`.
- CP17D-6 PostgreSQL live-smoke preflight contract must stay governance-promoted:
  - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of `lint`
  - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of `check:release-flow`
  - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of governance regression aggregation

## Verification

- `pnpm.cmd run test:postgresql-live-smoke-contract`
- `cmd /d /s /c "set BIRDCODER_POSTGRESQL_DSN=postgresql://birdcoder:secret@127.0.0.1:55432/birdcoder && pnpm.cmd run release:smoke:postgresql-live"`
- `node scripts/release-flow-contract.test.mjs`
- `node scripts/governance-regression-report.test.mjs`
- `pnpm.cmd run release:smoke:postgresql-live`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run check:governance-regression`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Result Interpretation

- `blocked` is a valid closure state for DSN-less or driver-less environments.
- `blocked` must stay actionable via `dsnCmdSetExample`, `dsnExample`, `dsnEnvPriority`, `dsnEnvStatus`, `dsnPowerShellSetExample`, `rerunCommand`, `resolutionSteps`, and `resolutionHint`; blocked output is not allowed to degrade to non-actionable text only.
- `passed` may only be claimed with a real DSN-backed execution report.
- `failed` means the executable smoke path is broken and must be fixed before release/deployment closure is advanced.
- A DSN-backed `ECONNREFUSED` or comparable runtime-connectivity error is still a valid structured `failed` report; it must not degrade into an uncaught cleanup exception.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- That host-pass closure was recorded on `2026-04-13` against a temporary Docker-backed `postgres:16-alpine` instance on `127.0.0.1:55432`.
- Governance demotion of `test:postgresql-live-smoke-contract` is a release-blocking regression even when future DSN-backed runtime smoke reruns may still return `blocked`, `failed`, or `passed`.

## Next Serial Path

1. Keep `pnpm.cmd run release:smoke:postgresql-live` rerunnable on demand and treat a failing rerun as the only valid reason to reopen this lane.
2. Move the main loop back to the next unresolved non-environmental Step after PostgreSQL commercial-readiness closure.
2. Only after a real `passed` report is captured may PostgreSQL release/deployment closure be claimed.
