import assert from 'node:assert/strict';

import {
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchPreferences,
  normalizeWorkbenchTerminalProfileId,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';
import {
  WORKBENCH_CODE_ENGINES,
  getWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
} from '../packages/sdkwork-birdcoder-codeengine/src/preferences.ts';

assert.deepEqual(
  WORKBENCH_CODE_ENGINES.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);
assert.equal(getWorkbenchCodeEngineDefinition('claude-code').defaultModelId, 'claude-code');
assert.equal(normalizeWorkbenchCodeModelId('opencode', 'claude'), 'opencode');
assert.deepEqual(resolveWorkbenchChatSelection({ codeEngineId: 'claude', codeModelId: 'gpt-4o' }), {
  codeEngineId: 'claude-code',
  codeModelId: 'claude-code',
});

assert.equal(normalizeWorkbenchCodeEngineId('Claude Code'), 'claude-code');
assert.equal(normalizeWorkbenchCodeEngineId('Gemini'), 'gemini');
assert.equal(normalizeWorkbenchCodeEngineId('open-code'), 'opencode');
assert.equal(normalizeWorkbenchCodeEngineId('gpt-4o'), 'codex');
assert.equal(normalizeWorkbenchTerminalProfileId('PowerShell'), 'powershell');
assert.equal(normalizeWorkbenchTerminalProfileId('Command Prompt'), 'cmd');
assert.equal(normalizeWorkbenchTerminalProfileId('Git Bash'), 'bash');
assert.equal(normalizeWorkbenchTerminalProfileId('Codex'), 'codex');

assert.deepEqual(
  normalizeWorkbenchPreferences({
    codeEngineId: 'claude-code',
    codeModelId: 'gpt-4o',
    terminalProfileId: 'gemini',
    defaultWorkingDirectory: '',
  }),
  {
    ...DEFAULT_WORKBENCH_PREFERENCES,
    codeEngineId: 'claude-code',
    codeModelId: 'claude-code',
    terminalProfileId: 'gemini',
  },
);

console.log('workbench preferences contract passed.');
