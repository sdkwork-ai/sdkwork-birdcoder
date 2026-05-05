# Commands

## Development

```bash
pnpm dev
pnpm dev:local
pnpm dev:private
pnpm dev:external
pnpm dev:cloud
pnpm identity:show -- desktop-dev --identity-mode desktop-local
pnpm identity:show -- server-dev --identity-mode server-private --user-center-provider external-user-center
pnpm tauri:dev
pnpm tauri:dev:private
pnpm tauri:dev:external
pnpm tauri:dev:cloud
pnpm desktop:dev:local
pnpm desktop:dev:private
pnpm desktop:dev:external
pnpm desktop:dev:cloud
pnpm stack:desktop:local
pnpm stack:desktop:private
pnpm stack:desktop:external
pnpm stack:desktop:cloud
pnpm web:dev:private
pnpm web:dev:external
pnpm web:dev:cloud
pnpm stack:web:private
pnpm stack:web:external
pnpm stack:web:cloud
pnpm server:dev
pnpm server:dev:private
pnpm server:dev:external
pnpm server:dev:cloud
```

`pnpm dev` starts the default private BirdCoder web sample stack. It launches the native BirdCoder server first, waits until both `/api/core/v1/health` and `/api/app/v1/auth/config` succeed, then boots the browser host while defaulting `VITE_BIRDCODER_API_BASE_URL` to `http://127.0.0.1:10240` for local iteration when no explicit value is configured.
`pnpm dev:local` starts the canonical single-machine BirdCoder sample loop by delegating to the desktop-local Tauri host with the embedded coding server and local sqlite user center.
`pnpm dev:private` is the explicit alias for that same managed private web sample stack.
`pnpm dev:external` is the explicit browser-hosted alias for the private-server lane when the BirdCoder server binds `external-user-center`.
`pnpm dev:cloud` starts the shared BirdCoder web workbench against a cloud-backed BirdCoder server.
`pnpm identity:show -- <target> --identity-mode <mode>` prints the resolved managed identity env after `.env` loading and mode normalization, with secret-like fields masked so mode switching can be inspected safely.
`pnpm identity:show -- <target> --identity-mode server-private --user-center-provider external-user-center` prints that same resolved env for the standardized external-provider lane without requiring ad hoc shell env overrides.
`pnpm tauri:dev` starts the governed desktop-local development loop so the Tauri shell, embedded coding server, local sqlite user center, and packaged-app interaction paths can be exercised together during local iteration.
`pnpm tauri:dev:private` starts the governed desktop shell against a separately running private BirdCoder server, defaulting the client API base URL to `http://127.0.0.1:10240` when no explicit override is configured.
`pnpm tauri:dev:external` starts the governed desktop shell against a private BirdCoder server that keeps the same facade but uses the `external-user-center` provider.
`pnpm tauri:dev:cloud` starts the governed desktop shell against a separately running BirdCoder server that is expected to delegate identity to `sdkwork-cloud-app-api`.
`pnpm desktop:dev:local`, `pnpm desktop:dev:private`, `pnpm desktop:dev:external`, and `pnpm desktop:dev:cloud` expose the same desktop matrix with explicit mode naming for operator documentation and sample-app onboarding.
`pnpm web:dev:private`, `pnpm web:dev:external`, and `pnpm web:dev:cloud` expose the browser-hosted mode matrix with naming that matches the desktop and server families when you intentionally manage the corresponding server process yourself.
`pnpm stack:desktop:local` keeps the BirdCoder reference sample on a one-command local desktop loop with the embedded server and builtin local user center.
`pnpm stack:desktop:private`, `pnpm stack:desktop:external`, and `pnpm stack:desktop:cloud` start the native BirdCoder server first when needed, wait until both `/api/core/v1/health` and `/api/app/v1/auth/config` succeed, and then launch the desktop client against the same resolved identity env.
`pnpm stack:web:private`, `pnpm stack:web:external`, and `pnpm stack:web:cloud` do the same for the browser-hosted sample so private, external-provider, and cloud-backed lanes can be demonstrated without manually coordinating two terminals, while still proving the canonical auth contract is live before the host boots. `pnpm dev` is now the default alias for `pnpm stack:web:private`.
`pnpm server:dev` starts the governed private BirdCoder server loop with the builtin local user center and local sqlite persistence.
`pnpm server:dev:private` is the explicit private-server alias for the same governed native-server loop.
`pnpm server:dev:external` starts the governed native-server loop on the same `server-private` deployment lane but binds the identity provider to `external-user-center`.
`pnpm server:dev:cloud` starts the governed BirdCoder server loop in cloud identity mode and requires `BIRDCODER_USER_CENTER_APP_API_BASE_URL`.
All of these development commands keep the frontend contract on the same BirdCoder facade routes, including `/api/app/v1/auth/*`, `/api/app/v1/user/profile`, and `/api/app/v1/vip/info`, even when the server switches between builtin-local, `sdkwork-cloud-app-api`, or `external-user-center` providers. The wrappers mirror `BIRDCODER_USER_CENTER_LOGIN_PROVIDER` to `VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER`, and the web/desktop hosts now pass that provider kind into the shared runtime bootstrap directly. `VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE` remains the fallback inference source for the three standardized deployment modes, and once `/api/app/v1/auth/config` is loaded BirdCoder synchronizes the server-reported `providerKind` and `providerKey` back into the runtime binding.

