# SDKWork BirdCoder Component Specs

This directory is the local standards index for `sdkwork-birdcoder`.

Root SDKWork standards remain authoritative. Local component specs can narrow or document this component, but they must not contradict [the root standards](../../sdkwork-specs/README.md).

## Component

| Field | Value |
| --- | --- |
| Name | `sdkwork-birdcoder` |
| Type | `react-tauri-app` |
| Root | `sdkwork-birdcoder` |
| Domain | `intelligence` |
| Capability | `coding-workbench` |
| Surface | `app` |
| Languages | `typescript` |
| Status | `ACTIVE` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable component contract.
- Consumers should integrate through public exports, runtime entrypoints, SDK clients, or adapters declared in the manifest.
- Generated SDK language outputs are represented at their SDK family root instead of duplicating local specs in generated folders.

## Owned Contract

BirdCoder owns the `intelligence / coding-workbench` bounded context only.

| Contract | Authority |
| --- | --- |
| Database | Exactly 10 `studio_*` tables in `database/contract/table-registry.json` |
| App API | 39 operations in `sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json` |
| Backend API | None, 0 operations |
| Open API | None, 0 operations |
| IAM permissions | 33 permissions in `specs/iam.module.manifest.json` |

Agents Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, and
Checkpoint facts belong to `sdkwork-agents`. Human Conversation, Message,
Member, and ReadCursor facts belong to `sdkwork-im`. Skill definitions,
artifacts, capabilities, installation state, APIs, and SDKs belong to
`sdkwork-skills`.

## Canonical Specs

| Spec | Applies Because |
| --- | --- |
| [APP_MANIFEST_SPEC.md](../../sdkwork-specs/APP_MANIFEST_SPEC.md) | sdkwork.app.config.json application registration rules. |
| [APPLICATION_SPEC.md](../../sdkwork-specs/APPLICATION_SPEC.md) | Application shell and module composition. |
| [APP_PC_ARCHITECTURE_SPEC.md](../../sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md) | PC browser/desktop/tablet application root architecture. |
| [APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md](../../sdkwork-specs/APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md) | Cross-client package taxonomy, route identity, component boundaries. |
| [APP_SDK_INTEGRATION_SPEC.md](../../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md) | Cross-architecture app SDK integration, dependency composition, TokenManager wiring. |
| [IAM_LOGIN_INTEGRATION_SPEC.md](../../sdkwork-specs/IAM_LOGIN_INTEGRATION_SPEC.md) | Fast IAM login/session integration, appbase auth UI/runtime, route guards. |
| [COMPONENT_SPEC.md](../../sdkwork-specs/COMPONENT_SPEC.md) | Local component specs directory and manifest rules. |
| [CONFIG_SPEC.md](../../sdkwork-specs/CONFIG_SPEC.md) | Runtime configuration, environment, SDK bootstrap, and feature flag rules. |
| [CODE_STYLE_SPEC.md](../../sdkwork-specs/CODE_STYLE_SPEC.md) | Authored source structure and generated code boundaries. |
| [DEPENDENCY_MANAGEMENT_SPEC.md](../../sdkwork-specs/DEPENDENCY_MANAGEMENT_SPEC.md) | Native workspace dependency declarations, sibling SDKWork source paths, and Git-backed release dependency refs. |
| [DEPLOYMENT_SPEC.md](../../sdkwork-specs/DEPLOYMENT_SPEC.md) | SaaS/private/local runtime parity and deployment rules. |
| [DESKTOP_APP_ARCHITECTURE_SPEC.md](../../sdkwork-specs/DESKTOP_APP_ARCHITECTURE_SPEC.md) | Desktop/tablet native app shell, Tauri host boundary. |
| [DOCUMENTATION_SPEC.md](../../sdkwork-specs/DOCUMENTATION_SPEC.md) | Module README, examples, ADR, changelog, and runbook rules. |
| [DOMAIN_SPEC.md](../../sdkwork-specs/DOMAIN_SPEC.md) | Canonical domain ownership and naming. |
| [FRONTEND_SPEC.md](../../sdkwork-specs/FRONTEND_SPEC.md) | UI, service, SDK, accessibility, and frontend runtime rules. |
| [FRONTEND_CODE_SPEC.md](../../sdkwork-specs/FRONTEND_CODE_SPEC.md) | Frontend authored source structure. |
| [GOVERNANCE_SPEC.md](../../sdkwork-specs/GOVERNANCE_SPEC.md) | Standard ownership, exception, compatibility, and migration rules. |
| [I18N_SPEC.md](../../sdkwork-specs/I18N_SPEC.md) | User-facing language, locale, message catalog, and fallback rules. |
| [MODULE_SPEC.md](../../sdkwork-specs/MODULE_SPEC.md) | Reusable package contract and dependency direction. |
| [NAMING_SPEC.md](../../sdkwork-specs/NAMING_SPEC.md) | Canonical SDKWork naming rules. |
| [OBSERVABILITY_SPEC.md](../../sdkwork-specs/OBSERVABILITY_SPEC.md) | Log, metric, trace, audit, and diagnostic rules. |
| [PERFORMANCE_SPEC.md](../../sdkwork-specs/PERFORMANCE_SPEC.md) | Latency, pagination, bundle, scalability, and retry budget rules. |
| [README.md](../../sdkwork-specs/README.md) | SDKWork root standards entrypoint. |
| [SDK_SPEC.md](../../sdkwork-specs/SDK_SPEC.md) | SDK generation and SDK integration rules. |
| [SECURITY_SPEC.md](../../sdkwork-specs/SECURITY_SPEC.md) | Token model, tenant-bound signing, authn/authz, secrets, rate limits, CORS. |
| [TEST_SPEC.md](../../sdkwork-specs/TEST_SPEC.md) | Contract, frontend, SDK, security, parity, and documentation verification rules. |
| [TYPESCRIPT_CODE_SPEC.md](../../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md) | TypeScript and Node package rules. |
| [UI_ARCHITECTURE_SPEC.md](../../sdkwork-specs/UI_ARCHITECTURE_SPEC.md) | UI architecture selection rules. |
| [APP_PC_REACT_UI_SPEC.md](../../sdkwork-specs/APP_PC_REACT_UI_SPEC.md) | PC React package rules. |

## Public Exports

- Public exports are not declared in the package manifest.

## SDK Clients

- No generated SDK client class is declared at this component boundary.

## Local Extension Specs

- [domain-ownership.spec.json](./domain-ownership.spec.json) - BirdCoder's
  machine-readable workbench ownership, dependency, persistence, and API
  boundary. It forbids local platform-domain copies, projections, shadow
  tables, compatibility facades, and dual-write.
- [agent-session-item-view.spec.md](./agent-session-item-view.spec.md) defines the
  non-persistent UI adaptation of Agents Session Items and distinguishes it
  from IM messaging.
- [kernel-birdcoder-alignment.spec.json](./kernel-birdcoder-alignment.spec.json)
  enforces the one-way `BirdCoder -> Agents -> Kernel` dependency boundary.
- [agents-birdcoder-alignment.spec.json](./agents-birdcoder-alignment.spec.json)
  records the direct Agents SDK integration evidence for every BirdCoder
  surface.

## Verification

- `pnpm check:domain-ownership`
- `pnpm check:agents-birdcoder-alignment`
- `pnpm check:kernel-birdcoder-alignment`
- `pnpm typecheck`
