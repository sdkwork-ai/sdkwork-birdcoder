# SDKWork BirdCoder SDK Family Specs

This directory is the local standards index for the BirdCoder SDK family.

Root SDKWork standards remain authoritative. The SDK family narrows those standards for BirdCoder app and backend SDK generation without copying or redefining them.

## Component

| Field | Value |
| --- | --- |
| Name | `sdkwork-birdcoder-sdk-family` |
| Type | `sdk-family` |
| Root | `sdkwork-birdcoder/sdks` |
| Domain | `platform` |
| Capability | `sdk` |
| Languages | `typescript`, `rust` |
| Standard profile | `sdkwork-v3` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable component contract.
- [../.sdkwork-assembly.json](../.sdkwork-assembly.json) is the SDK generation manifest.
- [openapi/birdcoder-app-v3.openapi.json](./openapi/birdcoder-app-v3.openapi.json) is the app SDK OpenAPI source.
- [openapi/birdcoder-backend-v3.openapi.json](./openapi/birdcoder-backend-v3.openapi.json) is the backend SDK OpenAPI source.

## Canonical Specs

| Spec | Applies Because |
| --- | --- |
| [README.md](../../../../specs/README.md) | Root SDKWork standards entrypoint. |
| [API_SPEC.md](../../../../specs/API_SPEC.md) | OpenAPI, app/backend surfaces, path, tag, operationId, auth, and error rules. |
| [SDK_SPEC.md](../../../../specs/SDK_SPEC.md) | SDK generation manifest, resource-style clients, auth handling, and generated output rules. |
| [COMPONENT_SPEC.md](../../../../specs/COMPONENT_SPEC.md) | Local sdk-family component spec and manifest rules. |
| [DOCUMENTATION_SPEC.md](../../../../specs/DOCUMENTATION_SPEC.md) | SDK README and example documentation rules. |
| [TEST_SPEC.md](../../../../specs/TEST_SPEC.md) | Executable API, SDK, generated output, and documentation verification rules. |
| [DOMAIN_SPEC.md](../../../../specs/DOMAIN_SPEC.md) | Canonical `iam`, `platform`, and `intelligence` domain naming. |

## Verification

- `pnpm check:sdk-family-standard`
- `pnpm generate:sdk:birdcoder`
- `pnpm check:sdk-family-generated`
