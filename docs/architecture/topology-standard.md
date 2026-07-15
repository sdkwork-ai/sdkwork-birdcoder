# BirdCoder Runtime Topology

This document narrows the SDKWork runtime topology standard for BirdCoder. The
machine-readable authority is
[`specs/topology.spec.json`](../../specs/topology.spec.json); the global
authorities are `APP_RUNTIME_TOPOLOGY_SPEC.md`, `CONFIG_SPEC.md`, and
`DEPLOYMENT_SPEC.md`. When they disagree, the machine contract and global specs
take precedence.

## Deployment Profiles And Targets

BirdCoder supports exactly two deployment profiles: `standalone` and `cloud`.
Runtime targets such as `browser`, `desktop`, `server`, and `container` are
host choices, not extra profiles.

| Profile + target | Primary use | Project/mount behavior | Runtime behavior |
| --- | --- | --- | --- |
| `standalone` + `desktop` | Windows local IDE | Remote project metadata can coexist with a device-private Tauri mount. | Selected local folder may be used only by the local host. |
| `standalone` + `browser` + `server` | Private server with web client | Browser mount stays in IndexedDB on the browser; server stores only remote metadata and server-derived roots. | Remote execution is unavailable. |
| `standalone` + `desktop` + `server` | Tauri client against private server | Tauri mount stays in host-private local storage; server sees only project ids and authorized requests. | Remote execution is unavailable. |
| `cloud` + `server` or `container` | Cloud control plane | Projects are scoped server metadata; any future server root is derived from authenticated scope. | Cloud runner is not enabled in the current implementation. |

Development defaults and checked-in templates use the canonical
`<deploymentProfile>.<environment>.env` form under `configs/topology/`.

## Project And Storage Boundary

`Project`, `ProjectDeviceMount`, and `ProjectWorkspaceRoot` are separate
objects. A project may cross the app SDK boundary. A mount may not. A server
workspace root may not. This stays true in every profile:

```text
remote Project id + IAM scope
  -> server authorization and metadata

project id + active device IAM scope + realm
  -> Browser handle or Tauri host-local path

server trusted IAM/workspace/project identifiers
  -> server-private workspace root
```

`SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` names the server-owned base for the
last line. It never permits a browser/Tauri folder to become a server root and
does not change the remote execution capability.

## Ingress Ownership

`application.public-ingress` is the BirdCoder-owned public entrypoint for
BirdCoder application APIs. The platform API gateway remains a separate
SDKWork-owned entrypoint for shared platform APIs such as IAM. Client bootstrap
keeps the application app-SDK base URL and platform/IAM configuration explicit;
it does not infer one from the other.

Cloud server validation requires PostgreSQL, an explicit non-wildcard CORS
allowlist, and a non-loopback bind. A Windows or private standalone server must
use the same path-free project contract and server-derived storage rule.

## Execution Capability

The `local-host` and future remote-runner choices are session capabilities,
not topology names. Current remote `server`, `container`, and `cloud` profiles
must return typed unavailable outcomes for code execution rather than falling
back to a process cwd or shared storage. A production remote runner requires a
separate accepted architecture decision and isolation evidence.

## Verification

```bash
pnpm.cmd check:topology-standard
pnpm.cmd check:server
pnpm.cmd check:multi-mode
```
