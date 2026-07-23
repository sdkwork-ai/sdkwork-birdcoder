# Monitoring And Alerting

Updated: 2026-07-23
Specs: `OBSERVABILITY_SPEC.md`, `PERFORMANCE_SPEC.md`, `SECURITY_SPEC.md`

## Built-In Surfaces

| Surface | Authentication | Purpose |
| --- | --- | --- |
| `/healthz` | Public, no sensitive detail | Process liveness |
| `/readyz` | Public, no sensitive detail | Required dependency readiness |
| `/metrics` | Deployment-policy controlled | Bounded Prometheus metrics |
| `/app/v3/api/system/*` | Authenticated | Descriptor, route, runtime, and health detail |

## Required Alerts

| Alert | Condition | Severity |
| --- | --- | --- |
| `BirdCoderIngressUnavailable` | Readiness fails for the configured window | Critical |
| `BirdCoderHigh5xxRate` | 5xx ratio exceeds the deployment SLO | Warning |
| `BirdCoderAuthFailureSpike` | Protected-route 401/403 rate exceeds baseline | Warning |
| `BirdCoderDependencyUnavailable` | A required owner API is unavailable | Warning or critical by capability |
| `BirdCoderOwnerContractMismatch` | An owner SDK response violates the pinned contract | Critical |
| `BirdCoderReleaseDrift` | Running digest or owner OpenAPI differs from release evidence | Critical |

Agents, Skills, IM, and IAM metrics remain owned and named by those modules.
BirdCoder dashboards may link their health summaries but must not republish
dependency business facts as BirdCoder-owned facts.

## Initial SLOs

| Signal | Target |
| --- | --- |
| Application ingress availability, excluding maintenance | 99.5% monthly |
| P95 protected System route latency | Less than 800 ms at the qualified load profile |
| Authentication refresh success | Greater than 99% |
| Owner SDK contract decode success | 100% for required dependency probes |

## Dashboard Minimums

- request rate, latency, and response class by bounded route template;
- gateway liveness/readiness, replica count, and deployment digest;
- owner dependency latency, availability, retry, and circuit state;
- authorization denials by bounded reason code;
- client build/version adoption and failed SDK contract decoding;
- Redis/realtime health only when that optional infrastructure is enabled.

Never use tenant, organization, user, project, Session, message, path, token,
credential, or device-mount values as metric labels. Correlate SDKWork response
`traceId` values with access-controlled structured logs and redact all private
payloads.
