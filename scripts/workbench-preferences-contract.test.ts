import assert from 'node:assert/strict';

import {
  DEFAULT_WORKBENCH_PREFERENCES,
  WORKBENCH_CODE_ENGINES,
  getWorkbenchCodeEngineDefinition,
  getTerminalShellSettingValue,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchPreferences,
  normalizeWorkbenchTerminalProfileId,
  resolveWorkbenchChatSelection,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';

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
assert.equal(getTerminalShellSettingValue('bash'), 'Git Bash');

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
