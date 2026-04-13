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
  /createBirdCoderGeneratedCoreWriteApiClient/,
  'defaultIdeServices must import the shared generated core write facade from @sdkwork/birdcoder-types.',
);

assert.match(
  source,
  /createBirdCoderGeneratedCoreWriteApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the shared generated core write facade directly from the HTTP transport.',
);

console.log('default IDE services generated core write facade contract passed.');
