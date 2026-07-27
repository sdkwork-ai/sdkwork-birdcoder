# SDKWork Birdcoder Studio Component Specs

This directory is the local standards index for `@sdkwork/birdcoder-pc-studio`.

Root SDKWork standards remain authoritative. Local component specs can narrow or document this component, but they must not contradict [the root standards](../../../../../specs/README.md).

## Component

| Field | Value |
| --- | --- |
| Name | `@sdkwork/birdcoder-pc-studio` |
| Type | `react-package` |
| Root | `sdkwork-birdcoder/packages/sdkwork-birdcoder-studio` |
| Domain | `platform` |
| Capability | `component` |
| Languages | `typescript` |
| Status | `standardizing` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable component contract.
- Consumers should integrate through public exports, runtime entrypoints, SDK clients, or adapters declared in the manifest.
- Generated SDK language outputs are represented at their SDK family root instead of duplicating local specs in generated folders.

## Canonical Specs

| Spec | Applies Because |
| --- | --- |
| [COMPONENT_SPEC.md](../../../../../specs/COMPONENT_SPEC.md) | Local component specs directory and manifest rules. |
| [CONFIG_SPEC.md](../../../../../specs/CONFIG_SPEC.md) | Runtime configuration, environment, SDK bootstrap, and feature flag rules. |
| [DOCUMENTATION_SPEC.md](../../../../../specs/DOCUMENTATION_SPEC.md) | Module README, examples, ADR, changelog, and runbook rules. |
| [DOMAIN_SPEC.md](../../../../../specs/DOMAIN_SPEC.md) | Canonical domain ownership and naming. |
| [FRONTEND_SPEC.md](../../../../../specs/FRONTEND_SPEC.md) | UI, service, SDK, accessibility, and frontend runtime rules. |
| [GOVERNANCE_SPEC.md](../../../../../specs/GOVERNANCE_SPEC.md) | Standard ownership, exception, compatibility, and migration rules. |
| [I18N_SPEC.md](../../../../../specs/I18N_SPEC.md) | User-facing language, locale, message catalog, and fallback rules. |
| [MODULE_SPEC.md](../../../../../specs/MODULE_SPEC.md) | Reusable package contract and dependency direction. |
| [README.md](../../../../../specs/README.md) | SDKWork root standards entrypoint. |
| [SDK_SPEC.md](../../../../../specs/SDK_SPEC.md) | SDK generation and SDK integration rules. |
| [TEST_SPEC.md](../../../../../specs/TEST_SPEC.md) | Contract, frontend, SDK, security, parity, and documentation verification rules. |

## Public Exports

- `.`

## SDK Clients

- No generated SDK client class is declared at this component boundary.

## Local Extension Specs

- No local extension specs are declared yet.

## Session Menu Presentation

Studio consumes the workbench's disposable projection of the canonical Agents
Session Activity summary. Studio Session rows place provider identity at the
left edge and the shared PC UI runtime-status component at the far right. Busy
animation is limited to `initializing` and `streaming`; interaction waits,
failures, and stale freshness states are static. Unknown, `null`, or absent
runtime status is silent and reserves no slot. Studio titles truncate in the
remaining width; time/status text is not stacked below the title and instead
lives in the auto-aligned, right-aligned
`data-session-trailing-metadata="true"` region before the runtime icon.

Background inventory or activity synchronization preserves an explicit Studio
Session selection. The synchronized newest Session is only a default when its
Project has no current or explicit selection. Studio does not infer live state
from provider files or persist an activity projection.

## Verification

- `pnpm --filter @sdkwork/birdcoder-pc-studio typecheck`
- `node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx`
