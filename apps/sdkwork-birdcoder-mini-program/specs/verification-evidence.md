# Verification Evidence

This file records the intended evidence set for the initialization round. Command results are updated after local verification.

| Command | Purpose | Result |
| --- | --- | --- |
| `node scripts/birdcoder-client-env.mjs --surface miniProgram` from repository root | Materialize all client profile inputs including eight mini-program JSON files | Passed: 8 files materialized |
| `node scripts/birdcoder-client-env.mjs --check --surface miniProgram` from repository root | Prove generated profiles match topology authority | Passed: 8 files verified |
| `pnpm check:client-env` from repository root | Verify PC, H5, Flutter, and mini-program materialization contract together | Passed: 32 files plus contract test |
| `pnpm typecheck` | Strict TypeScript package/bootstrap check | Passed |
| `pnpm lint` | Raw HTTP, browser leakage, and platform-global boundary scan | Passed |
| `pnpm test` | Config, route, package architecture, and session contracts | Passed: 7 tests |
| `pnpm build` | Deterministic native WeChat `dist/` build | Passed: `cloud.production` |
| Static package-size inspection | Inspect deterministic root package before DevTools upload | Passed: 11 files, 12.01 KiB |
| `pnpm verify` | Aggregate local checks and build | Passed |
| SDKWork source-config validator | Validate delegated application-root `etc/` | Passed |
| SDKWork app-manifest and deployment validators | Validate v3 runtime, package, deployment, and release metadata | Passed |
| SDKWork pnpm script validator | Validate public command vocabulary | Passed |
| SDKWork component port validator (`--strict`) | Validate package contracts and ports | Passed |
| SDKWork application layering validator | Validate package dependency direction | Passed |

Unresolved toolchain evidence:

- WeChat DevTools CLI is installed, but its login-state command did not return within the bounded check window. Authenticated preview/upload evidence was therefore not produced, so publication remains blocked.
- Complete visual parity requires representative H5 and WeChat simulator screenshots after the full capability conversion.
