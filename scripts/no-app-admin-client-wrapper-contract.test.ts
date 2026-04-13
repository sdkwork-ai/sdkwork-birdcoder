import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.doesNotMatch(
  source,
  /export interface CreateBirdCoderAppAdminApiClientOptions/,
  'infrastructure appAdminApiClient module must not keep a dedicated high-level wrapper options type once the shared facade is the only approved entrypoint.',
);

assert.doesNotMatch(
  source,
  /export function createBirdCoderAppAdminApiClient\(/,
  'infrastructure appAdminApiClient module must not export createBirdCoderAppAdminApiClient once the shared facade in @sdkwork/birdcoder-types is the sole high-level client entrypoint.',
);

console.log('no app/admin client wrapper contract passed.');
