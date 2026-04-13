import assert from 'node:assert/strict';

import { WORKBENCH_CODE_ENGINES, normalizeWorkbenchCodeEngineId } from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';

assert.deepEqual(
  WORKBENCH_CODE_ENGINES.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

assert.equal(normalizeWorkbenchCodeEngineId('Gemini'), 'gemini');
assert.equal(normalizeWorkbenchCodeEngineId('gemini cli'), 'gemini');

const geminiEngine = createChatEngineById('gemini');
assert.equal(geminiEngine.name, 'gemini');

const fallbackEngine = createChatEngineById('unknown-engine');
assert.equal(fallbackEngine.name, 'codex-rust-server');

console.log('gemini engine contract passed.');
