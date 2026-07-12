import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const generatorSource = read('scripts/generate-birdcoder-flutter-mobile-sdk-family.mjs');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

for (const consumerPath of [
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer',
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, consumerPath, '.sdkwork-assembly.json')),
    false,
    `${consumerPath} must not keep retired consumer .sdkwork-assembly.json metadata.`,
  );
  const manifest = JSON.parse(read(`${consumerPath}/sdk-manifest.json`));
  assert.ok(manifest.generationInputSpec, `${consumerPath} must declare a canonical generation input spec.`);
  assert.match(
    manifest.generationInputSpec,
    /sdkwork-birdcoder-pc\/sdks/u,
    `${consumerPath} must consume PC OpenAPI authority instead of forking local specs.`,
  );
  assert.equal(
    manifest.standardProfile,
    'sdkwork-v3',
    `${consumerPath} must use the SDKWork v3 generator profile.`,
  );
  assert.match(
    manifest.metadata?.providerStandard?.generationScript ?? '',
    /generate-birdcoder-flutter-mobile-sdk-family\.mjs/u,
    `${consumerPath} must reference the Flutter mobile SDK generation script.`,
  );
}

assert.match(
  generatorSource,
  /SUPPORTED_LANGUAGES = new Set\(\['flutter', 'dart'\]\)/u,
  'Flutter mobile SDK generation must support flutter and dart sdkgen languages.',
);
assert.match(
  generatorSource,
  /pcApiAuthority: 'sdkwork-birdcoder-app-api'/u,
  'Flutter mobile SDK generation must target the canonical app OpenAPI sdkgen input.',
);
assert.match(
  generatorSource,
  /pcApiAuthority: 'sdkwork-birdcoder-backend-api'/u,
  'Flutter mobile SDK generation must target the canonical backend OpenAPI sdkgen input.',
);
assert.match(
  generatorSource,
  /sdkgenType: 'backend'/u,
  'Flutter mobile SDK generation must map backend-admin surfaces to sdkgen backend type.',
);
assert.match(
  generatorSource,
  /\.sdkgen\.json`/u,
  'Flutter mobile SDK generation must resolve canonical PC OpenAPI sdkgen inputs.',
);

console.log('flutter mobile sdk generation contract passed.');
