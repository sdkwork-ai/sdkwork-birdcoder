import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appSdkTransport.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.doesNotMatch(
  source,
  /export interface CreateBirdCoderAppSdkApiClientOptions/,
  'app SDK transport must stay transport-only and must not export high-level app SDK wrapper options.',
);

assert.doesNotMatch(
  source,
  /export function createBirdCoderAppSdkApiClient\(/,
  'app SDK transport must stay transport-only and must not export high-level app SDK wrapper construction.',
);

console.log('no mixed app transport client wrapper contract passed.');
