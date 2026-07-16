# BirdCoder Runtime Topology

This document narrows the SDKWork runtime topology standard for BirdCoder. The
machine-readable authority is specs/topology.spec.json; the global authorities
are APP_RUNTIME_TOPOLOGY_SPEC.md, CONFIG_SPEC.md, and DEPLOYMENT_SPEC.md.
When they disagree, the machine contract and global specs take precedence.

## Deployment Profiles And Targets

BirdCoder supports exactly two deployment profiles: standalone and cloud.
Runtime targets such as browser, desktop, server, and container are host
choices, not extra profiles.

| Profile + target | Primary use | Project location behavior | Runtime behavior |
| --- | --- | --- | --- |
| standalone + desktop | Windows local IDE | A Tauri desktop location is registered for an imported root and materialized as a current-device binding. | Local actions use the device binding after canonical-root validation. |
| standalone + browser + server | Private server with web client | Browser handles remain local; server locations belong to trusted server targets and persist protected root data. | Browser does not create an OS path or execution grant. |
| standalone + desktop + server | Tauri client against private server | Desktop and server can hold different locations for the same project. | Each action resolves an explicit location and target; no cross-target path reuse. |
| cloud + server or container | Cloud control plane | Locations are tenant-scoped records associated with registered server or future runner targets. | Remote execution remains unavailable until runner promotion. |

Development defaults and checked-in templates use the canonical
deploymentProfile.environment form under configs/topology.

## Project And Location Boundary

Project, ProjectRuntimeLocation, local host binding, and runtime target are
separate objects:

    remote Project identity + IAM scope
      -> server authorization and generic metadata

    ProjectRuntimeLocation + runtime target identity
      -> encrypted absolute path, capability, health, and verified Git snapshot

    project + active device IAM scope + location semantics
      -> Browser directory handle or Tauri native local binding

    project + runtimeLocationId + authenticated target
      -> internal canonical root for one verified action

ProjectRuntimeLocation is the distributed source of truth for target-specific
root information. Generic Project API data stays path-free. The public app API
accepts a path only as a typed write-only registration input and never returns
plaintext paths in list or detail responses.

Browser handles are capability objects, not paths. A Tauri local binding is
needed for local host execution but does not replace the server record. A
server/container target must authenticate and validate ownership before it
decrypts or uses its registered location path.

SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT is a server-owned base for controlled
workspace provisioning. It does not convert a browser or Tauri folder into a
server root and does not enable remote execution by itself.

## Ingress Ownership

application.public-ingress is the BirdCoder-owned public entrypoint for
BirdCoder application APIs. The platform API gateway remains a separate
SDKWork-owned entrypoint for shared platform APIs such as IAM. Client bootstrap
keeps the application app-SDK base URL and platform/IAM configuration explicit.

## Execution Capability

Runtime locations describe candidate targets; they do not authorize execution
on their own. Terminal, Git (including worktree), build, and file-system
actions require project/target/capability/health validation and a canonical
root resolved by the owning target. Worktree uses the Git capability rather
than a separate preference. Current remote server, container, and cloud
profiles return typed unavailable outcomes for code execution until
isolated-runner evidence exists.

## Verification

    pnpm check:topology-standard
    pnpm check:server
    pnpm check:multi-mode
    pnpm db:validate
    node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
