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
| `application.public-ingress` | Four BirdCoder System operations |
| `platform.api-gateway` | Default endpoint for generated dependency SDKs |
| Owner-specific override | Explicit endpoint for one dependency SDK |

Dependency clients never fall back silently to the BirdCoder application
ingress. Browser development may use the declared same-origin platform proxy;
desktop and release builds require explicit materialized endpoints.

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
