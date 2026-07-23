# Deployment Operations

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: DEPLOYMENT_SPEC.md, CONFIG_SPEC.md, SOURCE_CONFIG_SPEC.md, SECURITY_SPEC.md, OBSERVABILITY_SPEC.md

This guide covers the stateless BirdCoder gateway. BirdCoder owns the coding
workbench composition and four System App API operations; it does not own
Project, Session, Skill, human-message, or persistence lifecycles.

## Deployment Matrix

| Deployment profile | Runtime target | BirdCoder mutable state | Local code capability |
| --- | --- | --- | --- |
| `standalone` | `desktop` | PC/Tauri device state only. | Local host adapters after native root validation. |
| `standalone` | `server` | None. | None. |
| `cloud` | `container` or `server` | None. | None. |

Deployment profile and runtime target are orthogonal. Resolve the selected plan
against `specs/topology.spec.json` before rollout. The server never receives a
local project root, mount record, Git working tree, or terminal handle.

## Required Server Configuration

```text
SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE=cloud
SDKWORK_BIRDCODER_ENVIRONMENT=production
SDKWORK_BIRDCODER_RUNTIME_TARGET=container
SDKWORK_BIRDCODER_SERVER_HOST=0.0.0.0
SDKWORK_BIRDCODER_SERVER_PORT=10240
SDKWORK_BIRDCODER_ALLOWED_ORIGINS=https://ide.example.invalid
```

Use an operator-managed source for private dependency credentials. Do not add
BirdCoder database, migration, backup, runtime-location keyring, or desktop
device-state settings. The owning dependency module governs any state it needs;
BirdCoder does not mirror or configure that state.

## Health And API Checks

Infrastructure endpoints are unauthenticated; product endpoints require the
configured IAM credential flow.

```bash
curl -fsS http://127.0.0.1:10240/healthz
curl -fsS http://127.0.0.1:10240/readyz
curl -fsS http://127.0.0.1:10240/metrics
curl -fsS http://127.0.0.1:10240/openapi.json
```

Container examples may publish a different port. Use the materialized service
configuration instead of assuming a development default.

## Docker And Kubernetes

The Docker image is read-only and declares no persistent volume:

```bash
docker compose -f deployments/docker/docker-compose.yml up -d
```

The Helm baseline deploys one stateless gateway. Use the HA overlay for
replicas, autoscaling, Redis-backed realtime, disruption control, and production
OpenTelemetry settings:

```bash
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  -f deployments/kubernetes/values-ha.yaml \
  --set image.digest='sha256:<immutable-image-digest>'
```

The chart contains no persistence volume, database Secret, migration job, or
backup job. It also does not enroll an execution target or expose a PC mount.

## Upgrade And Rollback

1. Verify the deployment profile, runtime target, image digest, listener,
   origins, dependency connectivity, and observability endpoint.
2. Deploy one immutable version at a time and run health, owner OpenAPI,
   authorization, and stateless deployment checks.
3. If rollout fails, restore the previous image digest and its compatible
   runtime configuration. There is no BirdCoder data restore or schema replay.
4. Coordinate persistence migrations and recovery only with the owning Agents,
   Skills, IAM, or IM release process.
5. Treat local terminal, filesystem, Git, run, build, and deployment capability
   changes as separate PC/Tauri release gates.

## Verification

```bash
pnpm test:topology-validate
node scripts/server-observability-contract.test.mjs
pnpm check:server
pnpm check:release-flow
pnpm release:smoke:server
pnpm docs:build
```
