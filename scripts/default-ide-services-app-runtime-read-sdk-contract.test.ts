import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.doesNotMatch(
  source,
  /createBirdCoderGeneratedCoreReadApiClient/,
  'defaultIdeServices must not import the retired generated core read facade.',
);

assert.match(
  source,
  /createBirdCoderAppSdkApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the app SDK wrapper from the canonical app transport.',
);

console.log('default IDE services app runtime SDK read contract passed.');
