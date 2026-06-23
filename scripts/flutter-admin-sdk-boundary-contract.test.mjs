import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const adminPrefix =
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_admin_core/lib/src';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const coreSdkSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/sdk_clients.dart',
);
const appConsumerSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/lib/src/app_sdk_consumer.dart',
);

assert.match(
  coreSdkSource,
  /sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/u,
  'Flutter core must compose app SDK clients through the consumer assembly package.',
);
assert.match(
  appConsumerSource,
  /pendingGeneratedSdk/u,
  'Flutter app SDK consumer must keep an explicit pending generated SDK marker.',
);
assert.doesNotMatch(
  coreSdkSource,
  /backendSdk/u,
  'Flutter core must not expose backend SDK wrappers.',
);

assert.match(
  read(`${adminPrefix}/sdk/backend_sdk_client.dart`),
  /sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/u,
  'Flutter admin core must compose backend SDK clients through the consumer assembly package.',
);
assert.match(
  read('apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/lib/src/backend_sdk_consumer.dart'),
  /pendingGeneratedSdk/u,
  'Flutter admin core must own backend SDK client construction.',
);

console.log('flutter admin sdk boundary contract passed.');
