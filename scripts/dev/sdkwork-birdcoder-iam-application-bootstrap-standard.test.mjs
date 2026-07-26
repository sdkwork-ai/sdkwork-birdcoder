import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const gatewayProfileSource = read(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/profile.rs',
);
const gatewayCargo = read('crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml');
const workspaceCargo = read('Cargo.toml');
const developmentTopology = read('etc/topology/standalone.development.env');
const flutterRunnerSource = read('scripts/run-flutter-mobile-command.mjs');
const topology = JSON.parse(read('specs/topology.spec.json'));
const surfaceManifestPaths = [
  'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-h5/sdkwork.app.config.json',
  'apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json',
];

assert.match(
  gatewayProfileSource,
  /sdkwork_api_iam_assembly::assemble_app_api_contribution\(\)/u,
  'BirdCoder must mount IAM through the IAM-owned App API assembly entrypoint.',
);
assert.match(
  gatewayCargo,
  /sdkwork-api-iam-assembly\.workspace\s*=\s*true/u,
  'BirdCoder gateway must depend on the IAM-owned assembly.',
);
assert.match(
  workspaceCargo,
  /sdkwork-api-iam-assembly\s*=\s*\{\s*path\s*=\s*"\.\.\/sdkwork-iam\/crates\/sdkwork-api-iam-assembly"\s*\}/u,
  'BirdCoder workspace must resolve the IAM assembly from the canonical IAM repository.',
);

assert.match(
  developmentTopology,
  /^SDKWORK_APP_ROOT=\.$/mu,
  'BirdCoder must provide its repository root through the generic IAM application-root contract.',
);
assert.doesNotMatch(
  gatewayProfileSource,
  /INSERT\s+INTO\s+iam_(?:application_template|tenant_application)/iu,
  'BirdCoder gateway must not own IAM application registry SQL.',
);

const surfaceAppIds = surfaceManifestPaths.map((manifestPath) => {
  const manifest = JSON.parse(read(manifestPath));
  assert.equal(
    manifest.backend?.appId,
    manifest.app?.key,
    `${manifestPath} must declare one canonical surface app identity.`,
  );
  return manifest.backend.appId;
});
assert.equal(
  new Set(surfaceAppIds).size,
  surfaceAppIds.length,
  'Every BirdCoder credential-entry surface must have a distinct backend.appId.',
);

assert.match(
  flutterRunnerSource,
  /@sdkwork\/iam-credential-entry\/node-bootstrap/u,
  'Flutter development must consume the public IAM credential-entry package.',
);
assert.match(
  flutterRunnerSource,
  /apps\/sdkwork-birdcoder-flutter-mobile\/sdkwork\.app\.config\.json/u,
  'Flutter development must select its own surface manifest explicitly.',
);

const standaloneDevelopmentProcesses =
  topology.orchestration.profiles['standalone.development'].processes;
for (const [runtimeTarget, clientArchitecture, expectedApplicationRoot] of [
  ['browser', 'pc-web', 'apps/sdkwork-birdcoder-pc'],
  ['browser', 'h5', 'apps/sdkwork-birdcoder-h5'],
  ['flutter-android', 'flutter', 'apps/sdkwork-birdcoder-flutter-mobile'],
  ['flutter-ios', 'flutter', 'apps/sdkwork-birdcoder-flutter-mobile'],
]) {
  assert.ok(
    standaloneDevelopmentProcesses.some((processEntry) =>
      processEntry.role === 'client'
      && processEntry.applicationRoot === expectedApplicationRoot
      && processEntry.clientArchitectures?.includes(clientArchitecture)
      && processEntry.runtimeTargets?.includes(runtimeTarget)),
    `${runtimeTarget}/${clientArchitecture} startup must bind token generation to ${expectedApplicationRoot}.`,
  );
}

console.log('sdkwork-birdcoder IAM application bootstrap standard passed.');
