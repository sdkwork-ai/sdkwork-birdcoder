# Step 18C - Rust Host Engine Truth Artifact Lane

## Status

- Closed on `2026-04-11`.

## Goal

Make Rust host `/api/core/v1/engines`, `/api/core/v1/engines/:engineKey/capabilities`, and `/api/core/v1/models` auditable against promoted `coding-server` engine truth by replacing local manual fixtures with a generated shared engine-catalog artifact.

## Scope

- `scripts/generate-rust-host-engine-catalog.ts`
- `scripts/rust-host-engine-truth-contract.test.ts`
- `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18C-Rust-Host-Engine-Truth-Artifact-Lane.md`
- `docs/架构/24-Rust-Host-Engine-Truth-Artifact-Standard.md`
- `docs/release/release-2026-04-11-21.md`

## Checkpoints

- `CP18C-1` Rust host must not keep local manual engine descriptor/model fixture assembly.
- `CP18C-2` Rust host must load engine/model truth from a generated artifact derived from promoted `coding-server` truth.
- `CP18C-3` the generated artifact must stay byte-auditable against `listBirdCoderCodingServerEngines()` and `listBirdCoderCodingServerModels()`.
- `CP18C-4` the new Rust host truth contract must become release-blocking.
- `CP18C-5` Rust host compilation and route tests must stay green after fixture removal.

## Closure Facts

- `scripts/generate-rust-host-engine-catalog.ts` now materializes:
  - `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
- The generated artifact contains:
  - `engines`
  - `models`
- Both sections derive from promoted `coding-server` truth, not a separate Rust-only source.
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now:
  - loads the generated artifact via `include_str!("../generated/engine-catalog.json")`
  - caches it behind `OnceLock`
  - serves engine/model route truth from the parsed shared artifact
- The old Rust-side helper fixtures for:
  - capability defaults
  - transport kind lists
  - supported host modes
  are removed from the engine catalog assembly path.
- `scripts/rust-host-engine-truth-contract.test.ts` now proves:
  - generated artifact exists
  - artifact equals promoted `coding-server` engine/model truth
  - Rust source references the generated artifact
  - local manual fixture helpers are not retained
- `check:release-flow` now executes the new contract.

## Verification

- `pnpm.cmd run generate:rust-host-engine-catalog`
- `pnpm.cmd run test:rust-host-engine-truth-contract`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This slice closes source-of-truth adoption for Rust host engine/model metadata.
- The next non-environmental target is HTTP-level parity: proving actual Rust route envelopes equal the generated shared artifact end-to-end, not just source adoption plus spot checks.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
