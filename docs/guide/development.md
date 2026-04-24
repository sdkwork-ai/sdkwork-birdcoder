# Development

BirdCoder development keeps the same package-first workflow used by the aligned Claw Studio architecture.

## Core commands

```bash
pnpm dev
pnpm dev:local
pnpm dev:private
pnpm dev:external
pnpm dev:cloud
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
pnpm lint
pnpm build
pnpm package:desktop:local
pnpm package:web:private
pnpm package:server:private
pnpm docs:build
pnpm check:multi-mode
pnpm check:identity:sample
```

Use `pnpm dev` for the default private BirdCoder web sample stack, `pnpm dev:local` or `pnpm tauri:dev` for the desktop-hosted local single-machine loop, and `pnpm server:dev` for the private server-hosted runtime loop. The explicit `desktop:*`, `web:*`, `server:*`, and `package:*` aliases keep the sample-app onboarding path and operator-facing mode matrix standardized. `pnpm dev` and `pnpm dev:private` are intentionally stack-style entrypoints now: they start the native BirdCoder server first, wait for the canonical health and auth-config routes, and only then boot the browser host so local login works out of the box with the builtin-local bootstrap account and dev prefill defaults. Use `pnpm web:dev:private` when you explicitly want only the browser host against an already running private server.

## Identity deployment commands

BirdCoder standardizes three identity deployment modes behind the root `pnpm` wrappers:

- `pnpm dev:local`, `pnpm tauri:dev`, or `pnpm tauri:dev:local`: desktop-local mode. Tauri embeds the coding server, uses the desktop-local sqlite file, and boots the builtin local user center.
- `pnpm dev` or `pnpm dev:private`: one-command browser-hosted sample stack against a private BirdCoder server. The wrapper starts the server first, waits for `/api/core/v1/health` and `/api/app/v1/auth/config`, defaults `VITE_BIRDCODER_API_BASE_URL` to `http://127.0.0.1:10240` in local iteration when no explicit value is configured, and keeps the builtin-local dev account prefilled for quick login verification.
- `pnpm dev:cloud`: browser-hosted workbench against a cloud-backed BirdCoder server.
- `pnpm dev:external`: browser-hosted workbench against a private BirdCoder server that binds the `external-user-center` provider.
- `pnpm desktop:dev:local`, `pnpm desktop:dev:private`, `pnpm desktop:dev:external`, and `pnpm desktop:dev:cloud`: explicit desktop command matrix for local, private-server, external-provider, and cloud-backed identity validation.
- `pnpm web:dev:private`, `pnpm web:dev:external`, and `pnpm web:dev:cloud`: explicit browser-hosted command matrix for private-server, external-provider, and cloud-backed identity validation when the corresponding server is already running or managed separately.
- `pnpm stack:desktop:local`: one-command local desktop sample stack with embedded server and builtin local user center.
- `pnpm stack:desktop:private`, `pnpm stack:desktop:external`, and `pnpm stack:desktop:cloud`: one-command BirdCoder server plus desktop-host sample stacks for the private, external-provider, and cloud-backed lanes.
- `pnpm stack:web:private`, `pnpm stack:web:external`, and `pnpm stack:web:cloud`: one-command BirdCoder server plus browser-host sample stacks for the private, external-provider, and cloud-backed lanes.
- `pnpm tauri:dev:private`: desktop shell targets a separately running BirdCoder server with the builtin local user center.
- `pnpm tauri:dev:external`: desktop shell targets a separately running BirdCoder server that keeps the same BirdCoder auth facade but binds `external-user-center`.
- `pnpm tauri:dev:cloud`: desktop shell targets a separately running BirdCoder server that delegates identity to `sdkwork-cloud-app-api`.
- `pnpm server:dev` or `pnpm server:dev:private`: private BirdCoder server mode with builtin local user center.
- `pnpm server:dev:external`: private BirdCoder server mode with the `external-user-center` bridge provider.
- `pnpm server:dev:cloud`: BirdCoder server mode with upstream `sdkwork-cloud-app-api` identity integration.
- `pnpm build`, `pnpm build:private`, `pnpm build:external`, and `pnpm build:cloud` generate browser bundles for the private, external-provider, or cloud server integrations.
- `pnpm tauri:build`, `pnpm tauri:build:private`, `pnpm tauri:build:external`, and `pnpm tauri:build:cloud` package the desktop shell for those same deployment lanes.
- `pnpm server:build`, `pnpm server:build:external`, and `pnpm server:build:cloud` package the BirdCoder server for private, external-provider, or cloud identity deployment.
- `pnpm package:desktop:local`, `pnpm package:desktop:private`, `pnpm package:desktop:external`, and `pnpm package:desktop:cloud` are thin packaging aliases over the standardized desktop build commands.
- `pnpm package:web:private`, `pnpm package:web:external`, `pnpm package:web:cloud`, `pnpm package:server:private`, `pnpm package:server:external`, and `pnpm package:server:cloud` extend that explicit packaging matrix to browser and server delivery surfaces.
- `pnpm identity:show -- <target> --identity-mode <mode>` prints the final managed identity env after `.env` loading and mode normalization.

