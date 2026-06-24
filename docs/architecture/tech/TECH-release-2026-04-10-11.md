> Migrated from `docs/release/release-2026-04-10-11.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Adds a shared multi-engine runtime wrapper so Codex, Claude Code, Gemini, and OpenCode now expose one canonical BirdCoder runtime surface instead of only raw OpenAI-style chat streams.
- Standardizes runtime descriptor and canonical event projection in the shared workbench layer, including transport, approval policy, tool-call, artifact, and runtime-status normalization.
- Converts Step 18 from verification-only preparation into a partial runtime integration milestone with an executable adapter contract.

## Scope

- [package.json](/<workspace-root>/sdkwork-birdcoder/package.json)
- [types.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-chat/src/types.ts)
- [package.json](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-chat/package.json)
- [runtime.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts)
- [kernel.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts)
- [index.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-commons/src/index.ts)
- [engine-runtime-adapter-contract.test.ts](/<workspace-root>/sdkwork-birdcoder/scripts/engine-runtime-adapter-contract.test.ts)
- [21-多Code-Engine协议-SDK-适配标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/21-多Code-Engine协议-SDK-适配标准.md)
- [18-多Code-Engine-Adapter-统一工具协议闭环.md](/<workspace-root>/sdkwork-birdcoder/docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md)

## Verification

- `node --experimental-strip-types scripts/engine-runtime-adapter-contract.test.ts`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run test:engine-conformance`
- `pnpm.cmd run test:engine-runtime-adapter`
- `pnpm.cmd run test:tool-protocol-contract`
- `pnpm.cmd run test:engine-resume-recovery-contract`
- `pnpm.cmd run docs:build`

## Notes

- This iteration closes the shared engine runtime wrapper gap inside the workbench layer, but it does not yet finish the `coding-server` ingestion, persistence, and API fan-out closure required for full Step 18 completion.

