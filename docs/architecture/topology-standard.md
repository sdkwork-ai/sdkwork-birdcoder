# BirdCoder Runtime Topology

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: APP_RUNTIME_TOPOLOGY_SPEC.md, CONFIG_SPEC.md, DEPLOYMENT_SPEC.md

`specs/topology.spec.json` is the machine authority. BirdCoder supports
`standalone` and `cloud` deployment profiles; browser, desktop, server,
container, and test-runner are runtime targets rather than additional
profiles.

## Connectivity Planes

| Plane | Purpose |
| --- | --- |
| `application.public-ingress` | BirdCoder APIs and all selected owner assembly contributions in `standalone` |
| `platform.api-gateway` | Explicit remote dependency surface for `cloud` only |
| Owner-specific override | Explicit cloud endpoint for one dependency SDK |

The standalone gateway is the only application-plane HTTP listener and mounts
dependency-owned executable contributions before binding. It does not forward
dependency requests to another loopback gateway. Browser development proxies
canonical API paths only to `application.public-ingress`. Cloud clients keep
application and platform URLs explicit and never start a local platform host.

## Runtime Matrix

| Profile and target | BirdCoder persistence | Local capability |
| --- | --- | --- |
| `standalone + desktop` | Tauri device state only | Authorized local mount, filesystem, Git, worktree, terminal |
| `standalone + browser` | Browser-local capability handles only | Browser file capability; no native path |
| `standalone + server` | None | Stateless gateway; no project directory |
| `cloud + server/container` | None | Stateless gateway; no remote runner |

Project and Session facts remain in Agents for every topology. Selecting a
profile or target does not create a database, Project authority, runtime
target, or execution grant.

## Local And Remote Execution

The desktop host resolves a subject-scoped `ProjectDeviceMountRegistry`
record by canonical Agents `projectId`. The Agents Session may hold an opaque
runtime location id through `sessionRuntimeBindings`; neither record exposes a
native path to the BirdCoder server.

Remote execution, target enrollment, scheduling, source synchronization, and
provider isolation remain with Agents, Kernel, and provider infrastructure.
The BirdCoder gateway does not emulate those capabilities.

## Verification

```bash
pnpm check:topology-standard
pnpm check:desktop
pnpm check:server
pnpm check:multi-mode
```
