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

const birdCoderIamAuthoritySource = readText(
  workspaceRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/iam_authority.rs',
);
const birdCoderServerCargoSource = readText(
  workspaceRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/Cargo.toml',
);
const appbaseIamContextSource = readText(
  appbaseRoot,
  'crates/sdkwork-iam-context-service/src/lib.rs',
);
const appbaseIamDirectoryRepositorySource = readText(
  appbaseRoot,
  'crates/sdkwork-iam-directory-repository-sqlx/src/lib.rs',
);

for (const requiredDependencyName of [
  'sdkwork_iam_context_service',
  'sdkwork_router_iam_app_api',
  'sdkwork_router_iam_backend_api',
  'sdkwork_iam_directory_repository_sqlx',
  'sdkwork_appbase_tauri_host',
]) {
  assert.match(
    birdCoderServerCargoSource,
    new RegExp(`^${requiredDependencyName} = \\{ workspace = true \\}`, 'mu'),
    `BirdCoder server host must depend on the standard ${requiredDependencyName} crate.`,
  );
}

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

for (const requiredBirdCoderIamPattern of [
  /const SDKWORK_IAM_MODE_ENV: &str = "SDKWORK_IAM_MODE";/u,
  /const SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL";/u,
  /const SDKWORK_IAM_LOCAL_BOOTSTRAP_PHONE_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_PHONE";/u,
  /const SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD";/u,
  /const SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED_ENV: &str = "SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED";/u,
  /const DEFAULT_APP_ID: &str = "sdkwork-birdcoder";/u,
  /enum IamMode/u,
  /fn local_authority_enabled\(self\) -> bool/u,
  /!matches!\(self, Self::Cloud\)/u,
  /CREATE TABLE IF NOT EXISTS iam_tenant/u,
  /CREATE TABLE IF NOT EXISTS iam_user/u,
  /CREATE TABLE IF NOT EXISTS iam_session/u,
  /CREATE TABLE IF NOT EXISTS iam_audit_event/u,
]) {
  assert.match(
    birdCoderIamAuthoritySource,
    requiredBirdCoderIamPattern,
    'BirdCoder IAM authority must use the standard IAM bootstrap, runtime mode, and table contract.',
  );
}

for (const forbiddenBirdCoderIamPattern of [
  /CREATE TABLE IF NOT EXISTS iam_membership/u,
  /\bIamMembershipPayload\b/u,
  /\bUpdateIamMembershipRequest\b/u,
  /\bread_membership\b/u,
  /\bupdate_membership\b/u,
  /membership_level_id/u,
]) {
  assert.doesNotMatch(
    birdCoderIamAuthoritySource,
    forbiddenBirdCoderIamPattern,
    `BirdCoder IAM authority must not own VIP, billing, or membership state ${forbiddenBirdCoderIamPattern}.`,
  );
}

console.log('birdcoder IAM seed parity contract passed.');
