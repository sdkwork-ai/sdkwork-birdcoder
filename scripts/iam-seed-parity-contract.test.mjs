import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function readText(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function resolveCargoWorkspaceCrateRoot(cargoTomlSource, dependencyKey) {
  const pattern = new RegExp(
    `^${dependencyKey}\\s*=\\s*\\{[^\\}]*path\\s*=\\s*"([^"]+)"`,
    'mu',
  );
  const match = cargoTomlSource.match(pattern);
  assert.ok(
    match,
    `Cargo.toml must declare ${dependencyKey} with a workspace path for IAM seed parity checks.`,
  );
  return path.resolve(workspaceRoot, match[1]);
}

const birdCoderCargoSource = readText(workspaceRoot, 'Cargo.toml');
const birdCoderServerCargoSource = readText(
  workspaceRoot,
  'crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml',
);
const apiServerIamBootstrapSource = readText(
  workspaceRoot,
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/iam.rs',
);
const apiServerRoutersSource = readText(
  workspaceRoot,
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/routers.rs',
);

const iamContextCrateRoot = resolveCargoWorkspaceCrateRoot(
  birdCoderCargoSource,
  'sdkwork_iam_context_service',
);
const iamDirectoryRepositoryCrateRoot = resolveCargoWorkspaceCrateRoot(
  birdCoderCargoSource,
  'sdkwork_iam_directory_repository_sqlx',
);
const iamAppRouterCrateRoot = resolveCargoWorkspaceCrateRoot(
  birdCoderCargoSource,
  'sdkwork_routes_iam_app_api',
);

const iamContextSource = readText(iamContextCrateRoot, 'src/lib.rs');
const iamDirectoryRepositorySource = readText(iamDirectoryRepositoryCrateRoot, 'src/lib.rs');
const iamRouterSource = [
  readText(iamAppRouterCrateRoot, 'src/handlers.rs'),
  readText(iamAppRouterCrateRoot, 'src/directory.rs'),
  readText(iamAppRouterCrateRoot, 'src/tokens.rs'),
].join('\n');

for (const [requiredDependencyName, pattern] of [
  [
    'sdkwork_routes_iam_app_api',
    /^sdkwork_routes_iam_app_api = \{ workspace = true \}/mu,
  ],
  [
    'sdkwork_routes_iam_backend_api',
    /^sdkwork_routes_iam_backend_api = \{ workspace = true \}/mu,
  ],
  [
    'sdkwork_iam_web_adapter',
    /^sdkwork_iam_web_adapter(?:\.workspace = true| = \{ workspace = true \})/mu,
  ],
]) {
  assert.match(
    birdCoderServerCargoSource,
    pattern,
    `BirdCoder standalone-gateway must depend on the standard ${requiredDependencyName} crate.`,
  );
}

assert.match(
  apiServerIamBootstrapSource,
  /sdkwork_routes_iam_app_api::build_sdkwork_iam_app_api_router/u,
  'BirdCoder standalone-gateway IAM bootstrap must wire the standard sdkwork-iam app router.',
);
assert.match(
  apiServerIamBootstrapSource,
  /sdkwork_iam_database_host::bootstrap_iam_database_from_env\(\)/u,
  'BirdCoder standalone-gateway IAM bootstrap must delegate IAM lifecycle bootstrap to the platform database host before tenant application provisioning.',
);
assert.doesNotMatch(
  apiServerIamBootstrapSource,
  /bootstrap_iam_database_from_birdcoder_profile/u,
  'BirdCoder standalone-gateway IAM bootstrap must not recreate platform IAM database lifecycle in an app-local profile helper.',
);
assert.match(
  apiServerIamBootstrapSource,
  /ensure_birdcoder_tenant_application_bootstrap/u,
  'BirdCoder standalone-gateway IAM bootstrap must provision tenant applications before building the IAM router.',
);
assert.match(
  apiServerIamBootstrapSource,
  /ensure_tenant_application_from_app_root\(\s*bootstrap\.app_root\.as_path\(\)/su,
  'BirdCoder standalone-gateway IAM bootstrap must delegate the selected BirdCoder root to the shared embedded bootstrap crate.',
);
assert.doesNotMatch(
  apiServerIamBootstrapSource,
  /resolve_application_app_root_with_fallback/u,
  'BirdCoder must not let the generic embedded bootstrap resolver select SDKWORK_IAM_APP_ROOT as its application root.',
);
assert.match(
  apiServerIamBootstrapSource,
  /sdkwork_routes_iam_backend_api::build_sdkwork_iam_backend_api_router_from_env/u,
  'BirdCoder standalone-gateway IAM bootstrap must wire the standard sdkwork-iam backend router.',
);
assert.match(
  apiServerRoutersSource,
  /wire_iam_routers/u,
  'BirdCoder standalone-gateway router assembly must merge federated sdkwork-iam app and backend routers.',
);

for (const requiredIamCorePattern of [
  /pub struct IamAppContext/u,
  /pub struct IamSessionTokens/u,
  /pub fn validate_dual_token_context/u,
  /pub enum DeploymentMode/u,
]) {
  assert.match(
    iamContextSource,
    requiredIamCorePattern,
    'sdkwork-iam context service must publish the standard dual-token context contract.',
  );
}

for (const requiredIamStoragePattern of [
  /pub struct IamTables/u,
  /pub const TENANT: &'static str = "iam_tenant"/u,
  /pub const TENANT_MEMBER: &'static str = "iam_tenant_member"/u,
  /pub const TENANT_SIGNING_KEY: &'static str = "iam_tenant_signing_key"/u,
  /pub const ORGANIZATION_MEMBERSHIP: &'static str = "iam_organization_membership"/u,
  /pub const USER: &'static str = "iam_user"/u,
  /pub const SESSION: &'static str = "iam_session"/u,
  /pub const AUDIT_EVENT: &'static str = "iam_audit_event"/u,
  /pub fn iam_database_tables\(\) -> Vec<&'static str>/u,
  /pub fn iam_database_baseline_sql\(\) -> &'static str/u,
]) {
  assert.match(
    iamDirectoryRepositorySource,
    requiredIamStoragePattern,
    'sdkwork-iam directory repository crate must publish standard IAM bootstrap and table contracts.',
  );
}

for (const forbiddenIamStoragePattern of [
  /DEFAULT_IAM_TENANT/u,
  /DEFAULT_IAM_ORGANIZATION/u,
  /DEFAULT_BOOTSTRAP_ADMIN/u,
]) {
  assert.doesNotMatch(
    iamDirectoryRepositorySource,
    forbiddenIamStoragePattern,
    'sdkwork-iam directory repository crate must not publish default bootstrap seed data.',
  );
}

for (const forbiddenBirdCoderIamPattern of [
  /SDKWORK_IAM_BOOTSTRAP_/u,
  /SDKWORK_APP_ID/u,
]) {
  assert.doesNotMatch(
    apiServerIamBootstrapSource,
    forbiddenBirdCoderIamPattern,
    'BirdCoder standalone-gateway IAM bootstrap must not publish bootstrap identity env injection.',
  );
}

for (const forbiddenBirdCoderIamPattern of [
  /CREATE TABLE IF NOT EXISTS iam_membership/u,
  /\bIamMembershipPayload\b/u,
  /\bUpdateIamMembershipRequest\b/u,
  /\bread_membership\b/u,
  /\bupdate_membership\b/u,
  /membership_level_id/u,
  /SDKWORK_IAM_BOOTSTRAP_/u,
]) {
  assert.doesNotMatch(
    iamRouterSource,
    forbiddenBirdCoderIamPattern,
    `Standard sdkwork-iam app router must not own VIP, billing, membership, or bootstrap identity env injection ${forbiddenBirdCoderIamPattern}.`,
  );
}

assert.equal(
  fs.existsSync(
    path.join(
      workspaceRoot,
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/legacy-archive/iam_authority.rs',
    ),
  ),
  false,
  'Retired BirdCoder local IAM authority archive must be removed after sdkwork-iam router migration.',
);

console.log('birdcoder IAM seed parity contract passed.');
