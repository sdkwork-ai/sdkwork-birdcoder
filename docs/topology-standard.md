# SDKWork BirdCoder Topology

Archetype: `application-http-gateway` (`specs/topology.spec.json`, `schemaVersion: 2`).

Platform standard: `../sdkwork-specs/APP_RUNTIME_TOPOLOGY_ADOPTION.md`

## Default dev profile

`self-hosted.split-services.development` — load the profile with:

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
| `platform.api-gateway` | platform | Appbase, IAM, and other platform SDKs via `sdkwork-api-gateway` |

Loader: `scripts/lib/birdcoder-topology.mjs` → `@sdkwork/app-topology`.

IAM mode mapping:

| Topology profile | IAM deployment mode |
| --- | --- |
| `self-hosted.split-services.*` | `server-private` |
| `self-hosted.unified-process.*` | `desktop-local` |
| `cloud-hosted.split-services.*` | `cloud-saas` |

Validate:

```bash
pnpm test:topology-validate
pnpm test:topology-baggage
```
