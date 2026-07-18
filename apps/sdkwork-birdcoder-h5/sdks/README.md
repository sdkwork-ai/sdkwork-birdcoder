# SDKWork BirdCoder H5 SDKs

H5 consumes the canonical BirdCoder SDK families generated under the PC application root. The
SDK workspace component spec declares consumer-surface ownership for H5 app and backend-admin
boundaries.

## Dependency Composition

- `sdks/specs/component.spec.json` declares the consumed family manifests.
- App SDK consumer boundary: `@sdkwork/birdcoder-h5-core`
- Backend-admin SDK consumer boundary: `@sdkwork/birdcoder-h5-admin-core`

## Canonical Generation Authority

Generated OpenAPI SDK artifacts remain owned by:

```text
apps/sdkwork-birdcoder-pc/sdks/
```

Regenerate with:

```bash
pnpm sdk:generate
```

H5 must not fork generated SDK output. Runtime code composes generated clients through `h5-core`
and `h5-admin-core`.
