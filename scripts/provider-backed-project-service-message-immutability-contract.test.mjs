import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.doesNotMatch(
  source,
  /agentSession\.messages\.push\(/,
  'ProviderBackedProjectService must not mutate cached coding-session message arrays in place when appending messages.',
);

assert.doesNotMatch(
  source,
  /Object\.assign\(message,\s*updates\)/,
  'ProviderBackedProjectService must not mutate cached message records in place when editing transcript entries.',
);

assert.doesNotMatch(
  source,
  /agentSession\.messages\s*=\s*agentSession\.messages\.filter\(/,
  'ProviderBackedProjectService must replace the full cached coding-session snapshot instead of mutating its transcript field directly.',
);

console.log('provider-backed project service message immutability contract passed.');
