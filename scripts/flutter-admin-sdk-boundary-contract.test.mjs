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

// BirdCoder owns no Backend API surface (root PRD: Backend API and Open API
// each contain zero BirdCoder operations; Flutter PRD: "Backend API and Open
// API consumers are absent because BirdCoder owns neither surface"). Admin
// core must therefore never construct or reference a backend SDK consumer.
assert.equal(
  fs.existsSync(path.join(rootDir, `${adminPrefix}/sdk/backend_sdk_client.dart`)),
  false,
  'Flutter admin core must not construct backend SDK clients: BirdCoder owns no Backend API surface.',
);
assert.equal(
  fs.existsSync(
    path.join(
      rootDir,
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer',
    ),
  ),
  false,
  'The retired backend SDK consumer assembly must stay removed.',
);

console.log('flutter admin sdk boundary contract passed.');
