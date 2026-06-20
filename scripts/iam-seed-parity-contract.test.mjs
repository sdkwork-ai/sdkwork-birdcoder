import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const appbaseRoot = path.resolve(workspaceRoot, '..', 'sdkwork-appbase');

function readText(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const birdCoderServerCargoSource = readText(
  workspaceRoot,
  'crates/sdkwork-birdcoder-api-server/Cargo.toml',
);
const apiServerIamBootstrapSource = readText(
  workspaceRoot,
  'crates/sdkwork-birdcoder-api-server/src/bootstrap/iam.rs',
);
const appbaseIamContextSource = readText(
  appbaseRoot,
  'crates/sdkwork-iam-context-service/src/lib.rs',
);
const appbaseIamDirectoryRepositorySource = readText(
  appbaseRoot,
  'crates/sdkwork-iam-directory-repository-sqlx/src/lib.rs',
);
const appbaseIamRouterSource = [
  readText(appbaseRoot, 'crates/sdkwork-router-iam-app-api/src/handlers.rs'),
  readText(appbaseRoot, 'crates/sdkwork-router-iam-app-api/src/directory.rs'),
  readText(appbaseRoot, 'crates/sdkwork-router-iam-app-api/src/tokens.rs'),
].join('\n');

for (const [requiredDependencyName, pattern] of [
  [
    'sdkwork_router_iam_app_api',
    /^sdkwork_router_iam_app_api = \{ workspace = true \}/mu,
  ],
  [
    'sdkwork_iam_web_adapter',
    /^sdkwork_iam_web_adapter(?:\.workspace = true| = \{ workspace = true \})/mu,
  ],
]) {
  assert.match(
    birdCoderServerCargoSource,
    pattern,
    `BirdCoder api-server must depend on the standard ${requiredDependencyName} crate.`,
  );
}

assert.match(
  apiServerIamBootstrapSource,
  /sdkwork_router_iam_app_api::build_sdkwork_appbase_app_api_router/u,
  'BirdCoder api-server IAM bootstrap must wire the standard appbase IAM app router.',
);

for (const requiredIamCorePattern of [
  /pub struct IamAppContext/u,
  /pub struct IamSessionTokens/u,
  /pub fn validate_dual_token_context/u,
  /pub enum DeploymentMode/u,
]) {
  assert.match(
    appbaseIamContextSource,
    requiredIamCorePattern,
    'sdkwork-appbase IAM context service must publish the standard dual-token context contract.',
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
  /pub fn iam_initial_migration_sql\(\) -> &'static str/u,
]) {
  assert.match(
    appbaseIamDirectoryRepositorySource,
    requiredIamStoragePattern,
    'sdkwork-appbase IAM directory repository crate must publish standard IAM bootstrap and table contracts.',
  );
}

for (const forbiddenIamStoragePattern of [
  /DEFAULT_IAM_TENANT/u,
  /DEFAULT_IAM_ORGANIZATION/u,
  /DEFAULT_BOOTSTRAP_ADMIN/u,
]) {
  assert.doesNotMatch(
    appbaseIamDirectoryRepositorySource,
    forbiddenIamStoragePattern,
    'sdkwork-appbase IAM directory repository crate must not publish default bootstrap seed data.',
  );
}

for (const forbiddenBirdCoderIamPattern of [
  /SDKWORK_IAM_BOOTSTRAP_/u,
  /SDKWORK_APP_ID/u,
]) {
  assert.doesNotMatch(
    apiServerIamBootstrapSource,
    forbiddenBirdCoderIamPattern,
    'BirdCoder api-server IAM bootstrap must not publish bootstrap identity env injection.',
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
    appbaseIamRouterSource,
    forbiddenBirdCoderIamPattern,
    `Standard appbase IAM router must not own VIP, billing, membership, or bootstrap identity env injection ${forbiddenBirdCoderIamPattern}.`,
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
  'Retired BirdCoder local IAM authority archive must be removed after appbase router migration.',
);

console.log('birdcoder IAM seed parity contract passed.');
