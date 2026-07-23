# BirdCoder SDK Contracts

`component.spec.json` is the SDK workspace contract. The family-specific contract is
`../sdkwork-birdcoder-app-sdk/specs/component.spec.json`, and the family manifest is
`../sdkwork-birdcoder-app-sdk/sdk-manifest.json`.

The only API authority and sdkgen input are:

- `../sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json`
- `../sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json`

Both contain the same 39 BirdCoder-owned App API operations. Backend API and Open API operation
counts are zero, so no empty manifests, families, facades, or generated outputs exist for those
surfaces. `domain-catalog.json` contains only domains present in this owner-only authority.

Canonical rules remain in `../../../sdkwork-specs/API_SPEC.md`,
`../../../sdkwork-specs/SDK_SPEC.md`, and
`../../../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md`.
