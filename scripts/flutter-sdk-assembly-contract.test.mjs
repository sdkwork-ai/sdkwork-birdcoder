import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const assemblyPath = 'apps/sdkwork-birdcoder-flutter-mobile/sdks/.sdkwork-assembly.json';
const componentSpecPath = 'apps/sdkwork-birdcoder-flutter-mobile/sdks/specs/component.spec.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const assembly = readJson(assemblyPath);
const componentSpec = readJson(componentSpecPath);

assert.equal(assembly.kind, 'sdkwork.sdk.assembly');
assert.equal(assembly.name, 'sdkwork-birdcoder-flutter-mobile-sdk-family');

const surfaces = assembly.surfaces ?? [];
const appSurface = surfaces.find((surface) => surface.surface === 'app');
const adminSurface = surfaces.find((surface) => surface.surface === 'backend-admin');

assert.ok(appSurface, 'Flutter mobile SDK assembly must declare an app surface.');
assert.ok(adminSurface, 'Flutter mobile SDK assembly must declare a backend-admin surface.');

assert.equal(appSurface.dependencyMode, 'consumer-sdk');
assert.equal(adminSurface.dependencyMode, 'consumer-sdk');
assert.equal(appSurface.composedPackageName, 'sdkwork_birdcoder_flutter_mobile_core');
assert.equal(adminSurface.composedPackageName, 'sdkwork_birdcoder_flutter_mobile_admin_core');

assert.match(
  appSurface.typescriptConsumerPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-app-sdk/u,
  'Flutter app surface must consume the canonical PC-generated app SDK family.',
);
assert.match(
  adminSurface.typescriptConsumerPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-backend-sdk/u,
  'Flutter backend-admin surface must consume the canonical PC-generated backend SDK family.',
);

assert.match(
  appSurface.dartConsumerPath ?? '',
  /sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/u,
  'Flutter app surface must declare a local Dart consumer assembly package.',
);
assert.match(
  adminSurface.dartConsumerPath ?? '',
  /sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/u,
  'Flutter backend-admin surface must declare a local Dart consumer assembly package.',
);

assert.equal(
  fs.existsSync(
    path.join(
      rootDir,
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/pubspec.yaml',
    ),
  ),
  true,
);
assert.equal(
  fs.existsSync(
    path.join(
      rootDir,
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/pubspec.yaml',
    ),
  ),
  true,
);

for (const consumerPath of [
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer',
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, consumerPath, '.sdkwork-assembly.json')),
    false,
    `${consumerPath} must not keep retired consumer .sdkwork-assembly.json metadata.`,
  );
  const consumerManifest = readJson(`${consumerPath}/sdk-manifest.json`);
  assert.ok(
    consumerManifest.generationInputSpec,
    `${consumerPath} must declare a canonical generation input spec.`,
  );
  assert.match(
    consumerManifest.generationInputSpec,
    /sdkwork-birdcoder-pc\/sdks/u,
    `${consumerPath} must consume PC OpenAPI authority instead of forking local specs.`,
  );
  assert.equal(
    consumerManifest.standardProfile,
    'sdkwork-v3',
    `${consumerPath} must use the SDKWork v3 generator profile.`,
  );
  assert.match(
    consumerManifest.metadata?.providerStandard?.generationScript ?? '',
    /generate-birdcoder-flutter-mobile-sdk-family\.mjs/u,
    `${consumerPath} must reference the Flutter mobile SDK generation script.`,
  );
}

assert.equal(componentSpec.ownerPackage, 'sdkwork_birdcoder_flutter_mobile_core');
assert.equal(componentSpec.adminOwnerPackage, 'sdkwork_birdcoder_flutter_mobile_admin_core');

console.log('flutter sdk assembly contract passed.');
