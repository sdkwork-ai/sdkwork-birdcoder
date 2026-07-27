# SDKWork Birdcoder UI Component Specs

This directory is the local standards index for `@sdkwork/birdcoder-pc-ui`.

Root SDKWork standards remain authoritative. Local component specs can narrow or document this component, but they must not contradict [the root standards](../../../../../specs/README.md).

## Component

| Field | Value |
| --- | --- |
| Name | `@sdkwork/birdcoder-pc-ui` |
| Type | `react-package` |
| Root | `sdkwork-birdcoder/packages/sdkwork-birdcoder-ui` |
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

## Session Runtime Status Presentation

`SessionRuntimeStatusSlot` is the shared Code and Studio trailing status slot.
Provider identity is the row's leftmost visual item. Only `initializing` and
`streaming` animate; approval, tool, and user-question waits are static
attention; `failed` is explicit; `stale` is static neutral. `unknown`, `null`,
or absent runtime status renders no label, icon, or reserved slot. Session rows
expose `data-session-trailing-metadata="true"` on the independent auto-aligned,
end-justified, right-aligned time/status-text region immediately before the
runtime icon.

The component presents a workbench-resolved effective status. It does not
query a provider, own freshness timers, inspect provider files, or choose a
Session. Neutral and attention states expose localized accessible labels and
do not depend on animation or color alone.

## Verification

- `pnpm --filter @sdkwork/birdcoder-pc-ui typecheck`
- `node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx`
