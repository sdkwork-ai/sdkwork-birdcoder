import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rustHostSourceDir = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'src',
);
const appbaseNativeSourceDir = path.join(
  rootDir,
  '..',
  'sdkwork-appbase',
  'packages',
  'pc-react',
  'iam',
  'sdkwork-user-center-core-pc-react',
  'native',
  'tauri-rust',
  'src',
);

const libSourcePath = path.join(rustHostSourceDir, 'lib.rs');
const localUserCenterSourcePath = path.join(rustHostSourceDir, 'user_center.rs');
const localUserCenterValidationSourcePath = path.join(
  rustHostSourceDir,
  'user_center_validation.rs',
);
const appbaseNativeLibSourcePath = path.join(appbaseNativeSourceDir, 'lib.rs');
const appbaseAuthoritySourcePath = path.join(appbaseNativeSourceDir, 'user_center_authority.rs');
const appbaseValidationSourcePath = path.join(appbaseNativeSourceDir, 'user_center_validation.rs');

assert.ok(fs.existsSync(libSourcePath), `Expected Rust host lib.rs at ${libSourcePath}.`);
assert.equal(
  fs.existsSync(localUserCenterSourcePath),
  false,
  'BirdCoder Rust host must not keep a local user_center.rs authority copy; use sdkwork-appbase native IAM.',
);
assert.equal(
  fs.existsSync(localUserCenterValidationSourcePath),
  false,
  'BirdCoder Rust host must not keep a local user_center_validation.rs copy; use sdkwork-appbase native IAM.',
);
assert.ok(
  fs.existsSync(appbaseNativeLibSourcePath),
  `Expected appbase native IAM lib.rs at ${appbaseNativeLibSourcePath}.`,
);
assert.ok(
  fs.existsSync(appbaseAuthoritySourcePath),
  `Expected appbase native IAM authority at ${appbaseAuthoritySourcePath}.`,
);
assert.ok(
  fs.existsSync(appbaseValidationSourcePath),
  `Expected appbase native IAM validation at ${appbaseValidationSourcePath}.`,
);

const libSource = fs.readFileSync(libSourcePath, 'utf8');
const appbaseNativeLibSource = fs.readFileSync(appbaseNativeLibSourcePath, 'utf8');
const appbaseAuthoritySource = fs.readFileSync(appbaseAuthoritySourcePath, 'utf8');
const appbaseValidationSource = fs.readFileSync(appbaseValidationSourcePath, 'utf8');
const appbaseNativeSource = [
  appbaseNativeLibSource,
  appbaseAuthoritySource,
  appbaseValidationSource,
].join('\n');

