import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const componentSpecPath = 'apps/sdkwork-birdcoder-flutter-mobile/sdks/specs/component.spec.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const componentSpec = readJson(componentSpecPath);
const dependencies = componentSpec.contracts?.sdkDependencies ?? [];
const appSurface = dependencies.find((dependency) => dependency.surface === 'app');
const adminSurface = dependencies.find((dependency) => dependency.surface === 'backend-admin');

assert.ok(appSurface, 'Flutter mobile SDK assembly must declare an app surface.');
assert.ok(adminSurface, 'Flutter mobile SDK assembly must declare a backend-admin surface.');

assert.equal(appSurface.consumerPackageName, 'sdkwork_birdcoder_flutter_mobile_core');
assert.equal(adminSurface.consumerPackageName, 'sdkwork_birdcoder_flutter_mobile_admin_core');

assert.match(
  appSurface.manifestPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-app-sdk\/sdk-manifest\.json/u,
  'Flutter app surface must consume the canonical PC-generated app SDK family.',
);
assert.match(
  adminSurface.manifestPath ?? '',
  /sdkwork-birdcoder-pc\/sdks\/sdkwork-birdcoder-backend-sdk\/sdk-manifest\.json/u,
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
    fs.existsSync(path.join(rootDir, consumerPath, 'sdk-manifest.json')),
    true,
    `${consumerPath} must provide sdk-manifest.json metadata.`,
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

console.log('flutter sdk dependency contract passed.');
