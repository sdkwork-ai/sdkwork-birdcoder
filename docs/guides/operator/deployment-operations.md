# Deployment Operations

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-22
Specs: DEPLOYMENT_SPEC.md, CONFIG_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, OBSERVABILITY_SPEC.md

This guide covers the BirdCoder control plane and its ProjectRuntimeLocation
authority. A persisted location is controlled metadata, not an execution
grant.

## Deployment Matrix

| Deployment profile | Runtime target | Data baseline | Code execution |
| --- | --- | --- | --- |
| `standalone` | `desktop` | User-private native binding plus encrypted runtime-location metadata. | Desktop host only after native root validation. |
| `standalone` | `server` | Server-controlled database and protected runtime-location data. | Disabled until a separately verified execution target and capability are available. |
| `cloud` | `container` or `server` | PostgreSQL, protected database URL, runtime-location encryption material, and exact origins. | Disabled until an isolated execution target is delivered and enrolled. |

Deployment profile and runtime target are orthogonal. Operators select the
pair through `sdkwork-app` and verify the resolved plan against
`specs/topology.spec.json` before rollout.

## Required Server Configuration

Set configuration through an operator-managed source:

    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
    SDKWORK_BIRDCODER_ENVIRONMENT=production
    SDKWORK_BIRDCODER_RUNTIME_TARGET=server
    SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
    SDKWORK_BIRDCODER_SERVER_PORT=10240
    SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
    SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql

Inject the database URL and these runtime-location secrets only through the
approved server-side secret source:

- `SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY`: base64url or raw material
  that decodes or measures to at least 32 bytes.
- `SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID`: non-empty safe identifier for
  the active encryption key.
- `SDKWORK_BIRDCODER_RUNTIME_LOCATION_PREVIOUS_KEYS_JSON`: optional JSON
  object of at most 15 historical key-id to key-material entries used only for
  decrypting existing records.
- `SDKWORK_BIRDCODER_RUNTIME_LOCATION_FINGERPRINT_KEY`: stable fingerprint
  secret required during rotation and preserved across all encryption keys.

Do not put any of these values in a tracked environment file, public `VITE_*`
configuration, client runtime config, a Helm values file, a container image,
a log, a diagnostic report, shell history, or a command line. Missing or
invalid material is fail-closed: runtime-location persistence and operations
must not initialize with generated, plaintext, or fallback key material.

## Runtime-Location Isolation

Runtime-location records are tenant/project/target-scoped. They persist an
encrypted absolute path, but no ordinary app API response or operator
diagnostic returns that plaintext.

- Register paths only through the typed authenticated registration flow or a
  trusted target channel.
- The server never selects a filesystem root from raw request data. The owning
  target resolves its own locationId internally, verifies scope/capability/
  health, decrypts only inside its protected resolver, and canonicalizes before
  use.
- Treat path rebind, verification, preference change, target registration, and
  capability changes as auditable security-sensitive actions.
- Restrict workspace roots and target credentials to the appropriate service
  identity. Keep application binaries and configuration in separate
  read-only/operator-managed locations.
- Do not expose plaintext roots, path ciphertext, key identifiers, execution
  target state, or credentials in API responses, browser bundles, traces,
  logs, or metric labels.
- Test cross-tenant, cross-organization, cross-user, cross-project, and
  cross-target denial before enabling any server-owned operation.

## Health And API Checks

Infrastructure endpoints are unauthenticated; product endpoints require the
configured IAM credential flow.

    curl -fsS http://127.0.0.1:10240/healthz
    curl -fsS http://127.0.0.1:10240/readyz
    curl -fsS http://127.0.0.1:10240/metrics
    curl -fsS http://127.0.0.1:10240/openapi.json

Container examples may publish a different port. Use the deployed service
configuration rather than assuming the native development default.

## Docker And Kubernetes

For Docker, supply protected database configuration plus the runtime-location
master key and key id outside the tracked template, then start the documented
compose file:

    docker compose -f deployments/docker/docker-compose.yml up -d

The Kubernetes chart defaults to a cloud control-plane posture. Before a
production rollout, use a pinned image digest, operator-provisioned secrets,
explicit origins, PostgreSQL live smoke, and the project runtime-location
key-management procedure. Do not put either runtime-location secret in
values.yaml or a ConfigMap.

    helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
      -f deployments/kubernetes/values.yaml \
      -f deployments/kubernetes/values-postgresql-ha.yaml

The chart deploys the BirdCoder control plane. It does not enroll an execution
target, expose a user desktop mount, or enable remote execution.

## Upgrade, Rollback, And Capability Changes

1. Verify deployment profile, runtime target, database, origins, and
   secret/key availability before rollout.
2. Back up authoritative database records, lifecycle/audit state, and
   documented key-management references. Do not treat a Browser handle or
   Tauri local binding as server backup data.
3. Deploy one version at a time, run readiness, then run API, authorization,
   migration, and target-isolation smoke checks.
4. If rollout fails, use the release manifest rollback reference and restore
   the previous compatible artifact/configuration pair. Re-verify affected
   runtime locations before re-enabling a capability.
5. Treat remote terminal, filesystem, run, build, and deployment enablement as
   separate release gates. A stored path alone cannot enable any of them.

## Verification

    pnpm db:validate
    pnpm test:migration-replay
    pnpm topology:validate
    pnpm topology:plan -- --deployment-profile cloud --environment production --runtime-target server
    pnpm check:desktop
    pnpm check:server
    pnpm check:release-flow
    pnpm release:smoke:server
    pnpm docs:build
