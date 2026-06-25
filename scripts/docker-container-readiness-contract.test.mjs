import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const dockerfile = read('deployments/docker/Dockerfile');
const defaultEnv = read('deployments/docker/profiles/default.env');
const configMap = read('deployments/kubernetes/templates/configmap.yaml');
const dockerReadme = read('deployments/docker/README.md');

assert.match(
  dockerfile,
  /COPY --chown=birdcoder:birdcoder database \/opt\/sdkwork-birdcoder\/database/u,
  'Dockerfile must bundle the database lifecycle module for container bootstrap.',
);
assert.match(
  dockerfile,
  /SDKWORK_BIRDCODER_APP_ROOT=\/opt\/sdkwork-birdcoder/u,
  'Dockerfile must set SDKWORK_BIRDCODER_APP_ROOT for database module resolution.',
);
assert.match(
  dockerfile,
  /SDKWORK_OPENAPI_SNAPSHOT_PATH=\/opt\/sdkwork-birdcoder\/openapi\/coding-server-v1\.json/u,
  'Dockerfile must set SDKWORK_OPENAPI_SNAPSHOT_PATH for live OpenAPI serving.',
);
assert.match(
  defaultEnv,
  /SDKWORK_BIRDCODER_APP_ROOT=\/opt\/sdkwork-birdcoder/u,
  'Docker default env must expose SDKWORK_BIRDCODER_APP_ROOT.',
);
assert.match(
  defaultEnv,
  /SDKWORK_OPENAPI_SNAPSHOT_PATH=\/opt\/sdkwork-birdcoder\/openapi\/coding-server-v1\.json/u,
  'Docker default env must expose SDKWORK_OPENAPI_SNAPSHOT_PATH.',
);
assert.match(
  configMap,
  /SDKWORK_BIRDCODER_APP_ROOT/u,
  'Kubernetes ConfigMap must expose SDKWORK_BIRDCODER_APP_ROOT.',
);
assert.match(
  configMap,
  /SDKWORK_OPENAPI_SNAPSHOT_PATH/u,
  'Kubernetes ConfigMap must expose SDKWORK_OPENAPI_SNAPSHOT_PATH.',
);
assert.match(
  dockerReadme,
  /deployments\/docker\/docker-compose\.yml/u,
  'Docker README must reference the canonical deployments/docker path.',
);

console.log('docker container readiness contract passed.');
