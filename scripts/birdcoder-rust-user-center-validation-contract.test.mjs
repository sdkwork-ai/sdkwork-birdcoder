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

const libSourcePath = path.join(rustHostSourceDir, 'lib.rs');
const userCenterSourcePath = path.join(rustHostSourceDir, 'user_center.rs');
const userCenterValidationSourcePath = path.join(
  rustHostSourceDir,
  'user_center_validation.rs',
);

assert.ok(fs.existsSync(libSourcePath), `Expected Rust host lib.rs at ${libSourcePath}.`);
assert.ok(
  fs.existsSync(userCenterSourcePath),
  `Expected Rust host user_center.rs at ${userCenterSourcePath}.`,
);
assert.ok(
  fs.existsSync(userCenterValidationSourcePath),
  `Expected Rust host validation module at ${userCenterValidationSourcePath}.`,
);

const libSource = fs.readFileSync(libSourcePath, 'utf8');
const userCenterSource = fs.readFileSync(userCenterSourcePath, 'utf8');
const validationSource = fs.readFileSync(userCenterValidationSourcePath, 'utf8');

assert.match(
  libSource,
  /mod user_center_validation;/,
  'BirdCoder Rust host must register the independent user_center_validation module.',
);

assert.match(
  userCenterSource,
  /use crate::user_center_validation::/,
  'user_center.rs must consume the validation boundary instead of defining validation internals inline.',
);

for (const retiredConstant of [
  'USER_CENTER_HANDSHAKE_MODE',
  'USER_CENTER_APP_ID_HEADER_NAME',
  'USER_CENTER_PROVIDER_KEY_HEADER_NAME',
  'USER_CENTER_HANDSHAKE_MODE_HEADER_NAME',
  'USER_CENTER_SECRET_ID_HEADER_NAME',
  'USER_CENTER_SIGNATURE_HEADER_NAME',
  'USER_CENTER_SIGNED_AT_HEADER_NAME',
]) {
  assert.doesNotMatch(
    userCenterSource,
    new RegExp(`const\\s+${retiredConstant}\\s*:`),
    `user_center.rs must not keep ${retiredConstant} inline after validation extraction.`,
  );
}

for (const retiredFunction of [
  'resolve_external_app_api_handshake_config',
  'create_external_app_api_handshake_signing_message',
  'sign_external_app_api_handshake',
  'build_external_app_api_request_headers',
]) {
  assert.doesNotMatch(
    userCenterSource,
    new RegExp(`fn\\s+${retiredFunction}\\s*\\(`),
    `user_center.rs must not keep ${retiredFunction} inline after validation extraction.`,
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
    validationSource,
    new RegExp(requiredValidationSurface),
    `user_center_validation.rs must expose ${requiredValidationSurface}.`,
  );
}

console.log('birdcoder rust user-center validation contract passed.');