## Build

```bash
pnpm build
pnpm build:private
pnpm build:external
pnpm build:cloud
pnpm tauri:build
pnpm tauri:build:private
pnpm tauri:build:external
pnpm tauri:build:cloud
pnpm server:build
pnpm server:build:external
pnpm server:build:cloud
pnpm package:desktop:local
pnpm package:desktop:private
pnpm package:desktop:external
pnpm package:desktop:cloud
pnpm package:web:private
pnpm package:web:external
pnpm package:web:cloud
pnpm package:server:private
pnpm package:server:external
pnpm package:server:cloud
pnpm docs:build
```

`pnpm build` executes the shared browser-hosted production build for private BirdCoder server integration, while preserving explicit `VITE_BIRDCODER_API_BASE_URL` when it is configured.
`pnpm build:private` is the explicit private-server alias for that same browser-hosted build flow.
`pnpm build:external` executes the shared browser-hosted production build for the private-server deployment lane with `external-user-center` binding.
`pnpm build:cloud` executes the shared browser-hosted production build for cloud-backed BirdCoder server integration.
`pnpm tauri:build` packages the desktop shell for the embedded local deployment mode.
`pnpm tauri:build:private` packages the desktop shell so it targets an external private BirdCoder server, and it requires `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL`.
`pnpm tauri:build:external` packages the desktop shell for a private BirdCoder server that delegates identity through the external-provider bridge and also requires `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL`.
`pnpm tauri:build:cloud` packages the desktop shell so it targets a cloud-backed BirdCoder server, and it requires `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL`.
`pnpm server:build` packages the BirdCoder server for private local-user-center deployment.
`pnpm server:build:external` packages the BirdCoder server for private deployment with `external-user-center` authority.
`pnpm server:build:cloud` packages the BirdCoder server for cloud `sdkwork-cloud-app-api` identity deployment.
`pnpm package:desktop:local`, `pnpm package:desktop:private`, `pnpm package:desktop:external`, and `pnpm package:desktop:cloud` are thin packaging aliases over the standardized desktop build matrix.
`pnpm package:web:private`, `pnpm package:web:external`, and `pnpm package:web:cloud` are thin packaging aliases over the standardized browser build matrix.
`pnpm package:server:private`, `pnpm package:server:external`, and `pnpm package:server:cloud` are thin packaging aliases over the standardized native-server build matrix.
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
pnpm check:identity:sample
pnpm check:governance-regression
pnpm check:live-docs-governance-baseline
pnpm check:quality-matrix
pnpm check:quality:fast
pnpm check:quality:standard
pnpm check:quality:release
pnpm quality:report
pnpm quality:execution-report
pnpm check:identity-standard
pnpm test:user-center-standard
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
`pnpm check:identity:sample` is the BirdCoder sample-app identity verification shortcut. It runs the standardized desktop, web, and server identity inspectors for local, private, external-provider, and cloud lanes, then builds the web and server artifacts for private, external, and cloud deployment. If `BIRDCODER_USER_CENTER_APP_API_BASE_URL` is not already configured, it injects `https://app-api.example.com` as the cloud placeholder so the cloud sample path remains deterministic during local governance runs.
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
`pnpm release:finalize` also writes `release-manifest.json.releaseCoverage` and a checksum-backed `release-manifest.json.artifacts` publication view. `releaseCoverage` records the required profile targets, present targets, missing targets, and partial-finalization state; each `artifacts[]` entry records a safe relative path, `sha256`, and `size` that must match `SHA256SUMS.txt`. Desktop installer artifacts preserve explicit `kind`, `bundle`, `installerFormat`, `target`, and `signatureEvidence` metadata so coverage, smoke, and promotion gates do not rely on path, extension, or trust inference.
`pnpm release:finalize` also writes `release-manifest.json.sha256.txt`, a single-file checksum sidecar for the finalized manifest itself, and removes any stale `release-attestations.json` so old attestation evidence cannot survive a new finalization.
`pnpm release:preflight:desktop-signing` verifies the desktop release runner environment before bundle creation. It checks target-specific signing and package metadata tools plus required credential environment names for Windows, macOS, or Linux without signing artifacts or printing secret values.
`pnpm release:verify-trust:desktop` verifies real platform desktop installer trust between packaging and smoke. It rewrites desktop installer `signatureEvidence` from `pending` to `passed` only after all installers pass, then writes `desktop-installer-trust-report.json` so finalization and finalized smoke can replay the exact verifier evidence.
`pnpm release:assert-ready` is the final publish gate for an already finalized asset directory. It rejects partial `releaseCoverage`, manifests generated with partial-release intent, missing targets, unsafe artifact paths, missing files, checksum drift, `SHA256SUMS.txt` entries that are not present in the finalized manifest `artifacts` publication view, and formal/GA manifests whose desktop installer trust evidence is missing, pending, failed, or incomplete.
`pnpm release:candidate:dry-run` is the standard offline release-candidate rehearsal. It generates a complete synthetic finalized release asset directory under `artifacts/release-candidate-dry-run`, runs the same readiness assertion used by publication, and writes `release-candidate-dry-run-report.json` with schema `birdcoder.releaseCandidateDryRun.v2`. The report includes artifact counts, required target counts, readiness evidence, stop-ship signals, the recommended real release command sequence, and a structured `rehearsalPlan` with schema `birdcoder.releaseRehearsalPlan.v1` so operators and CI consumers can inspect phase order, expected evidence paths, external signing/trust/attestation gates, and stop-ship rules without parsing prose or logs.
`pnpm release:rehearsal:verify` is the standard real-asset rehearsal evidence gate. It reads the v2 dry-run report, verifies the real `artifacts/release` directory has every concrete evidence path required by `rehearsalPlan`, and writes `artifacts/release-rehearsal/release-rehearsal-execution-report.json` with schema `birdcoder.releaseRehearsalExecution.v1`. Missing evidence is reported as `blocked` with the affected phase ids, while dry-run schema or command-plan drift is reported as `failed`; the command does not execute signing, publishing, or any other release-producing command.
The CI workflow runs the same command and uploads the generated directory as `release-candidate-dry-run-evidence`, making the dry-run report available as a stable audit artifact for each governed verification run.
For `formal` or any `general-availability` rollout-stage finalize, that same packaged stop-ship evidence becomes a hard gate: workflow or manifest topology drift, packaged quality blockers, runtime blocked or failed tiers, runtime blocking diagnostics, incomplete desktop installer trust evidence, or governance blocked records now abort finalization instead of allowing GA-tagged metadata to land beside blocked evidence.
When `scripts/release/render-release-notes.mjs` renders `release-notes.md` directly into the release asset directory and `SHA256SUMS.txt` is already present, it now refreshes the checksum inventory from `release-manifest.json.artifacts` when a finalized manifest is present. Rendered notes stay publishable beside the assets without being silently added to the publishable artifact checksum view.
Those rendered notes now also carry runtime blocked tiers, runtime failed tiers, and runtime blocking diagnostics into `Stop-ship signals`, so packaged runtime execution evidence and operator release decisions stay aligned.
`pnpm check:live-docs-governance-baseline` freezes live architecture, Step, and core release docs against the current governance-regression check count so active docs do not drift behind the machine-readable baseline.
`pnpm check:identity-standard` freezes `sdkwork-birdcoder-auth` and `sdkwork-birdcoder-user` against the upstream `sdkwork-appbase` auth, user-center, validation, and vip bridge standard.
`pnpm test:user-center-standard` freezes the canonical unified user-center lane so appbase parity, the independent validation plugin boundary, and the Rust-side validation handoff continue to move together behind one root-owned command.

