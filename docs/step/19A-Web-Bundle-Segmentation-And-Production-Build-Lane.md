# Step 19A - Web Bundle Segmentation And Production Build Lane

## Status

- Closed on `2026-04-11`.

## Goal

Close the real web bundle budget regression without weakening the cap by enforcing lightweight package entrypoints, production-correct Vite mode propagation, and auditable chunk boundaries.

## Scope

- `packages/sdkwork-birdcoder-ui/package.json`
- `packages/sdkwork-birdcoder-ui/src/index.ts`
- `packages/sdkwork-birdcoder-ui/src/chat.ts`
- `packages/sdkwork-birdcoder-ui/src/editors.ts`
- `packages/sdkwork-birdcoder-ui/src/run-config.ts`
- `packages/sdkwork-birdcoder-commons/package.json`
- `packages/sdkwork-birdcoder-commons/src/shell.ts`
- `packages/sdkwork-birdcoder-web/vite.config.ts`
- `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
- `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`
- `packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx`
- `packages/sdkwork-birdcoder-studio/src/pages/StudioPageDialogs.tsx`
- `src/App.tsx`
- `src/main.tsx`
- `package.json`
- `tsconfig.json`
- `scripts/ui-bundle-segmentation-contract.test.mjs`
- `scripts/web-react-compat-mode-contract.test.mjs`
- `scripts/commons-shell-entry-contract.test.mjs`
- `docs/reference/commands.md`
- `docs/guide/development.md`
- `docs/core/release-and-deployment.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md`
- `docs/架构/29-Web-Bundle-Segmentation-And-Production-Build-Standard.md`
- `docs/release/release-2026-04-11-26.md`

## Checkpoints

- `CP19A-1` `@sdkwork/birdcoder-ui` root barrel must stay lightweight.
- `CP19A-2` heavy UI surfaces must move to explicit subpath exports and consumers must adopt them.
- `CP19A-3` app-shell imports must move onto `@sdkwork/birdcoder-commons/shell`.
- `CP19A-4` web Vite production builds must pass the live `mode` into `createBirdcoderVitePlugins(...)`.
- `CP19A-5` chunk governance must keep React, markdown, editors, shell, and infrastructure split out of the entry chunk.
- `CP19A-6` root workspace subpath consumers must resolve through declared dependencies and TS-path aliases.
- `CP19A-7` the governed bundle cap must pass without raising the limit.

## Closure Facts

- `@sdkwork/birdcoder-ui` root export now exposes only lightweight shared UI surfaces; heavy runtime components moved to:
  - `@sdkwork/birdcoder-ui/chat`
  - `@sdkwork/birdcoder-ui/editors`
  - `@sdkwork/birdcoder-ui/run-config`
- Code and Studio consumers now import those heavy surfaces through subpath entries instead of the root UI barrel.
- `@sdkwork/birdcoder-commons/shell` is the new shell-safe entrypoint; root app bootstrap now avoids the broader commons barrel.
- `packages/sdkwork-birdcoder-web/vite.config.ts` now propagates the active `mode` into `createBirdcoderVitePlugins(...)`, removing production leakage of React dev-compat helpers.
- The bundle boundary is now explicit in manual chunks:
  - `vendor-react-core`
  - `vendor-react-dom`
  - `vendor-markdown`
  - `vendor-monaco`
  - `commons-shell`
  - `birdcoder-infrastructure`
  - `ui-chat`
  - `ui-editors`
  - `ui-run-config`
- Root workspace resolution now stays honest:
  - root `package.json` declares the workspace packages used by `src/*`
  - `tsconfig.json` maps `@sdkwork/birdcoder-commons/shell`
- New executable contracts freeze the closure:
  - `ui-bundle-segmentation-contract`
  - `web-react-compat-mode-contract`
  - `commons-shell-entry-contract`
- Verified bundle evidence:
  - entry `index-CKw7UVoM.js`: `68.1 KiB`
  - largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`
  - cap: `700.0 KiB`

## Verification

- `pnpm.cmd run typecheck`
- `pnpm.cmd run check:vite-config-esm`
- `pnpm.cmd run check:ui-bundle-segmentation`
- `pnpm.cmd run check:web-react-compat-mode`
- `pnpm.cmd run check:commons-shell-entry`
- `pnpm.cmd run build`
- `pnpm.cmd run check:governance-regression`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run docs:build`

## Notes

- This lane closes the real web performance blocker; it does not weaken the budget.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- The former next non-environmental target is already closed in `18G-Engine-Governance-Packaged-Release-Evidence-Lane.md`; active Architecture 29 docs must treat that packaged release-evidence handoff as a closed historical follow-on and move future loops to the next lowest-score non-environmental slice unless fresh failing evidence appears on the governed bundle boundary or finalized `qualityEvidence` handoff itself.
