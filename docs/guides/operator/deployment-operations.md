# Deployment Operations

Updated: 2026-06-24

## Docker (single node)

```bash
docker compose -f deployments/docker/docker-compose.yml up -d
curl -fsS http://127.0.0.1:18989/healthz
curl -fsS http://127.0.0.1:18989/readyz
curl -fsS http://127.0.0.1:18989/openapi.json | head
curl -fsS http://127.0.0.1:18989/metrics | head
```

Infrastructure liveness, readiness, OpenAPI, and metrics are intentionally unauthenticated. Protected product APIs require IAM dual-token headers.

## Kubernetes (default SQLite)

```bash
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml
```

Defaults:

- `replicaCount: 1`
- `database.engine: sqlite`
- `autoscaling.enabled: false`
- PVC at `/var/lib/sdkwork-birdcoder/data.sqlite3`

Do not scale replicas above 1 while SQLite remains the engine.

## Kubernetes (PostgreSQL HA)

1. Provision external PostgreSQL 16+ and Redis 7+.
2. Apply baseline from `database/ddl/baseline/postgres/`.
3. Deploy with HA overlay:

```bash
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  -f deployments/kubernetes/values-postgresql-ha.yaml \
  --set database.url='postgres://birdcoder:SECRET@postgresql:5432/birdcoder'
```

4. Run `pnpm release:smoke:postgresql-live` against the same DSN before enabling autoscaling.
5. Enable `backup.enabled: true` only after PostgreSQL is verified (see [backup-restore.md](backup-restore.md)).

## Runtime environment (ConfigMap)

| Variable | Purpose |
| --- | --- |
| `SDKWORK_BIRDCODER_DATABASE_ENGINE` | `sqlite` or `postgresql` |
| `SDKWORK_BIRDCODER_REALTIME_BACKEND` | `memory` (single node) or `redis` (HA) |
| `SDKWORK_DEPLOYMENT_PROFILE` | `standalone` or `cloud` |
| `OTEL_SERVICE_NAME` | Trace service name (collector wiring is operator-owned) |

## OpenAPI contract surface

- Live snapshot: `GET /openapi.json` (unauthenticated)
- Canonical export artifact: `artifacts/openapi/coding-server-v1.json`
- Route catalog count: **162 entries** (product routers + federated `sdkwork-iam` app/backend routers + commerce gateway routes + commerce transactions + chat routes + workspace realtime WebSocket in standalone-gateway)
- Defer registry: `specs/coding-server-openapi-rust-defer-registry.json` — **HTTP OpenAPI 161 of 161 implemented**, **0 deferred**; workspace realtime remains route-catalog-only WebSocket and is intentionally excluded from HTTP OpenAPI

## Session/auth operations note

PC clients redirect expired sessions to `/#/auth/login?redirect=...` and refresh tokens through `auth.sessions.refresh` before expiry. Operators must keep IAM app API reachable from client `apiBaseUrl` and allow CORS origins configured in `BIRDCODER_ALLOWED_ORIGINS`.
