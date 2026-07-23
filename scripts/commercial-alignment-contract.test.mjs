import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function materializedFiles(relativePath) {
  const absoluteRoot = path.join(rootDir, relativePath);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const pending = [absoluteRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(child);
      else if (entry.isFile()) files.push(path.relative(rootDir, child));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

const dockerCompose = read('deployments/docker/docker-compose.yml');
const dockerfile = read('deployments/docker/Dockerfile');
const values = read('deployments/kubernetes/values.yaml');
const haValues = read('deployments/kubernetes/values-ha.yaml');
const deployment = read('deployments/kubernetes/templates/deployment.yaml');

assert.match(dockerCompose, /http:\/\/127\.0\.0\.1:18989\/readyz/u);
assert.match(dockerfile, /http:\/\/127\.0\.0\.1:18989\/readyz/u);
assert.match(dockerCompose, /deployments\/docker\/Dockerfile/u);
assert.doesNotMatch(dockerCompose, /^volumes:/mu);
assert.doesNotMatch(dockerfile, /COPY[^\r\n]+database|VOLUME\s*\[/iu);

assert.match(values, /^replicaCount: 1$/mu);
assert.match(values, /autoscaling:\s*\n\s*enabled: false/u);
assert.doesNotMatch(values, /^(?:database|persistence|backup):/mu);
assert.match(haValues, /^replicaCount: 3$/mu);
assert.match(haValues, /autoscaling:\s*\n\s*enabled: true/u);
assert.match(haValues, /realtime:\s*\n\s*backend: redis/u);
assert.doesNotMatch(deployment, /persistentVolumeClaim/iu);

assert.deepEqual(
  materializedFiles('database'),
  [],
  'The retired database root must not contain authored files.',
);

for (const retiredPath of [
  'crates/sdkwork-routes-workspace-app-api/Cargo.toml',
  'deployments/kubernetes/values-postgresql-ha.yaml',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, retiredPath)),
    false,
    `${retiredPath} must remain absent from the commercial BirdCoder deployment.`,
  );
}

assert.equal(
  fs.existsSync(path.join(rootDir, 'deployments/deploy.yaml')),
  true,
  'Application deploy manifest must exist at deployments/deploy.yaml.',
);

console.log('commercial stateless deployment alignment contract passed.');
