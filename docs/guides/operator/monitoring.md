# Monitoring and Alerting

Updated: 2026-06-24  
Specs: `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`

## Built-in endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `/health` | No | Liveness/readiness; application DB `SELECT 1`, IAM DB `SELECT 1` when configured, realtime backend |
| `/metrics` | No | Prometheus text exposition |
| `/app/v3/api/system/*` | Yes | Product health/descriptor (authenticated) |

Helm values enable ServiceMonitor scraping of `/metrics` when `serviceMonitor.enabled: true`.

## Recommended Prometheus alerts

| Alert | Condition | Severity |
| --- | --- | --- |
| BirdCoderHealthDegraded | `sdkwork_health_status != 1` for 5m | critical |
| BirdCoderHigh5xxRate | rate of 5xx / total > 1% for 10m | warning |
| BirdCoderAuth401Spike | rate of 401 on protected routes > baseline 3x | warning |
| BirdCoderDBProbeFailed | health JSON `checks.database.ok == false` | critical |
| BirdCoderIamDBProbeFailed | health JSON `checks.iam_database.ok == false` while `configured == true` | critical |
| BirdCoderRedisRealtimeDown | HA profile + redis unreachable at bootstrap | critical |

## SLO starting points

| Signal | Target |
| --- | --- |
| API availability (excluding planned maintenance) | 99.5% monthly |
| P95 protected route latency | < 800ms at 50 RPS |
| Session refresh success | > 99% (no forced re-login before refresh window) |

## Dashboards (operator-owned)

Grafana dashboards are not bundled in-repo. Import panels for:

- `sdkwork_http_requests_total` by route and status
- `sdkwork_health_status`
- PostgreSQL connection pool saturation (when HA)
- Redis pub/sub lag (when HA realtime)

## Tracing

`OTEL_SERVICE_NAME` is published through Kubernetes ConfigMap. Wire an OTLP collector sidecar or DaemonSet per platform standard; BirdCoder does not embed a collector.

## Log correlation

Problem JSON responses include required numeric `code` and `traceId`. Correlate with structured server logs and success envelopes using the same `traceId` value.
