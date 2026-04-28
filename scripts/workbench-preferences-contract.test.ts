import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

const perEnginePreferences = setWorkbenchActiveChatSelection(
  setWorkbenchActiveChatSelection(
    DEFAULT_WORKBENCH_PREFERENCES,
    'codex',
    'gpt-5.3-codex',
  ),
  'gemini',
  'gemini-1.5-pro',
);
assert.equal(perEnginePreferences.codeEngineId, 'gemini');
assert.equal(perEnginePreferences.codeModelId, 'gemini-1.5-pro');
assert.equal(
  perEnginePreferences.codeEngineSettings.codex?.defaultModelId,
  'gpt-5.3-codex',
  'Workbench preferences must preserve the selected model independently for Codex after switching to another engine.',
);
assert.equal(
  perEnginePreferences.codeEngineSettings.gemini?.defaultModelId,
  'gemini-1.5-pro',
  'Workbench preferences must preserve the selected model independently for Gemini.',
);
assert.deepEqual(
  resolveWorkbenchChatSelection(
    { codeEngineId: 'codex', codeModelId: 'gemini-1.5-pro' },
    perEnginePreferences,
  ),
  {
    codeEngineId: 'codex',
    codeModelId: 'gpt-5.3-codex',
  },
  'Switching back to an engine must restore that engine owned selected model instead of carrying a stale model from another engine.',
);

const settingsEngineLocalePaths = [
  '../packages/sdkwork-birdcoder-i18n/src/locales/en/settings-engine.ts',
  '../packages/sdkwork-birdcoder-i18n/src/locales/zh/settings-engine.ts',
] as const;

for (const localePath of settingsEngineLocalePaths) {
  const absolutePath = fileURLToPath(new URL(localePath, import.meta.url));
  const source = readFileSync(absolutePath, 'utf8');
  assert.equal(
    /only Codex plus OpenCode|只启用 Codex 和 OpenCode/.test(source),
    false,
    `${absolutePath} must not describe Claude Code or Gemini as unavailable after all standard code engines became server-ready.`,
  );
}

console.log('workbench preferences contract passed.');
