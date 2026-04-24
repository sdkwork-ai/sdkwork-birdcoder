import assert from 'node:assert/strict';

import {
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchPreferences,
  normalizeWorkbenchTerminalProfileId,
  setWorkbenchActiveChatSelection,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';
import {
  WORKBENCH_CODE_ENGINES,
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
} from '../packages/sdkwork-birdcoder-codeengine/src/preferences.ts';
import { listWorkbenchServerImplementedCodeEngines } from '../packages/sdkwork-birdcoder-codeengine/src/serverSupport.ts';

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
assert.equal(
  findWorkbenchCodeEngineDefinition('gpt-5.4'),
  null,
  'Workbench engine definition lookup must not treat model ids as engine ids.',
);
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

const alternateServerImplementedEngine = listWorkbenchServerImplementedCodeEngines().find(
  (engine) => engine.id !== DEFAULT_WORKBENCH_PREFERENCES.codeEngineId,
);
assert.ok(
  alternateServerImplementedEngine,
  'Workbench preferences contract requires at least one server-ready engine besides the default engine.',
);
assert.deepEqual(
  setWorkbenchActiveChatSelection(
    {
      ...DEFAULT_WORKBENCH_PREFERENCES,
      codeEngineId: 'codex',
      codeModelId: 'gpt-5.4',
    },
    alternateServerImplementedEngine.id,
    alternateServerImplementedEngine.defaultModelId,
  ),
  {
    ...DEFAULT_WORKBENCH_PREFERENCES,
    codeEngineId: alternateServerImplementedEngine.id,
    codeModelId: alternateServerImplementedEngine.defaultModelId,
  },
  'Workbench active chat selection updates must switch engine/model atomically so a new-session engine change cannot leave a stale model from the previous engine.',
);

console.log('workbench preferences contract passed.');
