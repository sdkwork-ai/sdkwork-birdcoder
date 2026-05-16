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

function assertNoLegacyIamEnvironmentNames(source, label) {
  for (const forbiddenPattern of [
    /\bBIRDCODER_USER_CENTER_LOGIN_PROVIDER\b/u,
    /\bVITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER\b/u,
    /\bBIRDCODER_USER_CENTER_APP_API_BASE_URL\b/u,
    /\bBIRDCODER_LOCAL_OAUTH_PROVIDERS\b/u,
    /\bBIRDCODER_LOCAL_OAUTH_[A-Z0-9_]+\b/u,
    /local-default@sdkwork-birdcoder\.local/u,
    /\bidentity verification shortcut\b/iu,
    /\bthird-party identity gateway\b/iu,
  ]) {
    assert.doesNotMatch(
      source,
      forbiddenPattern,
      `${label} must use canonical appbase IAM env and wording instead of ${forbiddenPattern}.`,
    );
  }
}

function assertNoServiceIdentityProviderAlias(source, label) {
  assert.doesNotMatch(
    source,
    /\bidentityProvider\b/u,
    `${label} must use currentUserProvider naming for IAM current-user scoping instead of the retired identityProvider alias.`,
  );
}

function assertNoLegacyIdentityWording(source, label) {
  for (const forbiddenPattern of [
    /\bExternal user center identity exchanged successfully\.\b/u,
    /\buser center identity exchanged\b/iu,
  ]) {
    assert.doesNotMatch(
      source,
      forbiddenPattern,
      `${label} must describe appbase IAM session exchange without retired identity wording ${forbiddenPattern}.`,
    );
  }
}

const workspacePackageJson = readJson('package.json');
const iamPackageJson = readJson('packages/sdkwork-birdcoder-iam/package.json');
const iamComponentSpec = readJson('packages/sdkwork-birdcoder-iam/specs/component.spec.json');
const iamIndexSource = readText('packages/sdkwork-birdcoder-iam/src/index.ts');
const iamIntegrationSource = readText('packages/sdkwork-birdcoder-iam/src/iamIntegration.ts');
const authDefinitionSource = readText('packages/sdkwork-birdcoder-auth/src/auth.ts');
const userDefinitionSource = readText('packages/sdkwork-birdcoder-user/src/user.ts');
const authPageSource = readText('packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx');
const userCenterPageSource = readText('packages/sdkwork-birdcoder-user/src/pages/UserCenterPage.tsx');
const vipPageSource = readText('packages/sdkwork-birdcoder-user/src/pages/VipPage.tsx');
const commonsIndexSource = readText('packages/sdkwork-birdcoder-commons/src/index.ts');
const activeIamStandardDocSources = [
  [
    'Appbase auth/user/VIP architecture standard',
    readText('docs/架构/17-appbase-auth-user-vip-统一接入标准.md'),
  ],
  [
    'data model and API contract architecture standard',
    readText('docs/架构/07-数据模型-状态模型-接口契约.md'),
  ],
  [
    'Appbase auth/user/VIP implementation step',
    readText('docs/step/14-appbase-auth-user-vip-统一接入实施.md'),
  ],
];
const { createBirdcoderIamEnvReport, pickManagedEnv } = await import(
  pathToFileURL(path.join(rootDir, 'scripts/show-birdcoder-iam-env.mjs')).href
);

assert.equal(iamPackageJson.name, '@sdkwork/birdcoder-iam');
assert.equal(iamComponentSpec.component.domain, 'iam');
assert.equal(iamComponentSpec.component.capability, 'user-center');
assert.equal(iamComponentSpec.component.displayName, 'SDKWork BirdCoder IAM');

