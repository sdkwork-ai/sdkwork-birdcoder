# SDKWork BirdCoder Kubernetes Deployment

This Helm chart deploys the stateless BirdCoder API gateway. BirdCoder owns no
database, migration, backup job, or persistent volume. Agents, skills, IAM, and
other dependency domains operate their own persistence and recovery procedures.

The baseline includes hardened pod security, exact-origin CORS configuration,
health probes, a network policy, and optional ServiceMonitor integration.

## Install

```bash
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  --set image.digest='sha256:<immutable-image-digest>'
```

Set a real image digest and replace the reserved origin before enabling public
traffic. `auth.existingSecret` may reference an operator-managed Secret for
gateway credentials and enabled Redis credentials. Database credentials do not
belong in this chart.

Use an immutable image tag, and pin the matching `sha256` digest during
production promotion so a tag cannot resolve to different bytes later.

## High Availability

`values-ha.yaml` scales the stateless gateway, enables Redis-backed realtime,
sets a three-replica autoscaling floor, configures a disruption budget, and
publishes the production OpenTelemetry collector endpoint.

```bash
helm upgrade --install sdkwork-birdcoder ./deployments/kubernetes \
  -f deployments/kubernetes/values.yaml \
  -f deployments/kubernetes/values-ha.yaml \
  --set image.digest='sha256:<immutable-image-digest>'
```

Redis credentials must come from `auth.existingSecret`; do not place them in
Helm values or command-line arguments.

## Observability

The chart exposes `/healthz`, `/readyz`, and `/metrics`. The ConfigMap publishes
the lifecycle environment, deployment profile, runtime target, exact CORS
origins, Redis settings, and OpenTelemetry settings only. It intentionally
publishes no database or device-state configuration.
