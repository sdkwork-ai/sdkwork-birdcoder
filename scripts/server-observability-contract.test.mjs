import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function collectFiles(relativeRoot) {
  const files = [];
  const stack = [path.join(rootDir, relativeRoot)];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else {
        files.push(absolutePath);
      }
    }
  }
  return files;
}

const mainSource = read('crates/sdkwork-api-birdcoder-standalone-gateway/src/main.rs');
const libSource = read('crates/sdkwork-api-birdcoder-standalone-gateway/src/lib.rs');
const gatewayComponent = read(
  'crates/sdkwork-api-birdcoder-standalone-gateway/specs/component.spec.json',
);
const assemblyComponent = read('crates/sdkwork-api-birdcoder-assembly/specs/component.spec.json');
const dockerfile = read('deployments/docker/Dockerfile');
const compose = read('deployments/docker/docker-compose.yml');
const values = read('deployments/kubernetes/values.yaml');
const haValues = read('deployments/kubernetes/values-ha.yaml');
const configMap = read('deployments/kubernetes/templates/configmap.yaml');
const deployment = read('deployments/kubernetes/templates/deployment.yaml');

assert.match(
  mainSource,
  /sdkwork_web_bootstrap::init_tracing_from_env/u,
  'The gateway must initialize structured tracing through sdkwork-web-bootstrap.',
);
assert.match(
  mainSource,
  /assemble_api_router\(&config\)/u,
  'The gateway must consume the host-neutral BirdCoder assembly.',
);
assert.doesNotMatch(
  `${mainSource}\n${libSource}`,
  /database|postgres|sqlite|migration|backup|enable_process_shared_database_pool/iu,
  'The standalone gateway must remain a stateless composition host.',
);

for (const componentSource of [gatewayComponent, assemblyComponent]) {
  assert.doesNotMatch(
    componentSource,
    /DATABASE_(?:FRAMEWORK_)?SPEC|SDKWORK_(?:BIRDCODER|CLAW)_DATABASE|sharedDatabasePool|databasePolicy/iu,
    'Gateway and assembly component contracts must not declare BirdCoder database ownership.',
  );
}

const serverConfigRoots = [
  'etc/topology',
  'apps/sdkwork-birdcoder-pc/config/server',
  'apps/sdkwork-birdcoder-pc/config/container',
  'deployments/docker',
  'deployments/kubernetes',
];
const forbiddenRuntimePattern = /SDKWORK_(?:BIRDCODER|CLAW)_DATABASE|SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION|SDKWORK_BIRDCODER_DEVICE_STATE_FILE|\[database\]|\bpostgres(?:ql)?\b|\bsqlite\b/iu;
for (const configRoot of serverConfigRoots) {
  for (const absolutePath of collectFiles(configRoot)) {
    const source = fs.readFileSync(absolutePath, 'utf8');
    assert.doesNotMatch(
      source,
      forbiddenRuntimePattern,
      `${path.relative(rootDir, absolutePath)} must not declare database or PC device-state configuration.`,
    );
  }
}

for (const retiredPath of [
  '.env.postgres.example',
  'specs/process-database-pool.spec.json',
  'deployments/kubernetes/values-postgresql-ha.yaml',
  'deployments/kubernetes/templates/backup-cronjob.yaml',
  'deployments/kubernetes/templates/backup-pvc.yaml',
  'deployments/kubernetes/templates/persistentvolumeclaim.yaml',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, retiredPath)),
    false,
    `${retiredPath} must remain removed from the stateless BirdCoder deployment.`,
  );
}

assert.doesNotMatch(dockerfile, /COPY[^\r\n]+database|VOLUME\s*\[/iu);
assert.doesNotMatch(compose, /^volumes:/mu);
assert.doesNotMatch(values, /^(?:database|persistence|backup):/mu);
assert.doesNotMatch(
  configMap,
  /SDKWORK_(?:BIRDCODER|CLAW)_DATABASE|SDKWORK_BIRDCODER_DEVICE_STATE/iu,
);
assert.doesNotMatch(deployment, /persistentVolumeClaim|mountPath:\s*\/var\/lib\/sdkwork-birdcoder/iu);
assert.match(values, /path: \/healthz/u);
assert.match(values, /path: \/readyz/u);
assert.match(values, /serviceMonitor:/u);
assert.match(configMap, /OTEL_SERVICE_NAME/u);
assert.match(haValues, /^replicaCount: 3$/mu);
assert.match(haValues, /^\s*backend: redis$/mu);
assert.match(haValues, /^\s*minReplicas: 3$/mu);

console.log('stateless server deployment and observability contract passed.');
