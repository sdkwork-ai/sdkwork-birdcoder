import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertNoLegacyIdentitySurface(source, label) {
  for (const forbiddenPattern of [
    /\bBirdCoderIdentity\b/u,
    /\bBirdcoderIdentity\b/u,
    /\bBIRDCODER_IDENTITY_/u,
    /\bbirdcoderIdentity\b/u,
    /\bbirdcoder-identity\b/u,
    /\bidentityIntegration\b/u,
    /--identity-mode\b/u,
    /\bcheck:identity-standard\b/u,
    /\bidentity:show\b/u,
    /\bidentity:doctor\b/u,
  ]) {
    assert.doesNotMatch(
      source,
      forbiddenPattern,
      `${label} must not expose legacy identity surface ${forbiddenPattern}.`,
    );
  }
}

function assertNoUserCenterImplementationSurface(source, label) {
  assert.doesNotMatch(
    source,
    /@sdkwork\/user-center-|createSdkworkCanonicalUserCenter|createSdkworkCanonicalAuthSurfacePage|createSdkworkCanonicalRuntimeAuthAuthorityService|createBirdCoderRuntimeUserCenterClient|userCenterRuntimeBridge|user-center-runtime|user-center-provider|external-user-center|SDKWORK_USER_CENTER_|VITE_SDKWORK_USER_CENTER_/u,
    `${label} must not keep application-level user-center implementation or deployment switching.`,
  );
}

function assertNoUserCenterDependency(packageJson, label) {
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };

  for (const dependencyName of Object.keys(dependencies)) {
    assert.equal(
      dependencyName.startsWith('@sdkwork/user-center-'),
      false,
      `${label} must not depend on ${dependencyName}; standard IAM integration uses @sdkwork/iam-* and split auth/user/vip surfaces.`,
    );
  }
}

const workspacePackageJson = readJson('package.json');
const iamPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/package.json');
const iamComponentSpec = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/specs/component.spec.json');
const authPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/package.json');
const userPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json');
const infrastructurePackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json');
const serverPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json');
const shellPackageJson = readJson('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json');
const iamIndexSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/index.ts');
const iamIntegrationSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts');
const authDefinitionSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth.ts');
const authSurfaceSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth-surface.ts');
const userDefinitionSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user.ts');
const vipDefinitionSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip.ts');
const authPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/pages/AuthPage.tsx');
const userPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/UserPage.tsx');
const vipPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/VipPage.tsx');
const commonsAuthContextSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/AuthContext.ts');
const infrastructureIndexSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts');
const commandOptionsSource = readText('scripts/birdcoder-command-options.mjs');
const commandMatrixSource = readText('scripts/birdcoder-iam-command-matrix.mjs');
const { createBirdcoderIamEnvReport, pickManagedEnv } = await import(
  pathToFileURL(path.join(rootDir, 'scripts/show-birdcoder-iam-env.mjs')).href
);

assert.equal(iamPackageJson.name, '@sdkwork/birdcoder-pc-iam');
assert.equal(iamComponentSpec.component.domain, 'iam');
assert.equal(iamComponentSpec.component.declaredDomain, 'iam');
assert.equal(
  iamComponentSpec.component.capability,
  'iam',
  'BirdCoder IAM component capability must be iam, not user-center.',
);

for (const [label, packageJson] of [
  ['workspace root', workspacePackageJson],
  ['BirdCoder IAM package', iamPackageJson],
  ['BirdCoder auth package', authPackageJson],
  ['BirdCoder user package', userPackageJson],
  ['BirdCoder infrastructure package', infrastructurePackageJson],
  ['BirdCoder server package', serverPackageJson],
  ['BirdCoder shell package', shellPackageJson],
]) {
  assertNoUserCenterDependency(packageJson, label);
}

assert.equal(
  workspacePackageJson.scripts?.['check:identity-standard'],
  undefined,
  'BirdCoder is unpublished; do not keep legacy check:identity-standard aliases.',
);
assert.equal(
  workspacePackageJson.scripts?.['test:user-center-standard'],
  undefined,
  'BirdCoder must not keep the retired user-center standard runner.',
);
assert.match(
  workspacePackageJson.scripts?.['check:iam-standard'] ?? '',
  /birdcoder-iam-runtime-standard-contract\.test\.mjs/u,
  'BirdCoder IAM standard lane must include the IAM runtime standard contract.',
);
assert.doesNotMatch(
  workspacePackageJson.scripts?.['check:iam-standard'] ?? '',
  /user-center/u,
  'BirdCoder IAM standard lane must not run retired user-center contracts.',
);

assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure-runtime'],
  undefined,
  'BirdCoder auth package must stay UI-only; IAM runtime binding belongs to @sdkwork/birdcoder-pc-iam.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'],
  'workspace:*',
  'BirdCoder IAM package must compose the BirdCoder auth package.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure'],
  'workspace:*',
  'BirdCoder IAM package must bind auth to the infrastructure IAM runtime through the public package entry.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'],
  undefined,
  'BirdCoder shell must load auth through @sdkwork/birdcoder-pc-iam instead of binding auth directly.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-iam'],
  'workspace:*',
  'BirdCoder shell must consume the standard IAM integration package.',
);

