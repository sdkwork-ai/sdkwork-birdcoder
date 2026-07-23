# SDKWork BirdCoder H5 SDKs

H5 consumes the canonical BirdCoder App SDK generated at the application root. BirdCoder owns no
backend-api or open-api SDK family.

## Dependency Composition

- `sdks/specs/component.spec.json` declares the consumed family manifests.
- App SDK consumer boundary: `@sdkwork/birdcoder-h5-core`

## Canonical Generation Authority

Generated OpenAPI SDK artifacts remain owned by:

```text
sdks/sdkwork-birdcoder-app-sdk/
```

Regenerate with:

```bash
pnpm sdk:generate
```

H5 must not fork generated SDK output. Runtime code composes the App SDK through `h5-core`.