assert.equal(
  workspacePackageJson.scripts?.['check:identity-standard'],
  undefined,
  'BirdCoder is unpublished; do not keep legacy check:identity-standard aliases.',
);
assert.equal(
  workspacePackageJson.scripts?.['check:iam-standard'],
  'node scripts/appbase-package-boundary-contract.test.mjs && node scripts/birdcoder-iam-appbase-parity-contract.test.mjs && node scripts/auth-ui-standard-contract.test.mjs && node scripts/iam-command-matrix-contract.test.mjs && node scripts/run-birdcoder-dev-stack-contract.test.mjs && node scripts/user-center-plus-entity-standard-contract.test.mjs && node --experimental-strip-types scripts/user-center-plugin-contract.test.ts',
);
assert.equal(
  workspacePackageJson.scripts?.['test:iam-seed-parity-contract'],
  'node scripts/iam-seed-parity-contract.test.mjs',
);

assert.match(iamIndexSource, /export \* from ['"]\.\/iamIntegration\.ts['"];/u);
assertNoLegacyIdentitySurface(iamIndexSource, 'BirdCoder IAM package index');
assertNoLegacyIdentitySurface(iamIntegrationSource, 'BirdCoder IAM integration');
assert.doesNotMatch(
  iamIntegrationSource,
  /createSdkworkCanonicalUserCenterDefinition|createSdkworkCanonicalUserCenterValidationDefinition/u,
  'BirdCoder IAM facade must reuse @sdkwork/birdcoder-user user-center definitions instead of recreating appbase definitions.',
);
assert.match(
  iamIntegrationSource,
  /from ["']@sdkwork\/birdcoder-user["']/u,
  'BirdCoder IAM facade must consume the canonical BirdCoder user-center adapter package.',
);
assert.match(
  iamIntegrationSource,
  /from ["']@sdkwork\/birdcoder-infrastructure["']/u,
  'BirdCoder IAM facade must consume infrastructure runtime bridge through the workspace package public entry.',
);
assert.doesNotMatch(
  iamIntegrationSource,
  /\.\.\/\.\.\/sdkwork-birdcoder-infrastructure\/src\//u,
  'BirdCoder IAM facade must not pierce the infrastructure package source tree.',
);
for (const [source, label] of [
  [authDefinitionSource, 'BirdCoder auth definition'],
  [userDefinitionSource, 'BirdCoder user definition'],
  [authPageSource, 'BirdCoder auth page'],
  [userCenterPageSource, 'BirdCoder user-center page'],
  [vipPageSource, 'BirdCoder VIP page'],
  [commonsIndexSource, 'BirdCoder commons index'],
]) {
  assertNoLegacyIdentitySurface(source, label);
}

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

for (const [label, source] of activeIamStandardDocSources) {
  assert.doesNotMatch(
    source,
    /`identity`|\bidentity\./u,
    `${label} must name the standard domain iam, not the retired identity domain.`,
  );
}

for (const [source, label] of [
  [authPageSource, 'BirdCoder auth page'],
  [userCenterPageSource, 'BirdCoder user-center page'],
  [vipPageSource, 'BirdCoder VIP page'],
]) {
  assert.doesNotMatch(
    source,
    /useBirdcoderIamSurfaceAppearance|BirdCoderIamAccessRequiredState|DEFAULT_BIRDCODER_.*UNAUTHENTICATED_STATE|surfaceAppearance\?:|IdentityAccessRequiredState/u,
    `${label} must consume sdkwork-appbase IAM UI defaults without BirdCoder-specific surface appearance or access-state wrappers.`,
  );
}

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

for (const [relativePath, label] of [
  ['.env.example', '.env.example'],
  ['README.md', 'workspace README'],
  ['README.zh-CN.md', 'workspace Chinese README'],
  ['docs/architecture.md', 'architecture landing page'],
  ['package.json', 'workspace package.json'],
  ['docs/core/architecture.md', 'core architecture docs'],
  ['docs/core/packages.md', 'core packages docs'],
  ['docs/guide/application-modes.md', 'application modes docs'],
  ['docs/guide/development.md', 'development docs'],
  ['docs/reference/commands.md', 'command reference docs'],
  ['docs/reference/environment.md', 'environment reference docs'],
  ['scripts/governance-regression-report.mjs', 'governance regression report'],
  ['scripts/governance-regression-report.test.mjs', 'governance regression report contract'],
  ['packages/sdkwork-birdcoder-core/src/userCenterSession.ts', 'core user-center session'],
  ['packages/sdkwork-birdcoder-web/src/vite-env.d.ts', 'web vite env'],
  ['packages/sdkwork-birdcoder-web/vite.config.ts', 'web vite config'],
  ['packages/sdkwork-birdcoder-commons/package.json', 'commons package manifest'],
  ['scripts/birdcoder-iam-env.mjs', 'IAM env script'],
  ['scripts/birdcoder-command-options.mjs', 'command options'],
  ['scripts/birdcoder-iam-command-matrix.mjs', 'IAM command matrix'],
  ['scripts/show-birdcoder-iam-env.mjs', 'IAM env inspector'],
  ['scripts/run-birdcoder-iam-doctor.mjs', 'IAM doctor'],
  ['scripts/run-sample-iam-check.mjs', 'IAM sample check'],
]) {
  const source = readText(relativePath);
  assertNoLegacyIdentitySurface(source, label);
  assertNoLegacyIamEnvironmentNames(source, label);
}

for (const [relativePath, label] of [
  ['packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts', 'default IDE services'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/lazyDefaultIdeServices.ts', 'lazy default IDE services'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCollaborationService.ts', 'collaboration API service'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts', 'core read API service'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts', 'project API service'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedTeamService.ts', 'team API service'],
  ['packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts', 'workspace API service'],
  ['scripts/api-backed-project-service-import-authority-contract.test.ts', 'project import authority contract'],
  ['scripts/api-backed-project-service-user-scope-fallback-contract.test.ts', 'project user-scope fallback contract'],
  ['scripts/api-backed-workspace-service-user-scope-fallback-contract.test.ts', 'workspace user-scope fallback contract'],
  ['scripts/default-ide-services-core-read-service-contract.test.ts', 'default IDE core read contract'],
  ['scripts/prompt-skill-template-evidence-consumer-contract.test.ts', 'prompt skill evidence consumer contract'],
]) {
  assertNoServiceIdentityProviderAlias(readText(relativePath), label);
}

for (const [relativePath, label] of [
  ['packages/sdkwork-birdcoder-server/src/index.ts', 'coding server OpenAPI source'],
  ['server/win32/x64/openapi/coding-server-v1.json', 'win32 bundled coding server OpenAPI'],
  ['server/windows/x64/openapi/coding-server-v1.json', 'windows bundled coding server OpenAPI'],
]) {
  assertNoLegacyIdentityWording(readText(relativePath), label);
}

assert.equal(
  readJson('packages/sdkwork-birdcoder-commons/package.json').dependencies?.[
    '@sdkwork/user-center-pc-react'
  ],
  undefined,
  'BirdCoder commons must not depend on appbase user-center UI only to customize IAM surface appearance.',
);

assert.deepEqual(
  pickManagedEnv({
    BIRDCODER_IAM_DEPLOYMENT_MODE: 'desktop-local',
    SDKWORK_USER_CENTER_LOCAL_BOOTSTRAP_PASSWORD: 'dev123456',
    SDKWORK_USER_CENTER_MODE: 'builtin-local',
    VITE_SDKWORK_USER_CENTER_MODE: 'builtin-local',
  }),
  {
    BIRDCODER_IAM_DEPLOYMENT_MODE: 'desktop-local',
    SDKWORK_USER_CENTER_LOCAL_BOOTSTRAP_PASSWORD: '***',
    SDKWORK_USER_CENTER_MODE: 'builtin-local',
    VITE_SDKWORK_USER_CENTER_MODE: 'builtin-local',
  },
  'IAM env inspector must include appbase-owned SDKWORK_USER_CENTER_* values while masking secrets.',
);

const desktopLocalIamReport = createBirdcoderIamEnvReport({
  env: {},
  iamMode: 'desktop-local',
  target: 'desktop-dev',
  viteMode: 'development',
});
assert.equal(desktopLocalIamReport.managedEnv.SDKWORK_USER_CENTER_MODE, 'builtin-local');
assert.equal(desktopLocalIamReport.managedEnv.VITE_SDKWORK_USER_CENTER_MODE, 'builtin-local');

console.log('birdcoder iam standard contract passed.');
