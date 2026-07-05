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

const bootstrapSource = read('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/iam.rs');
const apiServerCargo = read('crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml');
const workspaceCargo = read('Cargo.toml');
const topologySource = read('scripts/lib/birdcoder-topology.mjs');
const sharedBootstrapSource = read(
  'crates/sdkwork-iam-web-adapter/src/embedded_bootstrap.rs',
  iamRepoRoot,
);

assert.match(
  bootstrapSource,
  /ensure_tenant_application_from_app_root/u,
  'Birdcoder IAM bootstrap must delegate to the shared embedded bootstrap crate.',
);

assert.match(
  bootstrapSource,
  /resolve_birdcoder_app_root/u,
  'Birdcoder IAM bootstrap must provision tenant applications from the BirdCoder repository manifest.',
);

assert.match(
  bootstrapSource,
  /ensure_birdcoder_tenant_application_bootstrap/u,
  'Birdcoder IAM wiring must provision tenant applications before building the IAM router.',
);

assert.match(
  bootstrapSource,
  /bootstrap_iam_database_from_env/u,
  'Birdcoder IAM wiring must bootstrap IAM schema before tenant application provisioning.',
);

assert.match(
  apiServerCargo,
  /sdkwork_iam_embedded_application_bootstrap/u,
  'API server must depend on sdkwork-iam-embedded-application-bootstrap.',
);

assert.match(
  workspaceCargo,
  /sdkwork-iam-embedded-application-bootstrap/u,
  'Workspace must include sdkwork-iam-embedded-application-bootstrap.',
);

assert.match(
  topologySource,
  /SDKWORK_APP_ROOT:\s*REPO_ROOT/u,
  'Dev topology must inject SDKWORK_APP_ROOT for embedded IAM bootstrap.',
);

assert.match(
  topologySource,
  /SDKWORK_IAM_APP_ROOT:\s*IAM_REPO_ROOT/u,
  'Dev topology must export SDKWORK_IAM_APP_ROOT at the sdkwork-iam repository root for IMF catalog materialization.',
);

assert.match(
  sharedBootstrapSource,
  /SDKWORK_BIRDCODER_APP_ROOT/u,
  'Shared embedded bootstrap must resolve SDKWORK_BIRDCODER_APP_ROOT.',
);

console.log('sdkwork-birdcoder IAM application bootstrap standard passed.');
