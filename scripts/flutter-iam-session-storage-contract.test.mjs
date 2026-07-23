import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const corePrefix =
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap';
const hostPrefix =
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/lib/src/session';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const tokenManagerSource = read(`${corePrefix}/token_manager.dart`);
const iamRuntimeSource = read(`${corePrefix}/iam_runtime.dart`);
const sessionStorageSource = read(`${hostPrefix}/birdcoder_session_storage.dart`);
const configureStorageSource = read(`${hostPrefix}/configure_birdcoder_session_storage.dart`);
const hostPubspec = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/pubspec.yaml',
);
const mainSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/main.dart');

assert.match(
  sessionStorageSource,
  /birdCoderAuthSessionKey = 'sdkwork\.birdcoder\.appSession\.v1'/u,
  'Flutter session storage must use the canonical BirdCoder IAM session key.',
);
assert.match(
  read(`${hostPrefix}/birdcoder_session_record.dart`),
  /authToken/u,
  'Flutter session records must include authToken for IAM token hydration.',
);

assert.match(
  tokenManagerSource,
  /hydrateFromStorage/u,
  'Flutter token manager must hydrate tokens from session storage.',
);
assert.match(
  tokenManagerSource,
  /syncBirdCoderGlobalTokenManagerFromStorage/u,
  'Flutter token manager must expose a global storage sync entrypoint.',
);

assert.match(
  iamRuntimeSource,
  /sessionsCurrentRetrieve/u,
  'Flutter IAM runtime must validate stored credentials through the generated SDK current-session authority.',
);
assert.match(
  iamRuntimeSource,
  /await _tokenManager\.clearTokens\(\)/u,
  'Flutter IAM runtime must fail closed and clear stale sessions.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /_sessionValidated = true;\s*\n\s*notifyListeners\(\);\s*\n\s*\}\s*\n\s*Future<void> validateStoredSession/su,
  'Flutter IAM runtime must not unconditionally mark stored sessions as validated.',
);

assert.doesNotMatch(
  read('apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/lib/src/index.dart'),
  /iam_session_probe/u,
  'Flutter host must not expose a raw-HTTP IAM session probe beside the generated SDK authority.',
);

assert.match(
  hostPubspec,
  /flutter_secure_storage/u,
  'Flutter host package must depend on flutter_secure_storage for native secure persistence.',
);
assert.match(
  configureStorageSource,
  /configureDefaultBirdCoderSessionStorage/u,
  'Flutter host must expose default secure session storage configuration.',
);
assert.match(
  configureStorageSource,
  /FlutterSecureStorage/u,
  'Flutter host secure storage must use platform secure storage on native targets.',
);
assert.match(
  mainSource,
  /configureDefaultBirdCoderSessionStorage\(\)/u,
  'Flutter entrypoint must configure secure session storage before bootstrap.',
);

console.log('flutter iam session storage contract passed.');
