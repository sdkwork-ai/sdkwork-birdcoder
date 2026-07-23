# Deployment Profiles And Runtime Targets

BirdCoder keeps one coding-workbench contract across browser, desktop, native
service, container, and mobile delivery. Deployment topology changes where an
authority is hosted; it never changes which project owns the authority.

## Orthogonal Selectors

`deploymentProfile` selects the deployment boundary and has exactly two
values. `runtimeTarget` selects the process or client shape. Neither value is
derived from the other.

| Deployment profile | Responsibility |
| --- | --- |
| `standalone` | Uses the application standalone ingress and operator-selected dependency endpoints. |
| `cloud` | Uses explicitly configured cloud application and platform endpoints. |

| Runtime target | Process shape |
| --- | --- |
| `browser` | Browser renderer for the PC or H5 client architecture. |
| `desktop` | Packaged Tauri desktop host and renderer. |
| `server` | Native BirdCoder application service host. |
| `container` | Containerized BirdCoder application service host. |
| `test-runner` | Controlled browser test host. |
| `capacitor-ios`, `capacitor-android` | Capacitor mobile hosts. |

The selected pair is materialized from
`<deploymentProfile>.<environment>` by `specs/topology.spec.json`. Individual
combinations do not define another deployment vocabulary.

```bash
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
pnpm topology:plan -- --deployment-profile cloud --environment development --runtime-target browser
```

The topology planner composes only the processes declared for the selected
pair. BirdCoder does not embed or copy Agents, Skills, IM, IAM, Drive, or other
dependency-domain databases and APIs. Those capabilities are consumed through
their canonical SDK clients and configured service endpoints.

## API Stability

Every topology selection exposes the same BirdCoder App API contract with 39
operations. The owned prefixes are:

- `/app/v3/api/workspaces`
- `/app/v3/api/projects`
- `/app/v3/api/system/descriptor`
- `/app/v3/api/system/health`
- `/app/v3/api/system/routes`
- `/app/v3/api/system/runtime`

Authentication, Agents sessions, Skills, IM, Membership, Drive, Deployments,
commerce, and other dependency APIs are not BirdCoder routes. Each injected
SDK client resolves its own canonical endpoint from runtime configuration.

## Project Runtime Locations

A Project is shared workbench identity. A Project Runtime Location records one
target-specific root, health state, capability set, and Git snapshot for that
Project. It is not a global path and does not grant execution by itself.

- Browser folder handles remain browser-private capabilities and never become
  operating-system paths.
- Tauri native bindings remain host-private, scoped to the current IAM subject
  and project.
- Server, container, and managed execution targets require a verified target
  resolver and explicit `runtimeLocationId`.
- Terminal, Git, build, and filesystem actions resolve an exact runtime
  location before execution; they never infer authority from process CWD.
- Agents Sessions refer to stable Project and Runtime Binding identifiers. The
  canonical session and execution lifecycle remains in `sdkwork-agents`.

`BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` is a development bootstrap option. It
does not create an implicit Project record, remote runtime location, or
execution grant.
