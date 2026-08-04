import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const generatorSource = read('scripts/generate-birdcoder-flutter-mobile-sdk-family.mjs');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

// BirdCoder owns exactly one App SDK authority (root PRD: App API = 4 System
// operations; Backend API and Open API each contain zero BirdCoder
// operations). The Flutter mobile family consumes the canonical root
// `sdks/sdkwork-birdcoder-app-sdk` authority; the retired backend consumer
// assembly stays removed.
const consumerPath =
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer';
const retiredBackendConsumerPath =
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer';

assert.equal(
  fs.existsSync(path.join(rootDir, consumerPath, 'sdk-manifest.json')),
  true,
  `${consumerPath} must provide sdk-manifest.json metadata.`,
);
const manifest = JSON.parse(read(`${consumerPath}/sdk-manifest.json`));
assert.ok(manifest.generationInputSpec, `${consumerPath} must declare a canonical generation input spec.`);
assert.match(
  manifest.generationInputSpec,
  /sdks\/sdkwork-birdcoder-app-sdk\/openapi/u,
  `${consumerPath} must consume the canonical root App SDK OpenAPI authority instead of forking local specs.`,
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
assert.equal(
  fs.existsSync(path.join(rootDir, retiredBackendConsumerPath)),
  false,
  'The retired backend SDK consumer assembly must stay removed: BirdCoder owns no Backend API surface.',
);

assert.match(
  generatorSource,
  /SUPPORTED_LANGUAGES = new Set\(\['flutter', 'dart'\]\)/u,
  'Flutter mobile SDK generation must support flutter and dart sdkgen languages.',
);
assert.match(
  generatorSource,
  /apiAuthority: 'sdkwork-birdcoder-app-api'/u,
  'Flutter mobile SDK generation must target the canonical app OpenAPI sdkgen input.',
);
assert.match(
  generatorSource,
  /sdkgenType: 'app'/u,
  'Flutter mobile SDK generation must map the app surface to sdkgen app type.',
);
assert.doesNotMatch(
  generatorSource,
  /backend-api|sdkgenType: 'backend'/u,
  'Flutter mobile SDK generation must not target a backend OpenAPI surface BirdCoder does not own.',
);
assert.match(
  generatorSource,
  /familyManifest\.generationInputSpec/u,
  'Flutter mobile SDK generation must resolve canonical OpenAPI sdkgen inputs from family manifests.',
);

console.log('flutter mobile sdk generation contract passed.');
