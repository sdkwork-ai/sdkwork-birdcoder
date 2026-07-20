import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import './runtime-location-key-rotation-contract.test.mjs';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const routerSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/routers.rs');
const bootstrapSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/mod.rs');
const healthSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/health.rs');
const mainSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/main.rs');
const authSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/auth.rs');
const observabilitySource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/observability.rs');
const smokeSource = readText('crates/sdkwork-api-birdcoder-standalone-gateway/tests/bootstrap_smoke.rs');
const valuesSource = readText('deployments/kubernetes/values.yaml');
const configMapSource = readText('deployments/kubernetes/templates/configmap.yaml');

assert.match(
  routerSource,
  /HttpMetricsRegistry::with_dimensions/u,
  'API server router must register process-wide HTTP metrics dimensions.',
);
assert.match(
  routerSource,
  /with_deployment_profile/u,
  'API server metrics must expose deployment profile dimensions for cloud operations.',
);
assert.match(
  routerSource,
  /with_runtime_target/u,
  'API server metrics must expose runtime target dimensions for container operations.',
);
assert.match(
  routerSource,
  /"\/metrics"/u,
  'API server must expose an unauthenticated Prometheus scrape endpoint at /metrics.',
);
assert.match(
  routerSource,
  /"\/openapi\.json"/u,
  'API server must expose the live OpenAPI snapshot at /openapi.json.',
);
assert.match(
  mainSource,
  /sdkwork_web_bootstrap::init_tracing_from_env/u,
  'API server must bootstrap structured tracing through sdkwork-web-bootstrap.',
);
assert.match(
  authSource,
  /\.with_metrics\(metrics\)/u,
  'Protected app router must attach HttpMetricsRegistry to the web framework layer.',
);
assert.match(
  observabilitySource,
  /render_prometheus\(\)/u,
  'Metrics handler must render Prometheus text from HttpMetricsRegistry.',
);
assert.match(
  healthSource,
  /installed_iam_database_host/u,
  'Readiness must reuse the installed IAM database host instead of opening a second pool.',
);
assert.doesNotMatch(
  healthSource,
  /create_pool_from_env\(IAM_SERVICE_NAME\)/u,
  'Readiness must not create an independent IAM database pool from process environment.',
);
assert.match(
  bootstrapSource,
  /routers::build_router\(state, config\)\.await\?;\s*crate::health::init_iam_pool\(\)\.await;/su,
  'Readiness must initialize IAM pool state only after the IAM router completes bootstrap.',
);
assert.match(
  smokeSource,
  /\/metrics/u,
  'API server bootstrap smoke tests must cover the /metrics endpoint.',
);
assert.match(
  valuesSource,
  /serviceMonitor:/u,
  'Kubernetes values must declare ServiceMonitor settings for Prometheus scraping.',
);
assert.match(
  valuesSource,
  /path: \/healthz/u,
  'Kubernetes liveness probes must use the unauthenticated /healthz endpoint.',
);
assert.match(
  valuesSource,
  /path: \/readyz/u,
  'Kubernetes readiness probes must use the unauthenticated /readyz endpoint.',
);
assert.match(
  valuesSource,
  /kubernetes\.io\/metadata\.name: monitoring/u,
  'Kubernetes network policy must allow Prometheus monitoring namespace ingress.',
);
assert.match(
  configMapSource,
  /SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE/u,
  'Kubernetes config must publish deployment profile runtime env for metrics dimensions.',
);
assert.match(
  configMapSource,
  /SDKWORK_BIRDCODER_RUNTIME_TARGET/u,
  'Kubernetes config must publish runtime target env for metrics dimensions.',
);
assert.match(
  configMapSource,
  /SDKWORK_BIRDCODER_ENVIRONMENT/u,
  'Kubernetes config must publish the canonical environment value used by metrics dimensions.',
);
assert.match(
  routerSource,
  /with_deployment_profile\(config\.deployment_profile\.as_str\(\)\)/u,
  'Metrics dimensions must use the validated deployment profile instead of a second legacy environment lookup.',
);
assert.match(
  routerSource,
  /with_runtime_target\(config\.runtime_target\.as_str\(\)\)/u,
  'Metrics dimensions must use the validated runtime target instead of a second legacy environment lookup.',
);
assert.match(
  routerSource,
  /dimensions\.environment = config\.environment\.as_str\(\)\.to_owned\(\)/u,
  'Metrics dimensions must use the validated environment instead of a second legacy environment lookup.',
);
assert.doesNotMatch(
  routerSource,
  /std::env::var\("SDKWORK_(?:DEPLOYMENT_PROFILE|RUNTIME_TARGET|ENVIRONMENT)"\)/u,
  'Metrics dimensions must not bypass the namespaced runtime configuration with retired generic environment variables.',
);
assert.match(
  configMapSource,
  /SDKWORK_BIRDCODER_DATABASE_ENGINE/u,
  'Kubernetes config must publish database engine env for runtime bootstrap.',
);
assert.match(
  configMapSource,
  /OTEL_SERVICE_NAME/u,
  'Kubernetes config must publish OTEL service name for tracing bootstrap.',
);
assert.equal(
  fs.existsSync(path.join(rootDir, 'deployments/kubernetes/templates/servicemonitor.yaml')),
  true,
  'Kubernetes chart must ship a ServiceMonitor template when observability is enabled.',
);

console.log('server observability contract passed.');
