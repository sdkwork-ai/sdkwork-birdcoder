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

const bootstrapSource = read('crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/iam.rs');
const apiServerCargo = read('crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml');
const workspaceCargo = read('Cargo.toml');
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
  /ensure_tenant_application_from_app_root\(\s*bootstrap\.app_root\.as_path\(\)/su,
  'BirdCoder must pass its selected application root to the shared embedded bootstrap helper.',
);

const birdCoderRootResolverStart = bootstrapSource.indexOf(
  'fn resolve_birdcoder_deployment_app_root',
);
assert.notEqual(
  birdCoderRootResolverStart,
  -1,
  'BirdCoder must own an application-scoped root resolver for its embedded IAM bootstrap.',
);
const birdCoderRootResolverSource = bootstrapSource.slice(
  birdCoderRootResolverStart,
  bootstrapSource.indexOf('async fn ensure_birdcoder_tenant_application_bootstrap'),
);
assert.match(
  birdCoderRootResolverSource,
  /SDKWORK_APP_ROOT/u,
  'BirdCoder root resolution must honor the generic consumer application root.',
);
assert.match(
  birdCoderRootResolverSource,
  /SDKWORK_BIRDCODER_APP_ROOT/u,
  'BirdCoder root resolution must honor its application-specific root.',
);
assert.doesNotMatch(
  birdCoderRootResolverSource,
  /SDKWORK_IAM_APP_ROOT/u,
  'BirdCoder root resolution must never select the sibling IAM catalog root.',
);
assert.doesNotMatch(
  bootstrapSource,
  /resolve_application_app_root_with_fallback/u,
  'BirdCoder must not delegate application-root selection to the multi-application fallback resolver.',
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
  /sdkwork_iam_database_host::bootstrap_iam_database_from_env\(\)/u,
  'BirdCoder must delegate IAM lifecycle bootstrap to the platform-owned database host.',
);
assert.doesNotMatch(
  bootstrapSource,
  /bootstrap_iam_database_from_birdcoder_profile/u,
  'BirdCoder must not recreate the IAM database-host lifecycle in an app-local helper.',
);
assert.doesNotMatch(
  bootstrapSource,
  /sdkwork_database_sqlx::create_pool_from_env/u,
  'BirdCoder must not create IAM pools outside the platform-owned database host.',
);
assert.doesNotMatch(
  bootstrapSource,
  /sdkwork_iam_database_host::bootstrap_iam_database\(pool\)/u,
  'BirdCoder must not invoke IAM lifecycle internals after constructing an app-local pool.',
);

const wireIamAppRouterStart = bootstrapSource.indexOf('pub async fn wire_iam_app_router');
assert.notEqual(
  wireIamAppRouterStart,
  -1,
  'BirdCoder IAM bootstrap must expose the IAM app router wiring function.',
);
const wireIamAppRouterSource = bootstrapSource.slice(wireIamAppRouterStart);
assert.match(
  wireIamAppRouterSource,
  /resolve_birdcoder_iam_bootstrap_config\(\)\s*;\s*sdkwork_iam_database_host::bootstrap_iam_database_from_env\(\)/su,
  'BirdCoder must use the platform IAM lifecycle before tenant application provisioning.',
);
assert.match(
  wireIamAppRouterSource,
  /bootstrap_iam_database_from_env\(\)[\s\S]*ensure_birdcoder_tenant_application_bootstrap/u,
  'BirdCoder must provision tenant applications only after IAM schema bootstrap completes.',
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
  sharedBootstrapSource,
  /SDKWORK_BIRDCODER_APP_ROOT/u,
  'Shared embedded bootstrap must resolve SDKWORK_BIRDCODER_APP_ROOT.',
);

console.log('sdkwork-birdcoder IAM application bootstrap standard passed.');
