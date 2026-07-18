# Deployment Operations

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: DEPLOYMENT_SPEC.md, CONFIG_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, OBSERVABILITY_SPEC.md

This guide covers the BirdCoder control plane and its ProjectRuntimeLocation
authority. It does not describe an arbitrary remote-code runner: a persisted
location is controlled metadata, not an execution grant.

## Deployment Matrix

| Deployment | Runtime target | Data baseline | Code execution |
| --- | --- | --- | --- |
| Windows local IDE | standalone + desktop | User-private local binding plus encrypted server runtime-location metadata | Local host only after native root validation. |
| Private Windows/Linux server | standalone + server | Server-controlled database, protected location data, and managed workspace base | Remote code execution unavailable until target/runner evidence exists. |
| Container/Kubernetes control plane | cloud + container or server | PostgreSQL, protected database URL, runtime-location encryption material, explicit origins | Unavailable until an isolated runner is delivered. |

SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT is a server-owned base for controlled
workspace provisioning. It is never a client mount, a public configuration
value, a generic project path, or permission to start provider processes.

## Required Server Configuration

Set configuration through an operator-managed source:

    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=standalone
    SDKWORK_BIRDCODER_ENVIRONMENT=production
    SDKWORK_BIRDCODER_RUNTIME_TARGET=server
    SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
    SDKWORK_BIRDCODER_SERVER_PORT=10240
    SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
    SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql
    SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT=<server-private-project-workspace-root>

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
- Do not expose plaintext roots, path ciphertext, key identifiers, provider
  state, or credentials in API responses, browser bundles, traces, logs, or
  metric labels.
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

    pnpm release:smoke:postgresql-live
    helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
      -f deployments/kubernetes/values.yaml \
      -f deployments/kubernetes/values-postgresql-ha.yaml

The chart workspace base is server source/Git storage. It is not an encrypted
runner volume, a user desktop mount, or a remote-execution switch.

## Upgrade, Rollback, And Capability Changes

1. Verify target profile, runtime target, database, origins, workspace base,
   and secret/key availability before rollout.
2. Back up authoritative database records, lifecycle/audit state, and
   documented key-management references. Do not treat a Browser handle or
   Tauri local binding as server backup data.
3. Deploy one version at a time, run readiness, then run API, authorization,
   migration, and target-isolation smoke checks.
4. If rollout fails, use the release manifest rollback reference and restore
   the previous compatible artifact/configuration pair. Re-verify affected
   runtime locations before re-enabling a capability.
5. Treat remote terminal, filesystem, run, build, and deployment enablement as
   separate release gates. A stored path or configured workspace base alone
   cannot enable any of them.

## Verification

    pnpm db:validate
    pnpm test:migration-replay
    pnpm check:server
    pnpm check:multi-mode
    pnpm release:smoke:server
    pnpm docs:build