The wrappers load the standard Vite env files from the workspace root:

- `.env`
- `.env.local`
- `.env.development`
- `.env.development.local`
- `.env.production`
- `.env.production.local`

They then normalize mode-specific defaults for:

- `BIRDCODER_USER_CENTER_LOGIN_PROVIDER`
- `BIRDCODER_API_BASE_URL` and `VITE_BIRDCODER_API_BASE_URL`
- `BIRDCODER_CODING_SERVER_SQLITE_FILE`
- `VITE_BIRDCODER_AUTH_DEV_*` quick-login hints

The wrappers also mirror `BIRDCODER_USER_CENTER_LOGIN_PROVIDER` to `VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER`, and the web and desktop hosts pass that provider kind into the shared runtime bootstrap explicitly. `VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE` now acts as the fallback inference source instead of being the primary authority, which keeps `server-private` on the `builtin-local` standard unless a different provider is configured intentionally. After `/api/app/v1/auth/config` is loaded, BirdCoder synchronizes the server-reported `providerKind` and `providerKey` back into the runtime binding so the live app state stays aligned with the authoritative server metadata.

Provider-scoped env now stays clean as well:

- `builtin-local` keeps local OAuth defaults and local dev quick-login sample values active.
- `sdkwork-cloud-app-api` keeps only the app-api integration env active and automatically turns off inherited local sample quick-login defaults unless you explicitly replace them with remote test credentials.
- `external-user-center` keeps the external header bridge env active and strips builtin-local OAuth, fixed verify-code, and sample quick-login defaults from the effective command env.

Use the inspector before switching deployment styles when you want a deterministic view of what the wrappers will inject:

```bash
pnpm identity:show -- desktop-dev --identity-mode desktop-local
pnpm identity:show -- web-dev --identity-mode server-private
pnpm identity:show -- server-dev --identity-mode server-private --user-center-provider external-user-center
pnpm identity:show -- server-dev --identity-mode cloud-saas
```

The inspector output masks secret-like values, but it keeps the effective sqlite path, provider mode, client API base URL, and dev prefill flags visible.

`pnpm check:identity:sample` is the BirdCoder sample-engineering shortcut for this matrix. It runs the desktop, web, and server identity inspectors across the standardized local, private, external-provider, and cloud lanes, then freezes the sample delivery surface by building the web and server artifacts for private, external, and cloud deployment. When no explicit `BIRDCODER_USER_CENTER_APP_API_BASE_URL` is set, the cloud slice injects `https://app-api.example.com` as a deterministic placeholder so the sample can verify cloud wiring without depending on a live upstream authority.

For local iteration, remote desktop modes use `http://127.0.0.1:10240` as the default client API base URL when no explicit value is configured. For release packaging, `tauri:build:private` and `tauri:build:cloud` require an explicit `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL`, so the packaged app never falls back to localhost by accident.

Regardless of whether the server is running in builtin-local, `sdkwork-cloud-app-api`, or `external-user-center` provider mode, BirdCoder keeps the frontend contract on the same `/api/app/v1/auth/*`, `/api/app/v1/user/profile`, and `/api/app/v1/vip/info` facade so the sample app does not need deployment-mode branches.

## Local bootstrap account

In development and test flows, the builtin local user center seeds one bootstrap account automatically and the shared auth UI pre-fills it by default for `pnpm dev`, `pnpm dev:private`, `pnpm dev:local`, `pnpm tauri:dev`, and the other builtin-local development lanes:

- Account: `local-default@sdkwork-birdcoder.local`
- Password: `dev123456`
- Fixed verify code for local dev wrappers: `123456`

Override these defaults through `.env` when you need a different quick-login target:

```bash
BIRDCODER_LOCAL_BOOTSTRAP_EMAIL=local-default@sdkwork-birdcoder.local
BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD=dev123456
VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true
VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT=local-default@sdkwork-birdcoder.local
VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD=dev123456
```

`pnpm lint` is the fastest source-hygiene checkpoint for style and static consistency, `pnpm build` freezes the shared production bundle outputs, `pnpm docs:build` freezes the VitePress documentation output, and `pnpm check:multi-mode` verifies that desktop, server, container, kubernetes, and web delivery surfaces still move together before you escalate into the broader release-oriented verification stack.

## Auth surface invariant

BirdCoder is the sample integration for the shared `sdkwork-appbase` identity surface. The sample auth page has one non-negotiable UI rule:

- The left rail must stay on the QR panel for `login`, `register`, and `forgot-password`.
- The legacy left-rail method cards for `password`, `email code`, and `phone code` are not allowed in BirdCoder.
- The QR rail is a real login lane backed by BirdCoder user-center APIs, not a decorative placeholder.
- Future refactors must preserve this behavior even when upstream metadata changes or when runtime auth methods are reorganized.

