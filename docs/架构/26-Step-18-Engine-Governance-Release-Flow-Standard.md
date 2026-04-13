# Step 18 Engine Governance Release-Flow Standard

## Objective

Step 18 engine-adapter correctness must be guarded by the repository release-flow gate, not by optional root commands that can be skipped during delivery.

## Standard

- `check:release-flow` must execute:
  - `test:engine-runtime-adapter`
  - `test:engine-conformance`
  - `test:tool-protocol-contract`
  - `test:engine-resume-recovery-contract`
- `scripts/release-flow-contract.test.mjs` must assert that all four commands remain in `check:release-flow`.
- Step 18 governance promotion is incomplete if the commands exist only as standalone root scripts.

## Prohibited

- Keeping Step 18 engine governance checks outside `check:release-flow`.
- Depending on manual engineer discipline to run the engine-adapter governance quartet.
- Removing one command from `check:release-flow` without failing a contract.

## Why

- Step 18 already defines engine runtime, tool protocol, conformance, and resume/recovery as standard requirements.
- Without release-flow gating, those requirements are documented but not delivery-blocking.
- Commercial delivery needs the engine-adapter lane to fail fast under the same release gate as app, admin, release, and route-governance lanes.

## Governance

- Required verification:
  - `pnpm.cmd run test:engine-runtime-adapter`
  - `pnpm.cmd run test:engine-conformance`
  - `pnpm.cmd run test:tool-protocol-contract`
  - `pnpm.cmd run test:engine-resume-recovery-contract`
  - `node scripts/release-flow-contract.test.mjs`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`

## Evaluation Criteria

- `gate_coverage`
  - pass: all four Step 18 governance commands execute inside `check:release-flow`
  - fail: any command remains root-only
- `gate_integrity`
  - pass: `release-flow-contract.test.mjs` fails if a command is removed
  - fail: the release-flow string can drift silently
- `delivery_readiness`
  - pass: Step 18 engine-adapter governance participates in the same release gate as other commercial-delivery lanes
  - fail: engine-adapter regressions can bypass release gating

## Next Standard Target

The later governance-regression and quality-matrix score-surface lane is already a closed historical follow-on; future loops must not reopen this standard as an active next target without fresh failing evidence on the release-flow-governed Step 18 quartet itself.
