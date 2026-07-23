# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.1.x (STABLE) | Yes |
| < 0.1.0 | No |

Security fixes are delivered through the SDKWork BirdCoder release train documented in
`sdkwork.app.config.json` and verified by `pnpm run check:release-flow`.

## Reporting a Vulnerability

Do **not** open public GitHub issues for security vulnerabilities.

Report security issues to SDKWork through the official support channel:

- Support: https://sdkwork.com/support
- Application page: https://sdkwork.com/apps/sdkwork-birdcoder

Include:

- Affected version and deployment profile (cloud, standalone, desktop, web)
- Reproduction steps or proof of concept
- Impact assessment (confidentiality, integrity, availability)
- Any suggested remediation

We aim to acknowledge reports within **5 business days** and provide a remediation
timeline based on severity.

## Scope

In scope:

- SDKWork BirdCoder PC web, desktop (Tauri), and Rust application-gateway surfaces
- Authentication, session, and IAM integration under `apps/sdkwork-birdcoder-pc/`
- Generated app/backend SDK consumers and OpenAPI contract surfaces
- Release artifacts published through the SDKWork packaging workflow

Out of scope:

- Vendored trees under `external/` unless explicitly integrated into BirdCoder release artifacts
- Third-party model providers, OAuth identity providers, and customer-managed infrastructure
- Issues requiring physical access to an already unlocked user device

## Secure Development

BirdCoder follows SDKWork standards in `sdkwork-specs/`, including:

- `SECURITY_SPEC.md` — token model, authn/authz, secrets, input validation
- `IAM_LOGIN_INTEGRATION_SPEC.md` — session bootstrap and fail-closed auth
- `SUPPLY_CHAIN_SECURITY_SPEC.md` — checksums, SBOM, signing, attestations
- `PRIVACY_SPEC.md` — data classification and retention

Verification commands:

```bash
pnpm run lint
pnpm run check:release-flow
pnpm run check:api-transport-standard
```

## Disclosure

We coordinate disclosure with reporters and publish release notes for confirmed
security fixes through the SDKWork app catalog when fixes ship in a STABLE release.
