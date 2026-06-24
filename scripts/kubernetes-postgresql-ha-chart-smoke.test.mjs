import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { smokeKubernetesPostgresqlHaChart } from './kubernetes-postgresql-ha-chart-smoke.mjs';

const rootDir = process.cwd();
const packageReleaseAssetsSource = fs.readFileSync(
  path.join(rootDir, 'scripts/release/package-release-assets.mjs'),
  'utf8',
);
const deploymentTemplate = fs.readFileSync(
  path.join(rootDir, 'deployments/kubernetes/templates/deployment.yaml'),
  'utf8',
);

assert.match(
  packageReleaseAssetsSource,
  /deployments['"], 'kubernetes'/u,
  'Kubernetes release packaging must copy from deployments/kubernetes.',
);
assert.match(
  packageReleaseAssetsSource,
  /values-postgresql-ha\.yaml/u,
  'Kubernetes release packaging must include the PostgreSQL HA values overlay.',
);
assert.match(
  deploymentTemplate,
  /configMapRef/u,
  'Deployment must mount runtime ConfigMap env vars for database engine selection.',
);

const result = smokeKubernetesPostgresqlHaChart();
assert.notEqual(
  result.status,
  'failed',
  result.status === 'failed' ? result.message : 'PostgreSQL HA chart smoke should not fail',
);
if (result.status === 'passed') {
  assert.ok(
    result.checks.some((check) => check.id === 'helm-template' && check.status === 'passed'),
    'helm template rendering must pass when helm is available',
  );
}

console.log('kubernetes postgresql ha chart smoke contract passed.');
