# Web Bundle Segmentation And Production Build Standard

## Objective

Keep the web delivery bundle under the governed `700.0 KiB` largest-JS cap without weakening the cap, while preserving a production-correct React runtime and stable package-entry boundaries.

## Standard

- `@sdkwork/birdcoder-ui-shell` must own shell-safe UI primitives and expose them through a curated root entry only.
- `@sdkwork/birdcoder-ui` must expose only heavy workbench surfaces through a curated root entry with explicit named exports.
- Dependency consumers must import both `@sdkwork/birdcoder-ui-shell` and `@sdkwork/birdcoder-ui` from their root entries only; package subpath exports are prohibited.
- App-shell bootstrap imports must use `@sdkwork/birdcoder-commons/shell`, not the broad commons root barrel.
- `packages/sdkwork-birdcoder-web/vite.config.ts` must pass the live Vite `mode` into `createBirdcoderVitePlugins(...)`; production builds must never emit React dev-compat runtime helpers.
- Manual chunking must keep these boundaries explicit:
  - `vendor-react-core`
  - `vendor-react-dom`
  - `vendor-markdown`
  - `vendor-monaco`
  - `ui-shell`
  - `ui-workbench`
  - `birdcoder-platform-runtime`
  - `birdcoder-platform-services`
  - `birdcoder-codeengine`
  - `birdcoder-commons-root`
  - `birdcoder-infrastructure-root`
- Budget closure must be enforced by executable contracts, not by manual inspection.

## Prohibited

- Re-exporting heavy UI runtime surfaces through wildcard root barrels that force eager facade linkage.
- Importing app-shell bootstrap code from `@sdkwork/birdcoder-commons` root when only shell-safe surfaces are needed.
- Building production bundles with missing `mode` propagation into the shared Vite plugin factory.
- Raising the `700.0 KiB` cap to hide regression instead of reducing bundle pressure.
- Adding dependency package subpath imports instead of curated root imports.

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
  - pass: `@sdkwork/birdcoder-ui-shell` and `@sdkwork/birdcoder-ui` stay separated by responsibility
  - fail: lightweight root entries re-export heavy runtime surfaces or heavy roots absorb shell primitives
- `production_runtime_truth`
  - pass: production build uses production React compat mode
  - fail: build leaks dev-runtime helpers or misclassifies the mode
- `chunk_governance_truth`
  - pass: React, markdown, editor, shell, and infrastructure slices remain independently chunked
  - fail: entry chunk or shared shell chunk re-absorbs heavy runtime modules
- `workspace_resolution_truth`
  - pass: dependency consumers stay on curated root-entry imports
  - fail: build relies on package subpath imports or hidden alias-only entrypoints
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
