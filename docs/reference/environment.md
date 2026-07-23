# Environment

BirdCoder resolves deployment profile, runtime target, lifecycle environment,
and connectivity-plane URLs as independent values. Active templates live under
`etc/topology`; `specs/topology.spec.json` is the vocabulary and orchestration
authority. Source-controlled examples contain no credentials or project paths.

## Runtime Selectors

| Variable | Scope | Allowed or purpose |
| --- | --- | --- |
| `SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` | Process host | `standalone` or `cloud`. |
| `SDKWORK_BIRDCODER_RUNTIME_TARGET` | Process host | `browser`, `desktop`, `server`, `container`, `test-runner`, or another supported target. |
| `SDKWORK_BIRDCODER_ENVIRONMENT` | Process host | `development`, `test`, `staging`, or `production`. |
| `SDKWORK_BIRDCODER_PROFILE_ID` | Topology materialization | Exact `<deploymentProfile>.<environment>` profile id. |
| `VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` | Browser renderer | Public mirror of the selected deployment profile. |
| `VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET` | Browser renderer | Public mirror of the renderer target. |

Deployment profile does not encode process shape, storage, IAM implementation,
project root, runtime location, or execution capability. Do not add another
public deployment axis for those concerns.

## Stateless Server Configuration

| Variable | Purpose | Security boundary |
| --- | --- | --- |
| `SDKWORK_BIRDCODER_APPLICATION_PUBLIC_INGRESS_BIND` | Application ingress bind in `<host>:<port>` form. | Production and cloud server targets cannot bind loopback-only. |
| `SDKWORK_BIRDCODER_SERVER_HOST` | Host fallback when an ingress bind is not supplied. | Must be a valid host value. |
| `SDKWORK_BIRDCODER_SERVER_PORT` | Listener port fallback. | Must be a valid non-zero port. |
| `SDKWORK_BIRDCODER_ALLOWED_ORIGINS` | Comma-separated browser origins. | Required to be exact and non-wildcard in production-like profiles. |
| `SDKWORK_BIRDCODER_APP_ROOT` | Read-only installed application asset root. | Never use as mutable project data. |
| `SDKWORK_OPENAPI_SNAPSHOT_PATH` | Read-only owner OpenAPI snapshot. | Must resolve inside the packaged application layout. |

The BirdCoder server and container are stateless composition hosts. They do not
own a business database, schema lifecycle, migrations, backups, project paths,
or runtime-location encryption keys. Project, composition, Session, Turn,
Session Item, and runtime-binding facts belong to `sdkwork-agents`; skill facts
belong to `sdkwork-skills`; human communication facts belong to `sdkwork-im`.
Each owning module governs its own persistence and recovery independently.

## Desktop Device State

`SDKWORK_BIRDCODER_DEVICE_STATE_FILE` is a PC/Tauri-only override for the
host-private device-state file. The store is limited to approved settings,
project-device mount identities keyed by canonical Agents `projectId`, and the
desktop runtime-location installation identity. It is not a business database
and must never enter server, container, Docker, Kubernetes, or browser runtime
configuration.

No environment variable represents a user-selected project root. Native
directory mounts, Git processes, terminals, and worktrees stay inside the
PC/Tauri boundary. Agents receives only the canonical project id and opaque
runtime location id required by its Session runtime-binding contract.

## Client API Configuration

`SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL` and its public `VITE_*` mirror
select the BirdCoder application ingress.
`SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL` and its public `VITE_*`
mirror select the platform gateway used by dependency SDKs. Packaged clients
require explicit topology materialization and must not silently fall back to
localhost.

Browser-visible values must not contain access tokens, provider credentials,
native paths, local mount identities, device-state paths, or private dependency
endpoints. Feature code consumes generated SDK clients and never assembles
transport headers from environment values.

## Safe Production Baseline

```text
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=cloud
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=container
SDKWORK_BIRDCODER_APPLICATION_PUBLIC_INGRESS_BIND=0.0.0.0:10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
```

This baseline intentionally contains no BirdCoder persistence or desktop
device-state configuration. A topology selection does not enable code
execution or grant access to a local project mount.

## Inspection Commands

```bash
pnpm test:topology-validate
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target server
pnpm topology:plan -- --deployment-profile cloud --environment production --runtime-target container
pnpm check:server
```

Topology plans consume source-controlled profiles only. Diagnostic output must
not include tokens, native paths, mount identities, or device-state values.
