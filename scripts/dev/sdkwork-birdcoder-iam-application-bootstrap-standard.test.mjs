import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const iamRepoRoot = path.resolve(repoRoot, '..', 'sdkwork-iam');

function read(relativePath, root = repoRoot) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const gatewayProfileSource = read(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/profile.rs',
);
const gatewayCargo = read('crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml');
const workspaceCargo = read('Cargo.toml');
const developmentTopology = read('etc/topology/standalone.development.env');
const iamAssemblySource = read('crates/sdkwork-api-iam-assembly/src/bootstrap.rs', iamRepoRoot);
const sharedBootstrapSource = read(
  'crates/sdkwork-iam-web-adapter/src/embedded_bootstrap.rs',
  iamRepoRoot,
);
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

const iamApplicationBootstrapStart = iamAssemblySource.indexOf(
  'async fn bootstrap_iam_application_state',
);
assert.notEqual(
  iamApplicationBootstrapStart,
  -1,
  'IAM assembly must own application-scoped persistence bootstrap.',
);
const iamApplicationBootstrapSource = iamAssemblySource.slice(iamApplicationBootstrapStart);
assert.match(
  iamApplicationBootstrapSource,
  /bootstrap_iam_database_from_env\(\)[\s\S]*ensure_tenant_application_from_app_root_with_env_and_fallback/u,
  'IAM schema bootstrap must complete before tenant applications are provisioned.',
);
assert.match(
  iamApplicationBootstrapSource,
  /std::env::current_dir\(\)/u,
  'IAM assembly must use the consuming application working directory as its fallback root.',
);

for (const appRootKey of ['SDKWORK_APP_ROOT', 'SDKWORK_BIRDCODER_APP_ROOT']) {
  assert.match(
    developmentTopology,
    new RegExp(`^${appRootKey}=\\.$`, 'mu'),
    `BirdCoder development topology must inject ${appRootKey} at the repository root.`,
  );
  assert.match(
    sharedBootstrapSource,
    new RegExp(`"${appRootKey}"`, 'u'),
    `Shared embedded bootstrap must resolve ${appRootKey}.`,
  );
}

assert.match(
  sharedBootstrapSource,
  /discover_application_manifest_roots/u,
  'Shared embedded bootstrap must discover root and surface application manifests.',
);
assert.match(
  sharedBootstrapSource,
  /ensure_tenant_applications_on_pool/u,
  'Shared embedded bootstrap must delegate persistence to the canonical IAM registry service.',
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
  /mergeRepoDevBootstrapAccessTokenEnv/u,
  'Flutter development must use the canonical IAM bootstrap token generator.',
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