## Release

```bash
pnpm release:plan
pnpm release:candidate:dry-run
pnpm release:preflight:desktop-signing
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:rollback:plan
pnpm release:verify-trust:desktop
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch
pnpm release:smoke:desktop-startup
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
pnpm release:write-attestation-evidence
pnpm release:assert-ready
pnpm release:rehearsal:verify
```

`pnpm release:plan` materializes the release-control baseline for the current delivery batch, freezing release kind, rollout stage, monitoring window, rollback metadata, and downstream packaging expectations before assets are assembled.
`pnpm release:preflight:desktop-signing` executes the governed desktop signing environment preflight for the selected platform, architecture, target, and bundle list before the desktop bundle phase. It proves that Windows Authenticode, macOS codesign/notarization, or Linux package metadata tooling is available on the runner and that the required credential variables are present, but it does not replace post-package installer trust verification.
`pnpm release:package:desktop` assembles the governed desktop release asset set, freezing installer payloads under `desktop/<platform>/<arch>/installers/<bundle>/...`, distribution metadata, and desktop-target packaging evidence before smoke and finalize steps consume the release batch. It rejects desktop targets that are not declared by the active release profile and fails before writing archives or manifests when any required Tauri installer bundle for that profile target is missing. The desktop family manifest writes each installer with `kind: installer`, `bundle`, `installerFormat`, `target`, and pending `signatureEvidence`; `pnpm release:smoke:desktop` rejects installer entries that omit those fields.
`pnpm release:package:server` assembles the governed server release asset set, freezing runtime bundle contents, server launch metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:container` assembles the governed container release asset set, freezing image payload references, container runtime metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:kubernetes` assembles the governed kubernetes release asset set, freezing manifest payload references, rollout metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:package:web` assembles the governed web release asset set, freezing browser bundle payloads, hosting metadata, and deployment-facing packaging evidence before smoke and finalize steps consume the release batch.
`pnpm release:rollback:plan` materializes a rollback-ready release-control payload for an existing tag, freezing rollback command routing, release asset provenance, and runbook linkage before fallback publication or rollback drills are executed.
`pnpm release:verify-trust:desktop` executes the governed desktop installer trust verifier against the packaged desktop release asset set, freezing platform trust evidence in both the desktop family manifest and `desktop-installer-trust-report.json` before smoke, finalize, or publication moves forward.
`pnpm release:smoke:desktop` executes the governed desktop smoke route against the packaged desktop release asset set, freezing install-and-launch evidence before release finalization or publication moves forward.
`pnpm release:smoke:server` executes the governed server smoke route against the packaged server release asset set, freezing boot-and-health evidence before release finalization or publication moves forward.
`pnpm release:smoke:container` executes the governed container smoke route against the packaged container release asset set, freezing image-startup and deployment-readiness evidence before release finalization or publication moves forward.
`pnpm release:smoke:kubernetes` executes the governed kubernetes smoke route against the packaged kubernetes release asset set, freezing rollout-health and manifest-application evidence before release finalization or publication moves forward.
`pnpm release:smoke:web` executes the governed web smoke route against the packaged web release asset set, freezing browser-boot and hosting-readiness evidence before release finalization or publication moves forward.
`pnpm release:smoke:desktop-packaged-launch` executes the governed packaged desktop launch route against the packaged desktop release asset set, freezing post-package boot evidence before release finalization or publication moves forward.
`pnpm release:smoke:desktop-startup` executes the governed desktop startup route against the packaged desktop release asset set, freezing first-start lifecycle evidence before release finalization or publication moves forward.
`pnpm release:finalize` finalizes the governed release asset set, freezing release-control metadata, checksum inventory, quality evidence archives, desktop installer trust evidence, and publication-ready `release-manifest.json` output before finalized smoke or downstream distribution moves forward. When the requested promotion is `formal` or `general-availability`, finalize now fails fast if packaged stop-ship evidence is still present.
`pnpm release:smoke:finalized` executes the governed finalized-release smoke route against the already finalized release asset set, freezing post-finalize replay evidence before publication signoff or downstream distribution moves forward. It also rejects any formal or GA-tagged finalized manifest whose packaged stop-ship evidence, including desktop installer trust evidence, is still non-empty, and when `SHA256SUMS.txt` is already present it refreshes that checksum inventory from the finalized `artifacts` publication view so the new finalized-smoke report cannot silently expand the publishable checksum set.
`pnpm release:write-attestation-evidence` writes `release-attestations.json` after GitHub artifact attestation by replaying `gh attestation verify` for every finalized artifact against the repository, release tag, source ref, and SLSA predicate type recorded by the release profile.
`pnpm release:assert-ready` replays the release readiness assertion against the finalized manifest, `release-manifest.json.sha256.txt`, `SHA256SUMS.txt`, and `release-attestations.json`, proving `releaseCoverage.status` is `complete`, `releaseCoverage.allowPartialRelease` is `false`, all required targets are present, every publishable artifact still matches its recorded digest and byte size, every attestation evidence entry is verified and digest-bound, and any formal/GA desktop installer trust evidence has passed its platform scheme.
`pnpm release:rehearsal:verify` replays the dry-run `rehearsalPlan` against the real finalized release evidence after readiness assertion. It emits `birdcoder.releaseRehearsalExecution.v1` evidence under `artifacts/release-rehearsal/release-rehearsal-execution-report.json`, returns `blocked` for missing real evidence paths, returns `failed` for dry-run schema or command-plan drift, and never executes signing, attestation, publication, packaging, smoke, finalization, or any other release-producing command.
The emitted `finalized-release-smoke-report.json` now also carries `stopShipSignals` and `promotionReadiness`, so machine consumers can distinguish “evidence summaries still match packaged artifacts” from “formal/GA promotion is actually clear” without re-implementing release-governance logic from raw `qualityEvidence`.

## Release Control Examples

```bash
pnpm release:plan -- --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md
pnpm release:rollback:plan -- --release-tag release-2026-04-09-105 --release-assets-dir artifacts/release --rollback-command "gh workflow run rollback.yml --ref main"
pnpm release:finalize -- --release-assets-dir artifacts/release --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md --repository Sdkwork-Cloud/sdkwork-birdcoder
```

`releaseKind` allows `formal`, `canary`, `hotfix`, and `rollback`. `rollbackCommand` remains optional, but `rollbackRunbookRef` must always exist.
Rendered release notes must always show a rollback entry and writeback targets. If `rollbackCommand` is omitted, the fallback entry becomes `pnpm release:rollback:plan -- --release-tag <tag> --release-assets-dir <dir>`.
