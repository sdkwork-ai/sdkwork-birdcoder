import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const cipherSource = readText(
  'crates/sdkwork-birdcoder-project-service/src/ports/runtime_location_path_cipher.rs',
);
const configSource = readText(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/config.rs',
);
const bootstrapSource = readText(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/runtime_location.rs',
);
const environmentReference = readText('docs/reference/environment.md');

assert.match(
  configSource,
  /SDKWORK_BIRDCODER_RUNTIME_LOCATION_PREVIOUS_KEYS_JSON/u,
  'Runtime configuration must expose a structured previous-key keyring.',
);
assert.match(
  configSource,
  /SDKWORK_BIRDCODER_RUNTIME_LOCATION_FINGERPRINT_KEY/u,
  'Runtime configuration must expose a stable fingerprint key.',
);
assert.match(
  cipherSource,
  /const MAX_DECRYPTION_KEYS: usize = 16;/u,
  'Runtime-location decryption keyring must have a hard upper bound.',
);
assert.match(
  cipherSource,
  /fingerprint_secret:/u,
  'Path fingerprints must use a secret independent from the active encryption key.',
);
assert.match(
  bootstrapSource,
  /AesGcmRuntimeLocationPathCipher::with_keyring/u,
  'Gateway bootstrap must wire the validated rotation keyring into the cipher.',
);
assert.match(
  environmentReference,
  /SDKWORK_BIRDCODER_RUNTIME_LOCATION_PREVIOUS_KEYS_JSON/u,
  'Operator environment reference must document previous-key configuration.',
);
assert.match(
  environmentReference,
  /SDKWORK_BIRDCODER_RUNTIME_LOCATION_FINGERPRINT_KEY/u,
  'Operator environment reference must document stable fingerprint configuration.',
);

console.log('runtime-location key rotation contract passed.');
