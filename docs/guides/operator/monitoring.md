# Monitoring and Alerting

Updated: 2026-07-16
Specs: `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`

## Built-in endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `/healthz` | No | Process liveness |
| `/readyz` | No | Database, IAM, and configured realtime backend readiness |
| `/metrics` | No | Prometheus text exposition |
| `/app/v3/api/system/*` | Yes | Authenticated product health and descriptor |

Helm values enable ServiceMonitor scraping of `/metrics` when `serviceMonitor.enabled: true`.

## Recommended alerts

| Alert | Condition | Severity |
| --- | --- | --- |
| BirdCoderHealthDegraded | `sdkwork_health_status != 1` for 5m | critical |
| BirdCoderHigh5xxRate | 5xx / total > 1% for 10m | warning |
| BirdCoderAuth401Spike | protected-route 401 rate > baseline 3x | warning |
| BirdCoderDBProbeFailed | `/readyz` fails for a database-backed profile | critical |
| BirdCoderRedisRealtimeDown | HA profile cannot reach Redis | critical |
| BirdCoderRealtimePublishFailures | durable commits followed by hub publish failures for 5m | warning |
| BirdCoderRealtimeReplayFailures | replay scope, cursor, or store failures for 5m | critical |
| BirdCoderRealtimeLagRecoverySpike | lag/gap recoveries exceed baseline 3x | warning |
| BirdCoderRealtimeReconnectExhausted | clients exhaust the reconnect budget | warning |

## SLO starting points

| Signal | Target |
| --- | --- |
| API availability, excluding maintenance | 99.5% monthly |
| P95 protected route latency | < 800ms at 50 RPS |
| Session refresh success | > 99% |
| Durable chat event recovery | 100% ordered replay with no missing sequence |
| Realtime fan-out delivery | > 99.9%; replay covers committed misses |

## Dashboards

Grafana dashboards are operator-owned. Include panels for:

- `sdkwork_http_requests_total` by route and status
- `sdkwork_health_status`
- PostgreSQL pool saturation
- Redis connection and pub/sub health
- `birdcoder_realtime_active_connections{transport="sse|websocket"}`
- `birdcoder_realtime_publish_failures_total`
- `birdcoder_realtime_replay_requests_total`, `birdcoder_realtime_replay_events_total`, and
  `birdcoder_realtime_replay_failures_total`
- `birdcoder_realtime_lag_recoveries_total` and
  `birdcoder_realtime_sequence_gap_recoveries_total`
- client reconnect attempts, transport fallback, and retry exhaustion

Never label metrics by tenant, user, workspace, coding session, turn, event UUID, or provider
request ID. Put those values in trace-correlated structured logs; metric labels must remain
bounded to deployment profile, transport, outcome, and error class.

## Tracing and log correlation

`OTEL_SERVICE_NAME` is published through the Kubernetes ConfigMap. Wire an OTLP collector per
platform standard. Problem JSON and success envelopes include `traceId`; correlate it with
structured server logs. Realtime warnings include the bounded error class and cursor context,
while sensitive provider payloads and credentials must never be logged.
