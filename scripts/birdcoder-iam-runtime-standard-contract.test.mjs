import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertNoMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

function assertMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

const authPackageJson = readJson('packages/sdkwork-birdcoder-auth/package.json');
const iamPackageJson = readJson('packages/sdkwork-birdcoder-iam/package.json');
const infrastructurePackageJson = readJson('packages/sdkwork-birdcoder-infrastructure/package.json');
const serverPackageJson = readJson('packages/sdkwork-birdcoder-server/package.json');
const iamIntegrationSource = readText('packages/sdkwork-birdcoder-iam/src/iamIntegration.ts');
const authPageSource = readText('packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx');
const authSurfaceSource = readText('packages/sdkwork-birdcoder-auth/src/auth-surface.ts');
const infrastructureIndexSource = readText('packages/sdkwork-birdcoder-infrastructure/src/index.ts');
const sdkClientsSource = readText('packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts');
const iamRuntimeSource = readText('packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts');
const defaultServicesSource = readText('packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts');

for (const [label, packageJson] of [
  ['sdkwork-birdcoder-auth', authPackageJson],
  ['sdkwork-birdcoder-iam', iamPackageJson],
  ['sdkwork-birdcoder-infrastructure', infrastructurePackageJson],
  ['sdkwork-birdcoder-server', serverPackageJson],
]) {
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  for (const dependencyName of Object.keys(dependencies)) {
    assert.equal(
      dependencyName.startsWith('@sdkwork/user-center-'),
      false,
      `${label} must not depend on ${dependencyName}; BirdCoder app auth must use canonical @sdkwork/iam-* runtime contracts.`,
    );
  }
}

