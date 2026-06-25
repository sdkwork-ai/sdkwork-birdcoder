> Migrated from `docs/topology-standard.md` on 2026-06-24.
> Owner: SDKWork maintainers

Archetype: `application-http-gateway` (`specs/topology.spec.json`, `schemaVersion: 2`).

Platform standard: `../sdkwork-specs/APP_RUNTIME_TOPOLOGY_ADOPTION.md`

## Default dev profile

`standalone.split-services.development` — load the profile with:

```bash
pnpm birdcoder:dev
```

Cloud development profile:

```bash
pnpm birdcoder:dev:cloud
```

Desktop unified-process profile (embedded Tauri server):

```bash
pnpm birdcoder:dev:desktop
```

## Surfaces

| Surface id | Plane | Consumer |
| --- | --- | --- |
| `application.public-ingress` | application | BirdCoder App/Backend SDKs, PC runtime API |
| `platform.api-gateway` | platform | Appbase, IAM, and other platform SDKs via `sdkwork-api-cloud-gateway` |

Loader: `scripts/lib/birdcoder-topology.mjs` → `@sdkwork/app-topology`.

IAM mode mapping:

| Topology profile | IAM deployment mode |
| --- | --- |
| `standalone.split-services.*` | `server-private` |
| `standalone.unified-process.*` | `desktop-local` |
| `cloud.split-services.*` | `cloud-saas` |

Validate:

```bash
pnpm test:topology-validate
pnpm test:topology-baggage
```

