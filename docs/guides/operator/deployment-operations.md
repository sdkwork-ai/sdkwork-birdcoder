# Deployment Operations

Status: active
Owner: SDKWork maintainers
Updated: 2026-08-03
Specs: DEPLOYMENT_SPEC.md, SDKWORK_DEPLOY_SPEC.md, CONFIG_SPEC.md, SOURCE_CONFIG_SPEC.md, SECURITY_SPEC.md, OBSERVABILITY_SPEC.md

This guide covers the stateless BirdCoder gateway. BirdCoder owns the coding
workbench composition and four System App API operations; it does not own
Project, Session, Skill, human-message, or persistence lifecycles.

## SDKWork Deploy Integration

The gateway composes the SDKWork Deploy App API (`sdkwork-deployments`
api-assembly) directly: `deploy_*` PostgreSQL tables are migrated at gateway
startup, and the Deploy routes
(`/app/v3/api/domain_zones`, `sites`, `certificates`, `upload_sessions`,
`artifacts`) serve under the same web framework as every other owner. The
publish pipeline (site/artifact/release records) and the Drive upload port run
in-process, so no separate Deploy Server instance is needed. Development
profiles use the in-memory Drive/content-provider ports; production-like
profiles route Drive through the gateway's own Drive API facade
(`SDKWORK_DRIVE_FACADE_URL`) with the remaining runtime values injected by the
deployment platform (`etc/README.md`).

Release publication runs through the `@sdkwork/deployments-app-sdk` application
publisher (`pnpm release:publish`, see `first-governed-release.md`); deployment
plans/rollouts run through the SDKWork Deploy framework:

```bash
pnpm deploy:validate                 # manifest V1–V20
pnpm deploy:plan:standalone|cloud    # read-only plans per profile
pnpm check:deploy-standard           # manifest + etc/ source-config identity
```

### Upload storage requirement

The publish pipeline uploads the release archive through the Drive App API
(multipart presigned parts). Drive's `local_filesystem` storage provider does
not support presigned uploads, so a complete local end-to-end publish requires
an S3-compatible object store bound to the active Drive storage provider for
the target bucket (see `sdkwork-drive/deployments/docker-compose.minio-test.yml`
for a MinIO reference). `pnpm release:publish:dry-run` validates the whole
request without the upload step.

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

Production-like profiles additionally require the SDKWork Deploy module runtime
values (`SDKWORK_DEPLOY_ENVIRONMENT`, `SDKWORK_DRIVE_FACADE_URL`, and the
platform-injected ingress/web-runtime secrets). The gateway fails closed at
startup when a production-like Deploy profile is under-configured.

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
