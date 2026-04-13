# Step 18A - Engine Source Mirror Truth Lane

## Status

- Closed on `2026-04-11`.

## Goal

Freeze the real source-mirror truth for `codex / claude-code / gemini / opencode` in `workbench/kernel.ts`, then make source-status drift executable through repository contracts and release-flow governance.

## Scope

- `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts`
- `scripts/engine-kernel-contract.test.ts`
- `scripts/engine-source-mirror-contract.test.ts`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/release-2026-04-11-19.md`

## Checkpoints

- `CP18A-1` if `external/<engine>` exists, shared source metadata must not keep that engine on placeholder truth.
- `CP18A-2` `claude-code` must no longer remain `sdk-only` while `external/claude-code` exists.
- `CP18A-3` `opencode` must no longer remain `extension` or fragment-only truth while `external/opencode` exists as the mirrored repository baseline.
- `CP18A-4` source-mirror truth must become release-blocking through executable contracts.
- `CP18A-5` PostgreSQL blocked state must stay explicit and must not be conflated with this Step 18 closure.

## Closure Facts

- `workbench/kernel.ts` now freezes:
  - `codex -> mirrored repository`
  - `claude-code -> mirrored repository`
  - `gemini -> mirrored repository`
  - `opencode -> mirrored repository`
- `scripts/engine-kernel-contract.test.ts` now matches the updated shared source truth.
- `scripts/engine-source-mirror-contract.test.ts` is the new focused contract that proves:
  - repository-relative `externalPath`
  - `sourceStatus=mirrored`
  - `sourceKind=repository`
  - mirror path exists in the current workspace
  - notes do not regress to missing-mirror or fragment-only claims
- `check:release-flow` now executes both contracts.

## Verification

- `pnpm.cmd run release:smoke:postgresql-live`
- `node --experimental-strip-types scripts/engine-source-mirror-contract.test.ts`
- `node --experimental-strip-types scripts/engine-kernel-contract.test.ts`
- `pnpm.cmd run test:engine-runtime-adapter`
- `pnpm.cmd run test:engine-conformance`
- `pnpm.cmd run test:tool-protocol-contract`
- `pnpm.cmd run test:engine-resume-recovery-contract`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This lane closes source-mirror metadata truth only; it does not yet remove workbench/server duplication for engine descriptor or model-catalog definitions.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- Next non-environmental slice: promote shared engine descriptor and model-catalog truth deeper into `coding-server`.
