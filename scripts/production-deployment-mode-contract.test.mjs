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

const authPolicySource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/authAccessPolicy.ts',
);
const productionRuntimeEnv = readJson(
  'apps/sdkwork-birdcoder-pc/config/browser/runtime-env.production.example.json',
);

assert.match(
  authPolicySource,
  /import\.meta[\s\S]*?\.env\?\.PROD && resolved === 'local'/u,
  'Auth access policy must fail fast when production builds bake in local deployment mode.',
);

assert.match(
  authPolicySource,
  /\?\? 'private'/u,
  'Auth access policy must default to private when deployment mode is unset.',
);

assert.notEqual(
  productionRuntimeEnv.deploymentMode,
  'local',
  'Production runtime env template must not declare local deployment mode.',
);

assert.match(
  productionRuntimeEnv.deploymentMode,
  /^(private|saas)$/u,
  'Production runtime env template must declare private or saas deployment mode.',
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
