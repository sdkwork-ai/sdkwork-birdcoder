import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const rootPackageJson = readJson('package.json');
const iamPackageJson = readJson(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/package.json',
);
const iamComponentSpec = readJson(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/specs/component.spec.json',
);
const iamIndexSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/index.ts',
);
const iamIntegrationSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts',
);

assert.equal(iamPackageJson.name, '@sdkwork/birdcoder-pc-iam');
assert.equal(iamComponentSpec.component.domain, 'iam');
assert.equal(iamComponentSpec.component.declaredDomain, 'iam');
assert.equal(iamComponentSpec.component.capability, 'iam');
assert.equal(iamComponentSpec.contracts.layerRole, 'frontend-feature');
assert.deepEqual(iamComponentSpec.contracts.requiredPorts, []);
assert.deepEqual(iamComponentSpec.contracts.sdkClients, []);

const packageManifests = [
  ['IAM', iamPackageJson],
  [
    'auth',
    readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/package.json'),
  ],
  [
    'user',
    readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json'),
  ],
  [
    'infrastructure',
    readJson(
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json',
    ),
  ],
  [
    'shell',
    readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json'),
  ],
];

for (const [label, packageJson] of packageManifests) {
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };
  for (const dependencyName of Object.keys(dependencies)) {
    assert.equal(
      dependencyName.startsWith('@sdkwork/user-center-'),
      false,
      `${label} must use the canonical IAM packages instead of ${dependencyName}.`,
    );
  }
}

assert.match(iamIndexSource, /export \* from ['"]\.\/iamIntegration\.ts['"];?/u);
assert.match(iamIndexSource, /@sdkwork\/birdcoder-pc-auth/u);
assert.match(iamIndexSource, /@sdkwork\/birdcoder-pc-infrastructure\/services\/iamRuntime/u);
assert.match(iamIntegrationSource, /from ['"]@sdkwork\/birdcoder-pc-auth['"]/u);
assert.match(
  iamIntegrationSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure\/services\/iamRuntime['"]/u,
);
assert.match(
  iamIntegrationSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure\/services\/sessionService['"]/u,
);
assert.match(
  iamIntegrationSource,
  /from ['"]@sdkwork\/birdcoder-pc-infrastructure\/services\/runtimeTopology['"]/u,
  'IAM must consume the canonical BirdCoder runtime topology.',
);
assert.doesNotMatch(
  iamIntegrationSource,
  /fetch\(|axios|Authorization|Access-Token/u,
  'The IAM feature facade must not own HTTP transport or auth headers.',
);
assert.doesNotMatch(
  iamIntegrationSource,
  /BirdCoderIamDeploymentMode|iamMode|usesDedicatedServer|usesEmbeddedLocalAuthority|usesSharedCloudAuthority|['"](?:local|private|saas)['"]/u,
  'IAM must consume the application deployment profile and runtime target instead of defining another deployment mode.',
);

assert.equal(rootPackageJson.scripts?.['check:iam:desktop:local'], undefined);
assert.equal(rootPackageJson.scripts?.['check:env:desktop:local'], undefined);
assert.doesNotMatch(
  JSON.stringify(rootPackageJson.scripts ?? {}),
  /birdcoder-iam-command-matrix|show-birdcoder-iam-env|run-birdcoder-iam-doctor/u,
  'IAM checks must validate SDK/runtime boundaries, not a second command matrix.',
);

console.log('birdcoder iam standard contract passed.');
