# SDKWork BirdCoder H5 SDKs

This directory contains SDK family workspaces and generation manifests for the H5 application.

## SDK Families

No SDK families have been generated yet. SDK families will be created here following `SDK_WORKSPACE_GENERATION_SPEC.md`.

## Expected Structure

```
sdks/
  .sdkwork-assembly.json
  README.md
  specs/
    component.spec.json
    domain-catalog.json
    openapi/
  sdkwork-birdcoder-h5-app-sdk/
    sdkwork-birdcoder-h5-app-sdk-typescript/
  sdkwork-birdcoder-h5-backend-sdk/
    sdkwork-birdcoder-h5-backend-sdk-typescript/
```

## Generation

To generate SDK families, run:
```bash
pnpm generate:sdk:birdcoder
```
