import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.match(
  source,
  /createBirdCoderGeneratedAppAdminApiClient/,
  'defaultIdeServices must import the shared generated app/admin facade from @sdkwork/birdcoder-types.',
);

assert.doesNotMatch(
  source,
  /createBirdCoderAppAdminApiClient\(/,
  'defaultIdeServices must not rebuild representative app/admin clients through the infrastructure wrapper.',
);

assert.match(
  source,
  /createBirdCoderGeneratedAppAdminApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the shared generated facade directly from the HTTP transport.',
);

assert.match(
  source,
  /export function createInProcessBirdCoderAppAdminClient[\s\S]*createBirdCoderGeneratedAppAdminApiClient\(\{\s*transport:\s*createBirdCoderInProcessAppAdminApiTransport\(/s,
  'test helpers may still expose an explicit in-process app/admin client builder for isolated contracts.',
);

assert.match(
  source,
  /const appAdminClient =[\s\S]*resolveRuntimeAppAdminClient\(\)[\s\S]*createUnavailableBirdCoderAppAdminClient\(\);/s,
  'defaultIdeServices must require a bound runtime server client instead of silently falling back to an in-process app/admin authority.',
);

console.log('default IDE services generated app/admin facade contract passed.');
