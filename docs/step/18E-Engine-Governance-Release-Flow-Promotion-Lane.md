# Step 18E - Engine Governance Release-Flow Promotion Lane

## Status

- Closed on `2026-04-11`.

## Goal

Promote the existing Step 18 root verification commands for engine runtime adapter, conformance, tool protocol, and resume or recovery into `check:release-flow` so the engine-adapter lane stops depending on ad hoc local command runs.

## Scope

- `scripts/release-flow-contract.test.mjs`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18E-Engine-Governance-Release-Flow-Promotion-Lane.md`
- `docs/架构/26-Step-18-Engine-Governance-Release-Flow-Standard.md`
- `docs/release/release-2026-04-11-23.md`

## Checkpoints

- `CP18E-1` `check:release-flow` must execute `test:engine-runtime-adapter`.
- `CP18E-2` `check:release-flow` must execute `test:engine-conformance`.
- `CP18E-3` `check:release-flow` must execute `test:tool-protocol-contract`.
- `CP18E-4` `check:release-flow` must execute `test:engine-resume-recovery-contract`.
- `CP18E-5` release-flow governance must fail if any of those commands are removed from the root release-flow script.

## Closure Facts

- `scripts/release-flow-contract.test.mjs` now makes Step 18 release-flow governance explicit by asserting the presence of:
  - `test:engine-runtime-adapter`
  - `test:engine-conformance`
  - `test:tool-protocol-contract`
  - `test:engine-resume-recovery-contract`
- `package.json` now executes the same four commands inside `check:release-flow`.
- The TDD cycle was completed on the governance contract itself:
  - added the new release-flow assertions
  - watched `release-flow-contract.test.mjs` fail because the commands were not yet present
  - promoted the commands into `check:release-flow`
  - reran the contract until it passed
- At this checkpoint, PostgreSQL live smoke was still blocked with `reasonCode=missing_postgresql_dsn`; the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.

## Verification

- `pnpm.cmd run release:smoke:postgresql-live`
- `pnpm.cmd run test:engine-runtime-adapter`
- `pnpm.cmd run test:engine-conformance`
- `pnpm.cmd run test:tool-protocol-contract`
- `pnpm.cmd run test:engine-resume-recovery-contract`
- `node scripts/release-flow-contract.test.mjs`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This slice closes release-flow governance promotion for the current Step 18 engine-adapter command quartet; it does not yet make those checks visible in governance regression or quality-matrix score outputs.
- Future reruns must preserve explicit PostgreSQL smoke status instead of reopening this already-closed Step 18 release-flow promotion lane without new evidence.
- The next non-environmental target is promoting the same Step 18 governance quartet into score-bearing governance reporting surfaces.
