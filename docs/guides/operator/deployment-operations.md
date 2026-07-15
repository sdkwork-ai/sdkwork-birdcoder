# Deployment Operations

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`

This guide covers the BirdCoder control plane. It does not describe a remote
arbitrary-code runner because the current server deliberately reports remote
execution as unavailable. Configure and operate the control plane as metadata,
authorization, API, and server-owned workspace infrastructure only.

## Deployment Matrix

| Deployment | Runtime target | Data baseline | Code execution |
| --- | --- | --- | --- |
| Windows local IDE | `standalone` + `desktop` | User-private desktop storage and the selected device folder | Local host only. |
| Private Windows/Linux server | `standalone` + `server` | Server-controlled database and workspace base | Unavailable remotely. |
| Container/Kubernetes control plane | `cloud` + `container` or `server` | PostgreSQL, protected database URL, explicit origins | Unavailable until an isolated runner is delivered. |

`SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` is the server-owned base for project
source/Git workspace storage. It is never a client mount, a client API value,
or a permission to start provider processes.

## Required Server Configuration

Set these values through an operator-managed environment/configuration source:

```dotenv
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=server
SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
SDKWORK_BIRDCODER_SERVER_PORT=10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
# Inject SDKWORK_BIRDCODER_DATABASE_URL from a protected secret source.
SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=<server-private-project-workspace-root>
```

For `cloud`, use `SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=cloud`, PostgreSQL, a
non-loopback bind, and explicit non-wildcard origins. Startup validation rejects
an invalid cloud profile instead of falling back to SQLite or wildcard CORS.
Never put credentials, user paths, browser handles, or a server workspace root
in public `VITE_*` configuration.

## Server Workspace Isolation

The workspace base is mutable server state and must be owned by the BirdCoder
service identity. It is not shared with a user's desktop data directory.

- Derive each project/worktree path from authenticated tenant, organization,
  user/membership, workspace, and opaque server identifiers.
- Do not create paths from request-supplied client paths, project display names,
  or a process current directory.
- Restrict write access to the BirdCoder service account and documented backup
  operators. Keep application binaries and configuration in separate
  read-only/operator-managed locations.
- Do not expose workspace roots, mount paths, provider state, or credentials in
  API responses, browser bundles, traces, or logs.
- Test cross-tenant, cross-organization, and cross-user denial before enabling
  any server-owned file operation.

See the [Windows Server control-plane guide](windows-server-control-plane.md)
for the Windows directory and ACL model.

## Health And API Checks

Infrastructure endpoints are unauthenticated; product endpoints still require
the configured IAM credential flow.

```bash
curl -fsS http://127.0.0.1:10240/healthz
curl -fsS http://127.0.0.1:10240/readyz
curl -fsS http://127.0.0.1:10240/metrics
curl -fsS http://127.0.0.1:10240/openapi.json
```

Container examples commonly publish port `18989`; use the port configured for
the deployed service rather than assuming the native development default.

## Docker And Kubernetes

For the Docker control-plane profile, supply protected database configuration
outside the tracked template and start the stack with the documented compose
file:

```bash
docker compose -f deployments/docker/docker-compose.yml up -d
```

The Kubernetes chart defaults to a cloud control-plane posture with PostgreSQL
configuration and a project workspace base. Do not enable scaling based on a
SQLite volume. Before a production rollout, use a pinned image digest, an
operator-provisioned secret, explicit origins, and the PostgreSQL live smoke:

```bash
pnpm.cmd release:smoke:postgresql-live
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  -f deployments/kubernetes/values-postgresql-ha.yaml
```

The chart's `runtime.projectWorkspaceRoot` is a server source/Git storage
location. It is not an encrypted runner volume and must not be described as
one.

## Upgrade, Rollback, And Capability Changes

1. Verify the target profile, runtime target, database, origins, and workspace
   base before rollout.
2. Back up authoritative server data according to the deployed database and
   storage policy. Do not treat a client mount registry as server backup data.
3. Deploy one version at a time, run `/readyz`, then run the profile-specific
   API and authorization smoke checks.
4. If a rollout fails, use the release manifest's rollback reference and
   restore the previous compatible server artifact/configuration pair.
5. Treat a request to enable remote terminal, filesystem, run, or deployment
   capability as a new release gate. Do not turn it on through a storage-root
   environment variable alone.

## Verification

```bash
pnpm.cmd check:server
pnpm.cmd check:multi-mode
pnpm.cmd release:smoke:server
pnpm.cmd docs:build
```