assertMatch(
  authPackageJson.dependencies?.['@sdkwork/auth-pc-react'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-auth must consume the canonical auth UI package.',
);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-infrastructure-runtime'],
  undefined,
  'sdkwork-birdcoder-auth must not depend on infrastructure runtime; IAM runtime binding belongs to sdkwork-birdcoder-iam.',
);
assertMatch(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-auth'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-iam must compose the BirdCoder auth package.',
);
assertMatch(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-infrastructure'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-iam must bind auth to the infrastructure IAM runtime through the public entry.',
);
assertMatch(
  infrastructurePackageJson.dependencies?.['@sdkwork/iam-runtime'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-infrastructure must declare @sdkwork/iam-runtime directly.',
);
assertMatch(
  infrastructurePackageJson.dependencies?.['@sdkwork/iam-service'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-infrastructure must declare @sdkwork/iam-service directly for stored session typing.',
);
assertMatch(
  infrastructurePackageJson.dependencies?.['@sdkwork/iam-sdk-ports'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-infrastructure must declare @sdkwork/iam-sdk-ports directly for generated client validation.',
);
assertMatch(
  infrastructurePackageJson.dependencies?.['@sdkwork/auth-runtime-pc-react'] ?? '',
  /workspace:\*/u,
  'sdkwork-birdcoder-infrastructure must consume the high-level appbase PC auth runtime factory.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@sdkwork/iam-sdk-adapter'],
  undefined,
  'sdkwork-birdcoder-infrastructure must not depend on the low-level IAM SDK adapter directly.',
);
for (const dependencyName of [
  '@sdkwork/appbase-app-sdk',
  '@sdkwork/appbase-backend-sdk',
  '@sdkwork/drive-app-sdk',
  '@sdkwork/messaging-app-sdk',
  '@sdkwork/sdk-common',
]) {
  assertMatch(
    infrastructurePackageJson.dependencies?.[dependencyName] ?? '',
    /workspace:\*/u,
    `sdkwork-birdcoder-infrastructure must declare ${dependencyName} directly for standard multi-SDK runtime composition.`,
  );
}

assertMatch(
  authPageSource,
  /SdkworkIamAuthRoutes/u,
  'BirdCoder AuthPage must render the canonical SDKWork IAM auth routes.',
);
assertMatch(
  authPageSource,
  /getRuntime=\{getRuntime\}/u,
  'BirdCoder AuthPage must receive the IAM runtime from its integration boundary.',
);
assertMatch(
  iamIntegrationSource,
  /loadAuthPage\(\{ getRuntime: getBirdCoderIamRuntime \}\)/u,
  'BirdCoder IAM integration must inject the generated-SDK backed IAM runtime into the auth page loader.',
);
assertNoMatch(
  authPageSource,
  /createSdkworkCanonicalAuthSurfacePage|@sdkwork\/user-center-pc-react/u,
  'BirdCoder AuthPage must not render the retired user-center auth surface.',
);
assertMatch(
  authSurfaceSource,
  /createSdkworkIamRuntimeAuthController/u,
  'BirdCoder auth surface must expose an IAM runtime auth controller.',
);
assertNoMatch(
  authSurfaceSource,
  /createSdkworkCanonicalAuthController|createSdkworkSyntheticAuthSession|resolveBirdCoderRuntimeUserCenterProviderKind/u,
  'BirdCoder auth surface must not synthesize local user-center sessions.',
);

for (const requiredPath of [
  'packages/sdkwork-birdcoder-infrastructure/src/services/appSessionToken.ts',
  'packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts',
  'packages/sdkwork-birdcoder-infrastructure/src/services/sessionService.ts',
]) {
  assert.equal(fs.existsSync(path.join(rootDir, requiredPath)), true, `${requiredPath} is required.`);
}

assertMatch(
  infrastructureIndexSource,
  /services\/iamRuntime/u,
  'sdkwork-birdcoder-infrastructure must export the IAM runtime boundary.',
);
assertMatch(
  infrastructureIndexSource,
  /services\/sessionService/u,
  'sdkwork-birdcoder-infrastructure must export the IAM session service boundary.',
);
assertNoMatch(
  infrastructureIndexSource,
  /userCenterRuntimeBridge/u,
  'sdkwork-birdcoder-infrastructure must not export the retired user-center runtime bridge.',
);
assertMatch(
  sdkClientsSource,
  /handleBirdCoderSdkSessionAuthError/u,
  'BirdCoder SDK client factory must clear IAM session state on SDK auth errors.',
);
assertNoMatch(
  sdkClientsSource,
  /getStoredAppSessionAuthToken|getStoredAppSessionAccessToken/u,
  'BirdCoder generated SDK client factories must not read stored tokens; token hydration belongs to the IAM tokenStore and global TokenManager.',
);
assertNoMatch(
  sdkClientsSource,
  /accessToken:\s*options\.accessToken\s*\?\?\s*getStoredAppSessionAccessToken\(\)|authToken:\s*options\.authToken\s*\?\?\s*getStoredAppSessionAuthToken\(\)/u,
  'BirdCoder generated SDK constructors must not inject persisted tokens as constructor defaults.',
);
assertMatch(
  sdkClientsSource,
  /setTokenManager\(manager/u,
  'BirdCoder generated SDK compatibility clients must expose setTokenManager for appbase IAM runtime binding.',
);
assertNoMatch(
  sdkClientsSource,
  /import\(['"]\.\/iamRuntime\.ts['"]\)/u,
  'BirdCoder SDK client factory must not dynamically import the IAM runtime; IAM runtime reset is owned by the IAM runtime session-change listener.',
);
assertMatch(
  iamRuntimeSource,
  /from ['"]@sdkwork\/appbase-app-sdk['"]/u,
  'BirdCoder IAM runtime must construct the appbase app SDK client, not use the product app SDK as the login authority.',
);
assertMatch(
  iamRuntimeSource,
  /from ['"]@sdkwork\/appbase-backend-sdk['"]/u,
  'BirdCoder IAM runtime must construct the appbase backend SDK client for backend IAM resources.',
);
assertMatch(
  iamRuntimeSource,
  /from ['"]@sdkwork\/auth-runtime-pc-react['"]/u,
  'BirdCoder IAM runtime must consume the high-level appbase PC auth runtime factory.',
);
assertMatch(
  iamRuntimeSource,
  /createSdkworkAppbasePcAuthRuntime/u,
  'BirdCoder IAM runtime must use createSdkworkAppbasePcAuthRuntime instead of product-local low-level IAM wiring.',
);
assertMatch(
  iamRuntimeSource,
  /from ['"]@sdkwork\/drive-app-sdk['"]/u,
  'BirdCoder IAM runtime must compose the Drive app SDK as a dependency SDK client.',
);
assertMatch(
  iamRuntimeSource,
  /from ['"]@sdkwork\/messaging-app-sdk['"]/u,
  'BirdCoder IAM runtime must compose the Messaging app SDK as the verification-code dependency SDK client.',
);
assertMatch(
  iamRuntimeSource,
  /getBirdCoderGlobalTokenManager/u,
  'BirdCoder IAM runtime must use one explicit global TokenManager for the authenticated session context.',
);
assertMatch(
  iamRuntimeSource,
  /createSdkworkAppbasePcAuthRuntime\(\{[\s\S]*createAppbaseAppClient[\s\S]*createAppbaseBackendClient[\s\S]*sdkClients:\s*\[[\s\S]*birdcoderApp[\s\S]*birdcoderBackend[\s\S]*driveApp[\s\S]*messagingApp[\s\S]*tokenManager/u,
  'BirdCoder IAM runtime must pass appbase factories and BirdCoder, Drive, and Messaging downstream SDK clients to the high-level appbase runtime.',
);
assertNoMatch(
  iamRuntimeSource,
  /@sdkwork\/iam-sdk-adapter|createIamSdkAdapters|createIamAppSdkAdapter|createIamBackendSdkAdapter|createIamRuntime\(/u,
  'BirdCoder IAM runtime must not import IAM SDK adapters or call createIamRuntime directly in product code.',
);
assertMatch(
  iamRuntimeSource,
  /tokenManager,/u,
  'BirdCoder IAM runtime must pass the same explicit TokenManager to the appbase auth runtime factory.',
);
assertNoMatch(
  iamRuntimeSource,
  /clients:\s*\{[\s\S]*\bapp:\s*createBirdCoderIamAppClientForSdkworkIamRuntime|clients:\s*\{[\s\S]*\bbackend:\s*getBirdCoderGeneratedBackendSdkClient/u,
  'BirdCoder IAM runtime must not use the retired clients.app/backend shape or product SDK as the appbase login authority.',
);
assertNoMatch(
  defaultServicesSource,
  /createBirdCoderGeneratedUserCenterApiClient|resolveRuntimeUserCenterClient|userCenterRuntimeBridge/u,
  'Default IDE services must not bootstrap BirdCoder user-center clients after IAM runtime migration.',
);

const forbiddenRuntimeFiles = [
  'packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts',
  'packages/sdkwork-birdcoder-core/src/userCenterSession.ts',
];
for (const relativePath of forbiddenRuntimeFiles) {
  assert.equal(
    fs.existsSync(path.join(rootDir, relativePath)),
    false,
    `${relativePath} must be removed; IAM token/session storage is owned by appSessionToken.ts.`,
  );
}

console.log('birdcoder IAM runtime standard contract passed.');