assert.match(
  libSource,
  /use sdkwork_user_center_native::\{/u,
  'BirdCoder Rust host must consume IAM through the appbase native crate root.',
);
assert.doesNotMatch(
  libSource,
  /mod user_center(?:_validation)?;/u,
  'BirdCoder Rust host must not register local user-center implementation modules.',
);
assert.doesNotMatch(
  libSource,
  /use crate::user_center(?:_validation)?::/u,
  'BirdCoder Rust host must not import local user-center implementation modules.',
);
for (const requiredAppbaseNativeImport of [
  'ensure_sqlite_user_center_bootstrap_user',
  'ensure_sqlite_user_center_schema',
  'UserCenterState',
  'USER_CENTER_AUTHORIZATION_SCHEME',
  'USER_CENTER_SESSION_HEADER_NAME',
  'USER_CENTER_ACCESS_TOKEN_HEADER_NAME',
]) {
  assert.match(
    libSource,
    new RegExp(requiredAppbaseNativeImport, 'u'),
    `BirdCoder Rust host must import appbase native IAM surface ${requiredAppbaseNativeImport}.`,
  );
}
assert.doesNotMatch(
  libSource,
  /BIRDCODER_(?:AUTHORIZATION|SESSION)_HEADER_NAME|BIRDCODER_AUTHORIZATION_SCHEME/u,
  'BirdCoder Rust host must not consume BirdCoder-specific IAM header or token constants from appbase.',
);

for (const requiredAppbaseNativeReuse of [
  'USER_CENTER_ACCESS_TOKEN_HEADER_NAME',
  'create_user_center_handshake_signing_message',
  'USER_CENTER_ACCESS_TOKEN_HEADER_NAME, USER_CENTER_APP_ID_HEADER_NAME',
]) {
  assert.match(
    appbaseValidationSource,
    new RegExp(requiredAppbaseNativeReuse),
    `Appbase native IAM validation must expose canonical SDKWork surface ${requiredAppbaseNativeReuse}.`,
  );
}

assert.doesNotMatch(
  appbaseNativeSource,
  /\bBIRDCODER_(?:USER_CENTER|LOCAL|AUTHORIZATION|SESSION)\b/u,
  'Appbase native IAM must not expose or depend on BirdCoder-specific IAM names.',
);
assert.doesNotMatch(
  appbaseNativeSource,
  /sdkwork-birdcoder|birdcoder-|BirdCoder/u,
  'Appbase native IAM defaults and tests must stay appbase-generic instead of embedding BirdCoder product names.',
);
assert.doesNotMatch(
  appbaseValidationSource,
  /USER_CENTER_ACCESS_TOKEN_HEADER_NAME:\s*&str\s*=\s*"Access-Token"/u,
  'Appbase native IAM validation must use canonical Sdkwork-Access-Token, not the retired Access-Token spelling.',
);
assert.doesNotMatch(
  libSource,
  /HeaderName::from_static\("access-token"\)/u,
  'BirdCoder Rust user-center response headers must use the appbase canonical Sdkwork-Access-Token header.',
);
assert.doesNotMatch(
  libSource,
  /HeaderName::from_static\(USER_CENTER_ACCESS_TOKEN_HEADER_NAME\)/u,
  'BirdCoder Rust user-center must parse appbase canonical Sdkwork-Access-Token through HeaderName::from_bytes because from_static requires lowercase literals.',
);
assert.match(
  libSource,
  /parse_canonical_user_center_header_name\(USER_CENTER_ACCESS_TOKEN_HEADER_NAME\)/u,
  'BirdCoder Rust user-center must preserve the appbase canonical access-token header while using a valid Rust HeaderName parser.',
);

for (const retiredLegacyIdentitySurface of [
  /rewrite_provider_authority_collaboration_tables_to_legacy_identity_columns/u,
  /\blegacy identity\b/iu,
  /\bidentity_id\b/u,
  /\bcreated_by_identity_id\b/u,
  /\bgranted_by_identity_id\b/u,
  /sqlite_column_exists\([^)]*"identity_id"/u,
]) {
  assert.doesNotMatch(
    libSource,
    retiredLegacyIdentitySurface,
    `BirdCoder is unpublished; Rust host must not keep legacy identity collaboration compatibility path ${retiredLegacyIdentitySurface}.`,
  );
}

for (const requiredValidationSurface of [
  'USER_CENTER_STANDARD_HANDSHAKE_MODE',
  'USER_CENTER_APP_ID_HEADER_NAME',
  'USER_CENTER_PROVIDER_KEY_HEADER_NAME',
  'USER_CENTER_HANDSHAKE_MODE_HEADER_NAME',
  'USER_CENTER_SECRET_ID_HEADER_NAME',
  'USER_CENTER_SIGNATURE_HEADER_NAME',
  'USER_CENTER_SIGNED_AT_HEADER_NAME',
  'resolve_external_app_api_handshake_config',
  'create_external_app_api_handshake_signing_message',
  'sign_external_app_api_handshake',
  'build_external_app_api_request_headers',
]) {
  assert.match(
    appbaseValidationSource,
    new RegExp(requiredValidationSurface),
    `appbase native user_center_validation.rs must expose ${requiredValidationSurface}.`,
  );
}

console.log('birdcoder rust user-center validation contract passed.');