assert.match(iamIndexSource, /export \* from ['"]\.\/iamIntegration\.ts['"];/u);
for (const [source, label] of [
  [iamIndexSource, 'BirdCoder IAM package index'],
  [iamIntegrationSource, 'BirdCoder IAM integration'],
  [authDefinitionSource, 'BirdCoder auth definition'],
  [authSurfaceSource, 'BirdCoder auth surface'],
  [userDefinitionSource, 'BirdCoder user definition'],
  [vipDefinitionSource, 'BirdCoder VIP definition'],
  [authPageSource, 'BirdCoder auth page'],
  [userPageSource, 'BirdCoder user page'],
  [vipPageSource, 'BirdCoder VIP page'],
  [commonsAuthContextSource, 'BirdCoder auth context'],
  [infrastructureIndexSource, 'BirdCoder infrastructure index'],
  [commandOptionsSource, 'BirdCoder command options'],
  [commandMatrixSource, 'BirdCoder IAM command matrix'],
]) {
  assertNoLegacyIdentitySurface(source, label);
  assertNoUserCenterImplementationSurface(source, label);
}

assert.match(
  iamIntegrationSource,
  /from ["']@sdkwork\/birdcoder-pc-auth["']/u,
  'BirdCoder IAM facade must consume the BirdCoder auth package.',
);
assert.match(
  iamIntegrationSource,
  /from ["']@sdkwork\/birdcoder-pc-infrastructure["']/u,
  'BirdCoder IAM facade must consume infrastructure runtime and session boundaries through the workspace public entry.',
);
assert.match(
  iamIntegrationSource,
  /getBirdCoderIamRuntime/u,
  'BirdCoder IAM facade must expose the standard IAM runtime boundary.',
);
assert.match(
  iamIntegrationSource,
  /createAppSession/u,
  'BirdCoder IAM facade must expose app session creation through the infrastructure IAM session service.',
);
assert.match(
  iamIntegrationSource,
  /revokeAppSession/u,
  'BirdCoder IAM facade must expose app session revocation through the infrastructure IAM session service.',
);
assert.doesNotMatch(
  iamIntegrationSource,
  /\.\.\/\.\.\/apps\/sdkwork-birdcoder-pc\/packages\/sdkwork-birdcoder-pc-infrastructure\/src\//u,
  'BirdCoder IAM facade must not pierce the infrastructure package source tree.',
);

for (const [source, label] of [
  [authDefinitionSource, 'BirdCoder auth definition'],
  [userDefinitionSource, 'BirdCoder user definition'],
]) {
  assert.match(
    source,
    /domain:\s*['"]iam['"]/u,
    `${label} package metadata must use the canonical iam domain.`,
  );
  assert.doesNotMatch(
    source,
    /domain:\s*['"]user_center['"]/u,
    `${label} package metadata must not keep the retired user_center domain.`,
  );
}
assert.match(
  vipDefinitionSource,
  /domain:\s*['"]commerce['"]/u,
  'BirdCoder VIP package metadata must keep membership/billing outside the IAM session domain.',
);

for (const requiredExport of [
  'BirdCoderIamDeploymentProfile',
  'BirdCoderIamPageLoaders',
  'BirdCoderIamIntegrationDefinition',
  'BIRDCODER_IAM_AUTH_DEFAULT_ROUTE',
  'BIRDCODER_IAM_ROUTES',
  'resolveBirdCoderIamDeploymentProfile',
  'createBirdCoderIamPageLoaders',
  'createBirdCoderIamIntegrationDefinition',
]) {
  assert.match(
    iamIntegrationSource,
    new RegExp(`export (?:interface|const|function) ${requiredExport}\\b`, 'u'),
    `BirdCoder IAM integration must export ${requiredExport}.`,
  );
}

assert.deepEqual(
  pickManagedEnv({
    BIRDCODER_IAM_DEPLOYMENT_MODE: 'desktop-local',
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD: 'dev123456',
    SDKWORK_IAM_MODE: 'local',
    VITE_SDKWORK_DEPLOYMENT_MODE: 'local',
  }),
  {
    BIRDCODER_IAM_DEPLOYMENT_MODE: 'desktop-local',
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD: '***',
    SDKWORK_IAM_MODE: 'local',
    VITE_SDKWORK_DEPLOYMENT_MODE: 'local',
  },
  'IAM env inspector must include standard SDKWORK_IAM_* values while masking secrets.',
);

const desktopLocalIamReport = createBirdcoderIamEnvReport({
  env: {},
  iamMode: 'desktop-local',
  target: 'desktop-dev',
  viteMode: 'development',
});
assert.equal(desktopLocalIamReport.managedEnv.SDKWORK_IAM_MODE, 'local');
assert.equal(desktopLocalIamReport.managedEnv.VITE_SDKWORK_DEPLOYMENT_MODE, 'local');

console.log('birdcoder iam standard contract passed.');
