import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { LEGACY_ARCHIVE_RUST_PATHS } from './birdcoder-canonical-server-rust-sources.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const appbaseRoot = path.resolve(workspaceRoot, '..', 'sdkwork-appbase');

function readText(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const birdCoderIamAuthoritySource = readText(
  workspaceRoot,
  LEGACY_ARCHIVE_RUST_PATHS.iamAuthority,
);
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
    'BirdCoder legacy IAM authority archive must keep the standard IAM runtime mode and table contract.',
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
]) {
  assert.doesNotMatch(
    birdCoderIamAuthoritySource,
    forbiddenBirdCoderIamPattern,
    `BirdCoder IAM authority must not own VIP, billing, or membership state ${forbiddenBirdCoderIamPattern}.`,
  );
}

console.log('birdcoder IAM seed parity contract passed.');
