# Development

BirdCoder development keeps the same package-first workflow used by the aligned Claw Studio architecture.

## Core commands

```bash
pnpm dev
pnpm tauri:dev
pnpm server:dev
pnpm lint
pnpm build
pnpm docs:build
pnpm check:multi-mode
```

Use `pnpm dev` for the shared web workbench loop, `pnpm tauri:dev` for the desktop-hosted Tauri loop, and `pnpm server:dev` for the server-hosted runtime loop. Switch between them based on the delivery surface you are validating.

`pnpm lint` is the fastest source-hygiene checkpoint for style and static consistency, `pnpm build` freezes the shared production bundle outputs, `pnpm docs:build` freezes the VitePress documentation output, and `pnpm check:multi-mode` verifies that desktop, server, container, kubernetes, and web delivery surfaces still move together before you escalate into the broader release-oriented verification stack.

## Release-oriented verification

```bash
pnpm check:package-governance
pnpm check:desktop
pnpm check:server
pnpm check:release-flow
pnpm check:ci-flow
pnpm check:ui-bundle-segmentation
pnpm check:web-react-compat-mode
pnpm check:commons-shell-entry
pnpm check:governance-regression
pnpm check:live-docs-governance-baseline
pnpm check:quality-matrix
pnpm check:quality:fast
pnpm check:quality:standard
pnpm check:quality:release
pnpm quality:report
pnpm quality:execution-report
pnpm check:appbase-parity
```

Use targeted package commands during implementation, then run the broader workspace gates before finalizing release-facing changes. `pnpm check:package-governance` freezes workspace package naming, ownership, and root-managed dependency rules before you widen the verification scope. `pnpm check:desktop` is the targeted verification path for desktop packaging assumptions, host bindings, and desktop-facing runtime integrations when you are validating the desktop surface in isolation. `pnpm check:server` is the targeted verification path for server bootstrap, runtime wiring, and server-facing packaging expectations when you are validating the server surface in isolation. `pnpm check:release-flow` freezes release planning, packaging, smoke routing, and finalization contracts before release automation changes are treated as stable. `pnpm check:ci-flow` freezes the reusable workflow and quality-tier handoff topology before CI-facing changes are treated as stable. `pnpm check:ui-bundle-segmentation`, `pnpm check:web-react-compat-mode`, and `pnpm check:commons-shell-entry` are the narrowest bundle-boundary guards for UI barrel scope, production React compat mode, and commons shell bootstrap scope before you rerun heavier workspace gates. `pnpm check:governance-regression` regenerates the machine-readable governance baseline, including the Step 18 engine runtime adapter, conformance, tool protocol, and resume or recovery quartet, and now forces the web budget slice through a fresh `pnpm build` so missing build artifacts cannot hide a real bundle regression; `pnpm check:live-docs-governance-baseline` proves that the active docs still match that live baseline, and `pnpm check:quality-matrix` freezes the declared `fast -> standard -> release` tier model before quality evidence is consumed downstream while also rejecting a stale workspace `artifacts/quality/quality-gate-matrix-report.json` when that file no longer matches current tier or workflow truth. `pnpm check:appbase-parity` freezes the unified auth, user, and vip bridge against `sdkwork-birdcoder-appbase` before release-facing changes are treated as stable. `pnpm check:quality:fast` is the first executable release-readiness gate, and its desktop startup-graph lane now selects a free loopback port so another local listener on the legacy `127.0.0.1:1537` port does not fabricate a fast-tier failure. `pnpm check:quality:standard` expands that check set into the broader standard lane, and `pnpm check:quality:release` is the highest local quality gate before release-facing changes are treated as ready. `pnpm quality:report` records the current quality matrix, the release-tier engine-governance `governanceCheckIds`, and blocker diagnostics, while `pnpm quality:execution-report` preserves the real gate cascade and any downstream skipped tiers after that same port-resilient fast-tier verification; rerun `pnpm quality:report` when `pnpm check:quality-matrix` flags stale workspace evidence. If `pnpm check:quality:release` stops at a host-level blocker, record that blocker through the quality reports and continue with unblocked repo work instead of rewriting unrelated code.