The current enforcement point lives in `packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx`, where BirdCoder applies a local runtime invariant that keeps `qrLoginEnabled: true` for the sample auth surface.

## Auth QR contract

BirdCoder keeps the auth surface and server contract aligned around the QR-first sample flow:

- `POST /api/app/v1/auth/qr/generate` creates a login QR challenge for the left rail.
- `GET /api/app/v1/auth/qr/status/{qrKey}` polls the QR challenge status until it becomes `confirmed` or `expired`.
- Internal support routes such as `/api/app/v1/auth/qr/entry/{qrKey}` and `/api/app/v1/auth/qr/confirm` remain server-owned support endpoints for the session-transfer flow and must not replace the public QR contract above.

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
pnpm check:identity-standard
pnpm test:user-center-standard
```

Use targeted package commands during implementation, then run the broader workspace gates before finalizing release-facing changes. `pnpm check:package-governance` freezes workspace package naming, ownership, and root-managed dependency rules before you widen the verification scope. `pnpm check:desktop` is the targeted verification path for desktop packaging assumptions, host bindings, and desktop-facing runtime integrations when you are validating the desktop surface in isolation. `pnpm check:server` is the targeted verification path for server bootstrap, runtime wiring, and server-facing packaging expectations when you are validating the server surface in isolation. `pnpm check:release-flow` freezes release planning, packaging, smoke routing, and finalization contracts before release automation changes are treated as stable, and it now delegates to `scripts/run-release-flow-check.mjs` so the governed release-flow lane stays executable on Windows without hitting command-line length limits. `pnpm check:ci-flow` freezes the reusable workflow and quality-tier handoff topology before CI-facing changes are treated as stable. `pnpm check:ui-bundle-segmentation`, `pnpm check:web-react-compat-mode`, and `pnpm check:commons-shell-entry` are the narrowest bundle-boundary guards for UI barrel scope, production React compat mode, and commons shell bootstrap scope before you rerun heavier workspace gates. `pnpm check:governance-regression` regenerates the machine-readable governance baseline, including the release-tier official-SDK-first engine governance set: official SDK presence, runtime selection, runtime adapter, kernel, environment health, capability extension, experimental capability gating, canonical registry governance, provider import and package-manifest governance, browser safety, official-SDK error propagation, provider bridge normalization, engine conformance, tool protocol, and resume or recovery checks. It also forces the web budget slice through a fresh `pnpm build` so missing build artifacts cannot hide a real bundle regression. When the current host reaches the governed Vite or esbuild path and stops at `[vite:define] spawn EPERM`, the same report now records `blockedCheckIds`, `blockingDiagnosticIds`, and `environmentDiagnostics` such as `vite-host-build-preflight` instead of collapsing that host limitation into a false failed repository regression. `pnpm check:live-docs-governance-baseline` proves that the active docs still match that live baseline, and `pnpm check:quality-matrix` freezes the declared `fast -> standard -> release` tier model before quality evidence is consumed downstream while also rejecting a stale workspace `artifacts/quality/quality-gate-matrix-report.json` when that file no longer matches current tier, workflow, or root manifest truth. That freshness comparison is based on stable tier/workflow/manifest truth, not on host-specific `environmentDiagnostics` drift alone. `pnpm check:identity-standard` freezes the split auth and user bridge against `sdkwork-appbase` before release-facing changes are treated as stable. `pnpm test:user-center-standard` freezes the canonical unified user-center lane, including the independent validation plugin and Rust-side handoff, behind one root-owned standard command. `pnpm check:quality:fast` is the first executable release-readiness gate, and its desktop startup-graph lane now selects a free loopback port so another local listener on the legacy `127.0.0.1:1537` port does not fabricate a fast-tier failure. `pnpm check:quality:standard` expands that check set into the broader standard lane, and `pnpm check:quality:release` is the highest local quality gate before release-facing changes are treated as ready. `pnpm quality:report` records the current quality matrix, workflow-bound and manifest-bound tier truth, the release-tier engine-governance `governanceCheckIds`, and blocker diagnostics, while `pnpm quality:execution-report` preserves the real gate cascade and any downstream skipped tiers after that same port-resilient fast-tier verification; rerun `pnpm quality:report` when `pnpm check:quality-matrix` flags stale workspace evidence. On `2026-04-15`, direct outer-shell reruns proved the current split truth on this host: `pnpm.cmd run build` already passes, but `pnpm.cmd check:quality:fast` fails at `check:web-vite-build` with `[vite:define] spawn EPERM`, and direct `pnpm.cmd check:quality:release` exits non-zero for the same reason because `fast` stops first. If `pnpm check:quality:release` stops at that host-level blocker, record it through the quality reports and continue with unblocked repo work instead of rewriting unrelated code.
