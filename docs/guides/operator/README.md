# BirdCoder Operator Guide

Status: active  
Owner: SDKWork maintainers  
Updated: 2026-06-29  
Specs: `DEPLOYMENT_SPEC.md`, `OBSERVABILITY_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `RELEASE_SPEC.md`

This guide is the production operator entrypoint for SDKWork BirdCoder. It replaces stub placeholders and must stay aligned with `sdkwork.app.config.json` commercial readiness metadata.

## Scope

| Surface | Default profile | HA profile |
| --- | --- | --- |
| API server | Docker / Helm single replica + SQLite PVC | Helm overlay + PostgreSQL + Redis realtime |
| PC web/desktop | Remote `coding-server` API | Same API with IAM session refresh |
| Metrics | `/metrics` (Prometheus text) | ServiceMonitor scrape |
| Health | `/health` (unauthenticated) | Same, plus DB probe |

## Quick links

- [Deployment operations](deployment-operations.md)
- [Backup and restore](backup-restore.md)
- [Monitoring and alerting](monitoring.md)
- [Incident response](incident-response.md)
- [First governed release checklist](first-governed-release.md)

## Commercial readiness truth (2026-06-29)

| Lane | Status | Evidence |
| --- | --- | --- |
| OpenAPI contract | **Complete** | 153 operations implemented, 0 deferred (`specs/coding-server-openapi-rust-defer-registry.json`) |
| PC private beta | **Ready** | Session auth redirect, structured HTTP 401, proactive IAM refresh, workspace WS reconnect, Universal chat + Drive |
| Mobile chat | **API-backed** | H5 + Flutter persist through generated app SDK; Flutter Drive attachments deferred until Dart `drive-app-sdk` consumer |
| Enterprise K8s | **Pending env smoke** | PostgreSQL HA overlay + AnyPool repositories wired; requires DSN-backed smoke in target cluster |
| SaaS public cloud | **Rehearsal aligned** | `release:fixture:ready` + `release:candidate:dry-run` + `release:plan` in CI; production signing/SBOM pending first real publish |
| Mobile parity | **CI smoke aligned** | H5 typecheck/build, Capacitor sync, Android `assembleDebug`, Flutter analyze/test (`mobile-surfaces` CI job) |
| Manifest honesty | **Four surfaces gated** | Root + PC + H5 + Flutter `sdkwork.app.config.json` stay DRAFT/preLaunch with disabled install packages (`surface-manifest-parity-contract`) |

## Mandatory verification before production cutover

```bash
pnpm lint
pnpm check:server
pnpm check:arch
pnpm server:build
pnpm release:smoke:server
```

When PostgreSQL is the production engine:

```bash
pnpm release:smoke:postgresql-live
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  -f deployments/kubernetes/values-postgresql-ha.yaml
```

Mobile native host verification (after H5 build):

```bash
pnpm h5:build
pnpm cap:sync
pnpm cap:android:assemble
```

## Support escalation

1. Collect `/health`, `/metrics`, and application logs from the failing pod or host.
2. Run rollback using the release manifest `rollbackRunbookRef` when error budget is exhausted.
3. File an incident record with request IDs from Problem JSON responses.
