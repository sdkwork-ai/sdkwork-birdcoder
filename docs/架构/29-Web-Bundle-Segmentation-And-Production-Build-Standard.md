# Web Bundle Segmentation And Production Build Standard

## Objective

Keep the web delivery bundle under the governed `700.0 KiB` largest-JS cap without weakening the cap, while preserving a production-correct React runtime and stable package-entry boundaries.

## Standard

- `@sdkwork/birdcoder-ui` root entry may export only lightweight shared UI surfaces.
- Heavy UI surfaces must stay on explicit subpath exports:
  - `@sdkwork/birdcoder-ui/chat`
  - `@sdkwork/birdcoder-ui/editors`
  - `@sdkwork/birdcoder-ui/run-config`
- App-shell bootstrap imports must use `@sdkwork/birdcoder-commons/shell`, not the broad commons root barrel.
- `packages/sdkwork-birdcoder-web/vite.config.ts` must pass the live Vite `mode` into `createBirdcoderVitePlugins(...)`; production builds must never emit React dev-compat runtime helpers.
- Manual chunking must keep these boundaries explicit:
  - `vendor-react-core`
  - `vendor-react-dom`
  - `vendor-markdown`
  - `vendor-monaco`
  - `commons-shell`
  - `birdcoder-infrastructure`
  - `ui-chat`
  - `ui-editors`
  - `ui-run-config`
- Root-app consumers of workspace subpath exports must satisfy both conditions:
  - the root `package.json` declares the consumed workspace package
  - `tsconfig.json` maps the consumed subpath during source-mode builds
- Budget closure must be enforced by executable contracts, not by manual inspection.

## Prohibited

- Re-exporting `UniversalChat`, Monaco editors, or run-configuration dialogs from the UI root barrel.
- Importing app-shell bootstrap code from `@sdkwork/birdcoder-commons` root when only shell-safe surfaces are needed.
- Building production bundles with missing `mode` propagation into the shared Vite plugin factory.
- Raising the `700.0 KiB` cap to hide regression instead of reducing bundle pressure.
- Adding workspace subpath imports without matching package-export and TS-path resolution.

## Why

- Shared barrels are part of runtime architecture, not only TypeScript convenience.
- Production-mode drift can silently inject React dev helpers and distort bundle evidence.
- Commercial release evidence is only credible when the same bundle boundary is enforced in build, governance, and release-flow checks.

## Governance

- Required verification:
  - `pnpm.cmd run check:vite-config-esm`
  - `pnpm.cmd run check:ui-bundle-segmentation`
  - `pnpm.cmd run check:web-react-compat-mode`
  - `pnpm.cmd run check:commons-shell-entry`
  - `pnpm.cmd run build`
  - `pnpm.cmd run check:governance-regression`
  - `pnpm.cmd run check:release-flow`

## Evaluation Criteria

- `barrel_boundary_truth`
  - pass: lightweight and heavy UI entrypoints stay separated
  - fail: root barrels re-export heavy runtime surfaces
- `production_runtime_truth`
  - pass: production build uses production React compat mode
  - fail: build leaks dev-runtime helpers or misclassifies the mode
- `chunk_governance_truth`
  - pass: React, markdown, editor, shell, and infrastructure slices remain independently chunked
  - fail: entry chunk or shared shell chunk re-absorbs heavy runtime modules
- `workspace_resolution_truth`
  - pass: subpath exports resolve through package exports and TS paths together
  - fail: build relies on undeclared workspace deps or missing alias truth
- `bundle_budget_truth`
  - pass: largest built JS asset stays `<= 700.0 KiB`
  - fail: any release-facing build exceeds the governed cap

## Achieved Evidence

- entry `index-CKw7UVoM.js`: `68.1 KiB`
- largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`
- representative shared chunks:
  - `vendor-react-core-BGYW52aF.js`: `39.06 kB`
  - `commons-shell-_6yVfdjk.js`: `95.35 kB`
  - `birdcoder-infrastructure-nBkYWCZo.js`: `188.24 kB`
  - `ui-chat-CzEvyfFo.js`: `433.29 kB`
  - `vendor-react-dom-BIp0uJ_V.js`: `563.03 kB`

## Next Standard Target

The Step 18 packaged release-evidence promotion is already a closed historical follow-on; future loops must select the next lowest-score non-environmental slice instead of reopening bundle-boundary work unless fresh failing evidence appears on the governed bundle boundary or finalized `qualityEvidence` handoff itself.
