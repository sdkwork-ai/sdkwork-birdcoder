# Deployment Profiles And Runtime Targets

`deploymentProfile` and `runtimeTarget` are independent selectors declared
by `specs/topology.spec.json`.

| Deployment profile | Meaning |
| --- | --- |
| `standalone` | Application ingress plus explicitly selected dependency endpoints |
| `cloud` | Explicit cloud application and platform endpoints |

| Runtime target | Current role |
| --- | --- |
| `browser` | PC browser renderer |
| `desktop` | PC Tauri renderer and native host |
| `server` | Native stateless Rust gateway |
| `container` | Containerized stateless Rust gateway |
| `test-runner` | Controlled PC browser test host |

## Stable Contract

Every target uses the same four-operation BirdCoder App API. Project,
composition, Session, Skill, IM, IAM, Drive, and Documents clients resolve
their owner endpoints from the platform plane or explicit owner overrides.

Desktop adds local device capabilities; it does not add a BirdCoder server data
plane. Server and container targets do not gain access to PC mounts, native
paths, Git processes, or terminals.

## Planning

```bash
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target server
pnpm topology:plan -- --deployment-profile cloud --environment production --runtime-target container
```

A valid topology is connectivity configuration, not an execution grant.
