# Development

BirdCoder development follows the package-first SDKWork application workflow while keeping IAM on the canonical SDKWork IAM contract.

## Core Commands

```bash
pnpm dev
pnpm dev:desktop:local
pnpm dev:browser:postgres:standalone
pnpm dev:browser:postgres:cloud
pnpm dev:desktop
pnpm dev:desktop:standalone
pnpm dev:desktop:cloud
pnpm dev:desktop:local
pnpm dev:desktop:standalone
pnpm dev:desktop:cloud
pnpm dev:desktop:local
pnpm dev:desktop:standalone
pnpm dev:desktop:cloud
pnpm dev:browser:standalone
pnpm dev:browser:cloud
pnpm dev:browser:standalone
pnpm dev:browser:cloud
pnpm dev:server:postgres:standalone
pnpm dev:server:standalone
pnpm dev:server:cloud
pnpm lint
pnpm build
pnpm release:package:desktop:local
pnpm release:package:browser:standalone
pnpm release:package:server:standalone
pnpm docs:build
pnpm check:multi-mode
pnpm check:iam:sample
```

Use `pnpm dev` for the default private BirdCoder web sample stack, `pnpm dev:desktop:local` or `pnpm dev:desktop` for the desktop-local loop, and `pnpm dev:server:postgres:standalone` for the private server-hosted loop. `pnpm dev` and `pnpm dev:browser:postgres:standalone` are stack-style entrypoints: they start the native BirdCoder server, wait for the unauthenticated infrastructure readiness probe at `/readyz`, then boot the browser host against the same SDKWork IAM facade. Use `pnpm dev:browser:standalone` only when the browser host should attach to an already running private server.

## IAM Deployment Commands

BirdCoder has three IAM deployment modes:

- `desktop-local`: `pnpm dev:desktop:local`, `pnpm dev:desktop`, `pnpm dev:desktop:local`, and `pnpm dev:desktop:local` run the desktop host with an embedded coding server and local SDKWork IAM storage.
- `server-private`: `pnpm dev`, `pnpm dev:browser:postgres:standalone`, `pnpm dev:desktop:standalone`, `pnpm dev:desktop:standalone`, `pnpm dev:browser:standalone`, `pnpm dev:server:postgres:standalone`, and `pnpm dev:server:standalone` run against a private BirdCoder server exposing the standard SDKWork IAM app facade.
- `cloud-saas`: `pnpm dev:browser:postgres:cloud`, `pnpm dev:desktop:cloud`, `pnpm dev:desktop:cloud`, `pnpm dev:browser:cloud`, and `pnpm dev:server:cloud` run against the cloud-backed SDKWork IAM authority.

The stack aliases keep delivery topology explicit:

- `pnpm dev:desktop:local`, `pnpm dev:desktop:standalone`, and `pnpm dev:desktop:cloud` start the server and desktop host for the matching IAM deployment mode.
- `pnpm dev:browser:standalone` and `pnpm dev:browser:cloud` start the server and browser host for private or cloud-backed verification.
- `pnpm release:package:desktop:local`, `pnpm release:package:desktop:standalone`, `pnpm release:package:desktop:cloud`, `pnpm release:package:browser:standalone`, `pnpm release:package:browser:cloud`, `pnpm release:package:server:standalone`, and `pnpm release:package:server:cloud` are packaging aliases over the matching build lanes.

The wrappers load the standard Vite env files from the workspace root:

- `.env`
- `.env.local`
- `.env.development`
- `.env.development.local`
- `.env.production`
- `.env.production.local`

They then normalize mode-specific defaults for:

- `SDKWORK_IAM_MODE`
- `SDKWORK_IAM_APP_API_BASE_URL`
- `SDKWORK_IAM_DEV_FIXED_VERIFY_CODE`
- `BIRDCODER_API_BASE_URL` and `VITE_BIRDCODER_API_BASE_URL`
- `BIRDCODER_CODING_SERVER_SQLITE_FILE`
- `VITE_BIRDCODER_AUTH_DEV_*` quick-login hints

`VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` and `VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET` are the public renderer-side deployment hints, while SDKWork IAM runtime settings remain authoritative after `/app/v3/api/system/iam/runtime` is loaded. BirdCoder keeps the frontend service contract on the same app API facade in every deployment mode:

- `/app/v3/api/auth/*`
- `/app/v3/api/iam/users/current`
- `/app/v3/api/memberships/current`
- `/app/v3/api/memberships/package_groups`

Use the inspector before switching deployment styles when you need a deterministic view of the managed env:

```bash
pnpm check:env:desktop:local -- desktop-dev --iam-mode desktop-local
pnpm check:env:desktop:local -- web-dev --iam-mode server-private
pnpm check:env:desktop:local -- server-dev --iam-mode server-private
pnpm check:env:desktop:local -- server-dev --iam-mode cloud-saas
```

