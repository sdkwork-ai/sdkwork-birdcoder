import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const authGateSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/AuthGate.tsx',
);
const productionRuntimeEnv = readJson(
  'apps/sdkwork-birdcoder-pc/config/browser/runtime-env.production.example.json',
);

assert.match(
  authGateSource,
  /if \(!user\) \{/u,
  'AuthGate must enforce authenticated access for every deployment profile and runtime target.',
);

assert.doesNotMatch(
  authGateSource,
  /deploymentMode|iamMode|['"](?:local|private|saas)['"]/u,
  'AuthGate must not derive auth policy from a second deployment-mode vocabulary.',
);

assert.equal(
  productionRuntimeEnv.deploymentProfile,
  'cloud',
  'Production runtime env template must use the canonical cloud deployment profile.',
);

assert.equal(
  productionRuntimeEnv.runtimeTarget,
  'browser',
  'Production runtime env template must declare its runtime target independently.',
);

for (const relativePath of [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/ideServices.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/lazyDefaultIdeServices.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/ServiceContext.tsx',
]) {
  const source = readText(relativePath);
  assert.doesNotMatch(
    source,
    /adminDeploymentService|adminPolicyService|auditService/u,
    `${relativePath} must not expose admin services in the app IDE context.`,
  );
}

console.log('production deployment mode contract passed.');
