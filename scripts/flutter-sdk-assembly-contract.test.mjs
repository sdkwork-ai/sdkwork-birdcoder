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
const appApiDependency = dependencies.find(
  (dependency) => dependency.surface === 'app-api',
);

assert.ok(
  appApiDependency,
  'Flutter mobile SDK assembly must declare the BirdCoder app-api dependency.',
);
assert.equal(
  dependencies.length,
  1,
  'Flutter local SDK consumer workspace must generate only the BirdCoder App SDK family.',
);

assert.equal(
  appApiDependency.consumerPackageName,
  'sdkwork_birdcoder_flutter_mobile_core',
);

assert.match(
  appApiDependency.manifestPath ?? '',
  /\.\.\/\.\.\/\.\.\/\.\.\/sdks\/sdkwork-birdcoder-app-sdk\/sdk-manifest\.json/u,
  'Flutter app surface must consume the application-root App SDK family.',
);

assert.match(
  appApiDependency.dartConsumerPath ?? '',
  /sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/u,
  'Flutter app surface must declare a local Dart consumer assembly package.',
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
for (const consumerPath of [
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer',
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
    /\.\.\/\.\.\/\.\.\/\.\.\/sdks\/sdkwork-birdcoder-app-sdk\/openapi\/sdkwork-birdcoder-app-api\.sdkgen\.json/u,
    `${consumerPath} must consume the application-root sdkgen input instead of forking local specs.`,
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

assert.equal(
  fs.existsSync(
    path.join(
      rootDir,
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer',
    ),
  ),
  false,
  'Flutter must not retain a BirdCoder Backend SDK consumer assembly.',
);

assert.equal(
  componentSpec.component?.name,
  'sdkwork-birdcoder-flutter-mobile-sdk-consumer-workspace',
);
assert.equal(componentSpec.component?.surface, 'app');
assert.equal(componentSpec.contracts?.layerRole, 'sdk-facade');
assert.deepEqual(componentSpec.contracts?.dependencyApiExports, []);

console.log('Flutter App-only SDK dependency contract passed.');