The inspector masks secret-like values but keeps the effective sqlite path, IAM mode, app API base URL, and dev prefill flags visible. `pnpm check:iam:sample` runs the desktop, web, and server IAM inspectors across the standardized local, private, and cloud lanes, then verifies the sample delivery surface for private and cloud deployment. When no explicit `SDKWORK_IAM_APP_API_BASE_URL` is set for the cloud slice, the sample check injects `https://app-api.example.com` as a deterministic placeholder so the wiring can be verified without a live upstream authority.

For local iteration, remote desktop modes use `http://127.0.0.1:10240` as the default client API base URL when no explicit value is configured. For release packaging, `build:desktop:private` and `build:desktop:cloud` require an explicit `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL`, so packaged apps never fall back to localhost by accident.

## Local Identity And Developer Prefill

Identity (`tenant_id`, `organization_id`, `app_id`) is established through the standard SaaS dual-token flow:

1. `POST /app/v3/api/auth/register` on a cold database, or
2. `POST /app/v3/api/auth/sessions` after registration

Do not inject fixed tenant, organization, or app identifiers through environment variables.

For optional login-form prefill in development, set explicit `VITE_BIRDCODER_AUTH_DEV_*` values. For fixed verification codes in local server runs, set `SDKWORK_IAM_DEV_FIXED_VERIFY_CODE`.

```bash
VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true
VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL=you@example.test
VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD=your-dev-password
SDKWORK_IAM_DEV_FIXED_VERIFY_CODE=123456
```

`pnpm lint` is the fastest source-hygiene checkpoint for style and static consistency, `pnpm build` freezes the shared production bundle outputs, `pnpm docs:build` freezes the VitePress documentation output, and `pnpm check:multi-mode` verifies that desktop, server, container, kubernetes, and web delivery surfaces still move together before broader release verification.

## Auth Surface Invariant

BirdCoder is the sample integration for the shared SDKWork IAM surface. The sample auth page has one non-negotiable UI rule:

- The left rail stays on the QR panel for `login`, `register`, and `forgot-password`.
- Password, email-code, and phone-code methods remain available through the form area and runtime metadata, but they must not replace the QR rail.
- The QR rail is backed by BirdCoder SDKWork IAM APIs, not a decorative placeholder.
- Future refactors must preserve this behavior even when upstream metadata changes or runtime auth methods are reorganized.

The current enforcement point lives in `packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx`, where BirdCoder applies a local runtime invariant that keeps `qrLoginEnabled: true` for the sample auth surface.

## Auth QR Contract

BirdCoder keeps the auth surface and server contract aligned around the QR-first sample flow:

- `POST /app/v3/api/auth/qr_login_codes` creates a login QR challenge for the left rail.
- `GET /app/v3/api/auth/qr_login_codes/{qrKey}` polls the QR challenge status until it becomes `confirmed` or `expired`.
- Internal support routes such as `/app/v3/api/auth/qr/entry/{qrKey}` and `/app/v3/api/auth/qr/confirm` remain server-owned support endpoints for the session-transfer flow and must not replace the public QR contract above.

## Release-Oriented Verification

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
pnpm check:quality-report
pnpm check:quality-execution-report
pnpm check:iam-standard
```

Use targeted package commands during implementation, then run broader workspace gates before finalizing release-facing changes. `pnpm check:package-governance` freezes workspace package naming, ownership, and root-managed dependency rules. `pnpm check:desktop` validates desktop packaging assumptions, host bindings, and desktop-facing runtime integrations in isolation. `pnpm check:server` validates server bootstrap, runtime wiring, and server-facing packaging expectations in isolation.

`pnpm check:release-flow` freezes release planning, packaging, smoke routing, and finalization contracts before release automation changes are treated as stable. `pnpm check:ci-flow` freezes the reusable workflow and quality-tier handoff topology. `pnpm check:governance-regression` regenerates the machine-readable governance baseline and records structured blocker diagnostics instead of treating host limitations as repository regressions. `pnpm check:live-docs-governance-baseline` proves that active docs still match the live baseline, and `pnpm check:quality-matrix` freezes the declared `fast -> standard -> release` tier model before quality evidence is consumed downstream.

`pnpm check:iam-standard` is the SDKWork IAM boundary gate for auth, current user, session, profile, and VIP membership flows. It must stay tied to generated SDKs, OpenAPI source contracts, Rust IAM parity, and the no-legacy identity contract rather than a local compatibility layer. `pnpm check:quality:fast` is the first executable release-readiness gate, `pnpm check:quality:standard` expands that set, and `pnpm check:quality:release` is the highest local quality gate before release-facing changes are treated as ready. `pnpm check:quality-report` records the current quality matrix and blocker diagnostics, while `pnpm check:quality-execution-report` preserves the real gate cascade and downstream skipped tiers.
