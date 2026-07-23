# Monitoring And Alerting

Updated: 2026-07-22
Specs: `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `SECURITY_SPEC.md`

## Built-In Surfaces

| Surface | Authentication | Purpose |
| --- | --- | --- |
| `/healthz` | Public, no sensitive detail | Process liveness |
| `/readyz` | Public, no sensitive detail | Required runtime dependency readiness |
| `/metrics` | Deployment-policy controlled | Bounded Prometheus metrics |
| `/app/v3/api/system/*` | Authenticated | Product descriptor, route, runtime, and health detail |

## Required Alerts

| Alert | Condition | Severity |
| --- | --- | --- |
| BirdCoderIngressUnavailable | Readiness fails for the configured window | Critical |
| BirdCoderHigh5xxRate | 5xx ratio exceeds the deployment SLO | Warning |
| BirdCoderAuthFailureSpike | Protected-route 401/403 rate exceeds baseline | Warning |
| BirdCoderDatabaseUnavailable | Required database probe fails | Critical |
| BirdCoderDatabasePoolSaturated | Pool wait time or utilization exceeds budget | Warning |
| BirdCoderDependencyUnavailable | A required owner SDK/API is unavailable | Warning or critical by capability |
| BirdCoderRuntimeLocationFailures | Authorized location resolution or decryption failures exceed baseline | Critical |

Agents turn/session-item, Skills, IM delivery, and IAM authentication metrics
remain owned and named by those modules. BirdCoder dashboards may link or compose
their health summaries but must not republish them as BirdCoder-owned facts.

## Initial SLOs

| Signal | Target |
| --- | --- |
| Application ingress availability, excluding maintenance | 99.5% monthly |
| P95 protected workbench route latency | Less than 800 ms at the qualified load profile |
| Authentication refresh success | Greater than 99% |
| Workbench database mutation durability | 100% committed-or-failed atomic outcome |
| Cross-domain reference probe success | 100% for required dependencies during readiness verification |

## Dashboard Minimums

- request rate, latency, and response class by bounded route template;
- gateway liveness/readiness and deployment digest;
- database pool utilization, wait duration, errors, and migration version;
- owner dependency latency, availability, retry, and circuit state;
- runtime-location lifecycle and capability failures without plaintext paths;
- client build/version adoption and failed SDK contract decoding.

Never use tenant, organization, user, workspace, project, session, turn, message,
event, provider request, path, token, or credential values as metric labels. Put
authorized identifiers only in access-controlled, trace-correlated structured
logs, apply retention policy, and redact all secrets and target-private paths.

## Correlation

Success envelopes and Problem Detail responses expose `traceId`. Correlate it
with gateway and owner-module traces without copying provider payloads or
dependency-owned business records into BirdCoder logs.
