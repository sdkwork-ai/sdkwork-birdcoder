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
  'packages/sdkwork-birdcoder-server/src-host/src/iam_authority.rs',
);
const birdCoderServerCargoSource = readText(
  workspaceRoot,
  'packages/sdkwork-birdcoder-server/src-host/Cargo.toml',
);
const appbaseIamCoreSource = readText(
  appbaseRoot,
  'packages/native-rust/iam/sdkwork-iam-core-rust/src/lib.rs',
);
const appbaseIamStorageSource = readText(
  appbaseRoot,
  'packages/native-rust/iam/sdkwork-iam-storage-sqlx-rust/src/lib.rs',
);

for (const requiredDependencyName of [
  'sdkwork_iam_core',
  'sdkwork_iam_http',
  'sdkwork_iam_storage_sqlx',
  'sdkwork_iam_tauri',
]) {
  assert.match(
    birdCoderServerCargoSource,
    new RegExp(`^${requiredDependencyName} = \\{ path = `, 'mu'),
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
    appbaseIamCoreSource,
    requiredIamCorePattern,
    'sdkwork-appbase IAM core must publish the standard dual-token context contract.',
  );
}

for (const requiredIamStoragePattern of [
  /pub struct IamTables/u,
  /pub const DEFAULT_IAM_TENANT_ID: &str/u,
  /pub const DEFAULT_IAM_ORGANIZATION_ID: &str/u,
  /pub const DEFAULT_BOOTSTRAP_ADMIN_EMAIL: &str/u,
  /pub fn iam_database_tables\(\) -> Vec<&'static str>/u,
  /pub fn iam_initial_migration_sql\(\) -> &'static str/u,
]) {
  assert.match(
    appbaseIamStorageSource,
    requiredIamStoragePattern,
    'sdkwork-appbase IAM storage crate must publish standard IAM bootstrap and table contracts.',
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
