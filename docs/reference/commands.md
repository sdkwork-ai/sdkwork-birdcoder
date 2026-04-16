# Commands

## Development

```bash
pnpm dev
pnpm tauri:dev
pnpm server:dev
```

`pnpm dev` starts the shared BirdCoder web workbench development loop so workspace UI, shared packages, and browser-hosted integration changes can be exercised together during local iteration.
`pnpm tauri:dev` starts the governed desktop development loop so the Tauri shell, desktop host bindings, and packaged-app interaction paths can be exercised together during local iteration.
`pnpm server:dev` starts the governed server-hosted development loop so backend runtime wiring, server APIs, and server-facing integration paths can be exercised together during local iteration.

## Build

```bash
pnpm build
pnpm docs:build
```

`pnpm build` executes the shared workspace production build so app packages, shared libraries, and release-facing bundle outputs can be validated together before broader delivery verification begins.
`pnpm docs:build` executes the documentation site production build so architecture, Step, prompt, and operator-reference changes are validated as publishable VitePress output before release-facing docs updates are treated as stable.

## Verification

```bash
pnpm lint
pnpm check:package-governance
pnpm check:desktop
pnpm check:server
pnpm check:release-flow
pnpm check:ci-flow
pnpm check:ui-bundle-segmentation
pnpm check:web-react-compat-mode
pnpm check:commons-shell-entry
pnpm check:multi-mode
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

`pnpm lint` executes the repository lint baseline so formatting, static style expectations, and lint-governed source hygiene regressions are caught before broader quality or release verification begins.
`pnpm check:package-governance` freezes workspace package naming, package ownership, and root-managed dependency version rules.
`pnpm check:desktop` verifies the desktop application contract, packaging assumptions, and desktop-facing host/runtime integrations before desktop delivery changes are treated as stable.
`pnpm check:server` verifies the server delivery contract, runtime bootstrap assumptions, and server-facing packaging expectations before backend-hosted release changes are treated as stable.
`pnpm check:release-flow` verifies release planning, asset packaging, smoke routing, finalization, and release-note rendering contracts before release automation changes are treated as stable.
`pnpm check:ci-flow` verifies reusable workflow wiring, quality-tier handoff order, and release-facing CI bindings before automation changes are treated as stable.
`pnpm check:ui-bundle-segmentation` freezes the lightweight-versus-heavy export boundary for `@sdkwork/birdcoder-ui` so chat, editor, and run-config runtime weight cannot leak back into the root UI barrel.
`pnpm check:web-react-compat-mode` freezes production-mode propagation into the shared Vite plugin factory so production bundles cannot silently emit React dev-compat runtime helpers.
`pnpm check:commons-shell-entry` freezes the `@sdkwork/birdcoder-commons/shell` app-shell boundary so the root app bootstrap cannot re-import the broader commons barrel.
`pnpm check:multi-mode` verifies the shared desktop, server, container, kubernetes, and web release surface together so cross-family packaging changes do not drift apart.
`pnpm check:governance-regression` regenerates the machine-readable governance report and proves that the current repository contract set still closes cleanly as one release-facing baseline, including the full official-SDK-first engine governance set for official SDK presence, runtime selection, canonical runtime and kernel projection, provider SDK governance, browser safety, bridge error propagation, provider bridge contracts, engine conformance, tool protocol, and resume or recovery closure. The web performance slice is now self-built through `pnpm build`, so missing `dist` artifacts no longer hide the real web bundle budget outcome. If the governed Vite or esbuild path hits `[vite:define] spawn EPERM` on the current host, the report now preserves `blockedCheckIds`, `blockingDiagnosticIds`, and `environmentDiagnostics` such as `vite-host-build-preflight` instead of misreporting that condition as a failed repository regression.
`pnpm check:quality-matrix` verifies the declared `fast -> standard -> release` quality tiers before reports or release evidence are generated, and it now fails when an existing workspace `artifacts/quality/quality-gate-matrix-report.json` no longer matches the current generated tier, workflow, or root manifest truth.
`pnpm check:quality:fast` executes the fastest executable quality tier and is the first operator checkpoint for whether repo-local safeguards are still green before broader release verification begins. Its desktop startup-graph lane now selects a free loopback port and freezes that collision case through `check:desktop-startup-graph`, so an unrelated listener on the legacy `127.0.0.1:1537` port no longer fabricates a fast-tier failure.
`pnpm check:quality:standard` executes the middle quality tier and proves that the repository can advance beyond fast local guards into the broader standard verification set before release-tier validation.
`pnpm check:quality:release` executes the full release-tier quality gate and is the operator-facing proof point for whether the current host can clear the repository's highest local quality bar.
`pnpm quality:report` writes `artifacts/quality/quality-gate-matrix-report.json`, including workflow-bound and manifest-bound quality tiers, per-tier root `package.json` binding status, release-tier `governanceCheckIds` for the full official-SDK-first engine governance set, plus live `environmentDiagnostics`, `requiredCapabilities`, and `rerunCommands` for host `toolchain-platform` blockers; rerun it whenever `pnpm check:quality-matrix` reports stale workspace evidence. That freshness contract compares stable tier/workflow/manifest truth and does not treat host-only `environmentDiagnostics` drift as stale evidence by itself.
`pnpm quality:execution-report` writes `artifacts/quality/quality-gate-execution-report.json` from a real `fast -> standard -> release` cascade and preserves upstream blocker state for downstream skipped tiers after the same port-resilient desktop startup-graph verification has run.
If the host reaches an affected Vite-backed quality gate and the build preflight hits `[vite:define] spawn EPERM`, the execution report now records `vite-host-build-preflight` and marks the blocked tier directly instead of collapsing that condition into a generic failed gate.
On `2026-04-15`, direct outer-shell reruns confirmed the current split truth on this host: `pnpm.cmd run build` passes, but direct `pnpm.cmd check:quality:fast` fails at `check:web-vite-build` with `[vite:define] spawn EPERM`, and direct `pnpm.cmd check:quality:release` fails for the same reason because `fast` stops first. Treat a blocked `pnpm quality:execution-report` as governed Vite-path evidence, not as proof that every direct build surface is broken.
`pnpm release:finalize` also writes `quality/quality-gate-matrix-report.json` into the active release asset directory and, when the workspace execution report already exists, archives `quality/quality-gate-execution-report.json` and freezes both summaries into `release-manifest.json.qualityEvidence`; that finalized summary now also preserves manifest-bound tier counts beside workflow-bound counts, so rendered release notes and packaged stop-ship checks cannot give a false architecture-perfect score when root `check:quality:*` bindings drift. It also preserves the release-tier official-SDK-first engine governance set as `releaseGovernanceCheckIds`.
For `formal` or any `general-availability` rollout-stage finalize, that same packaged stop-ship evidence becomes a hard gate: workflow or manifest topology drift, packaged quality blockers, runtime blocked or failed tiers, runtime blocking diagnostics, or governance blocked records now abort finalization instead of allowing GA-tagged metadata to land beside blocked evidence.
When `scripts/release/render-release-notes.mjs` renders `release-notes.md` directly into the release asset directory and `SHA256SUMS.txt` is already present, it now refreshes the checksum inventory so the rendered notes digest stays aligned with the finalized release asset set.
Those rendered notes now also carry runtime blocked tiers, runtime failed tiers, and runtime blocking diagnostics into `Stop-ship signals`, so packaged runtime execution evidence and operator release decisions stay aligned.
`pnpm check:live-docs-governance-baseline` freezes live architecture, Step, and core release docs against the current governance-regression check count so active docs do not drift behind the machine-readable baseline.
`pnpm check:appbase-parity` freezes `sdkwork-birdcoder-appbase` against the upstream `sdkwork-appbase` auth, user, and vip bridge standard.

## Release

```bash
pnpm release:plan
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:rollback:plan
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch
pnpm release:smoke:desktop-startup
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
```

`pnpm release:plan` materializes the release-control baseline for the current delivery batch, freezing release kind, rollout stage, monitoring window, rollback metadata, and downstream packaging expectations before assets are assembled.
`pnpm release:package:desktop` assembles the governed desktop release asset set, freezing installer payloads, distribution metadata, and desktop-target packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:server` assembles the governed server release asset set, freezing runtime bundle contents, server launch metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:container` assembles the governed container release asset set, freezing image payload references, container runtime metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:kubernetes` assembles the governed kubernetes release asset set, freezing manifest payload references, rollout metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:web` assembles the governed web release asset set, freezing browser bundle payloads, hosting metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:rollback:plan` materializes a rollback-ready release-control payload for an existing tag, freezing rollback command routing, release asset provenance, and runbook linkage before fallback publication or rollback drills are executed.
`pnpm release:smoke:desktop` executes the governed desktop smoke route against the packaged desktop release asset set, freezing install-and-launch evidence before release finalization or publication moves forward.
`pnpm release:smoke:server` executes the governed server smoke route against the packaged server release asset set, freezing boot-and-health evidence before release finalization or publication moves forward.
`pnpm release:smoke:container` executes the governed container smoke route against the packaged container release asset set, freezing image-startup and deployment-readiness evidence before release finalization or publication moves forward.
`pnpm release:smoke:kubernetes` executes the governed kubernetes smoke route against the packaged kubernetes release asset set, freezing rollout-health and manifest-application evidence before release finalization or publication moves forward.
`pnpm release:smoke:web` executes the governed web smoke route against the packaged web release asset set, freezing browser-boot and hosting-readiness evidence before release finalization or publication moves forward.
`pnpm release:smoke:desktop-packaged-launch` executes the governed packaged desktop launch route against the packaged desktop release asset set, freezing post-package boot evidence before release finalization or publication moves forward.
`pnpm release:smoke:desktop-startup` executes the governed desktop startup route against the packaged desktop release asset set, freezing first-start lifecycle evidence before release finalization or publication moves forward.
`pnpm release:finalize` finalizes the governed release asset set, freezing release-control metadata, checksum inventory, quality evidence archives, and publication-ready `release-manifest.json` output before finalized smoke or downstream distribution moves forward. When the requested promotion is `formal` or `general-availability`, finalize now fails fast if packaged stop-ship evidence is still present.
`pnpm release:smoke:finalized` executes the governed finalized-release smoke route against the already finalized release asset set, freezing post-finalize replay evidence before publication signoff or downstream distribution moves forward. It also rejects any formal or GA-tagged finalized manifest whose packaged stop-ship evidence is still non-empty, and when `SHA256SUMS.txt` is already present it refreshes that checksum inventory so the new finalized-smoke report cannot silently stale the release asset set.
The emitted `finalized-release-smoke-report.json` now also carries `stopShipSignals` and `promotionReadiness`, so machine consumers can distinguish “evidence summaries still match packaged artifacts” from “formal/GA promotion is actually clear” without re-implementing release-governance logic from raw `qualityEvidence`.

## Release Control Examples

```bash
pnpm release:plan -- --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md
pnpm release:rollback:plan -- --release-tag release-2026-04-09-105 --release-assets-dir artifacts/release --rollback-command "gh workflow run rollback.yml --ref main"
pnpm release:finalize -- --release-assets-dir artifacts/release --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md --repository Sdkwork-Cloud/sdkwork-birdcoder
```

`releaseKind` allows `formal`, `canary`, `hotfix`, and `rollback`. `rollbackCommand` remains optional, but `rollbackRunbookRef` must always exist.
Rendered release notes must always show a rollback entry and writeback targets. If `rollbackCommand` is omitted, the fallback entry becomes `pnpm release:rollback:plan -- --release-tag <tag> --release-assets-dir <dir>`.
