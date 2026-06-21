import assert from 'node:assert/strict';

import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import {
  WORKBENCH_CODE_ENGINES,
  normalizeWorkbenchCodeEngineId,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/preferences.ts';

assert.deepEqual(
  WORKBENCH_CODE_ENGINES.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

assert.equal(normalizeWorkbenchCodeEngineId('Gemini'), 'gemini');
assert.equal(normalizeWorkbenchCodeEngineId('gemini cli'), 'gemini');

const geminiEngine = createChatEngineById('gemini');
assert.equal(geminiEngine.name, 'gemini-cli-kernel-sdk-adapter');

assert.throws(
  () => createChatEngineById('unknown-engine'),
  /unknown engineId/i,
);

console.log('gemini engine contract passed.');
