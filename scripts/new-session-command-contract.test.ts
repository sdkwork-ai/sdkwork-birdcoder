import assert from 'node:assert/strict';

import {
  buildCreateNewCodingSessionInFlightKey,
  createWorkbenchCodingSessionInProject,
  ensureWorkbenchCodingSessionForMessage,
  normalizeCreateNewCodingSessionRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/codingSessionCreation.ts';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-contracts-commons';

const normalized = normalizeCreateNewCodingSessionRequest({
  engineId: ' codex ',
  modelId: ' gpt-5 ',
  projectId: ' explicit-project ',
  source: 'file-menu',
}, 'stale-current-project');
assert.deepEqual(normalized, {
  engineId: 'codex',
  modelId: 'gpt-5',
  projectId: 'explicit-project',
  source: 'file-menu',
});
assert.equal(
  buildCreateNewCodingSessionInFlightKey(normalized!),
  buildCreateNewCodingSessionInFlightKey({ ...normalized!, source: 'keyboard-shortcut' }),
  'equivalent overlapping UI intents must share one in-flight identity.',
);

let persistenceCalls = 0;
const selections: Array<{ codingSessionId: string; projectId?: string }> = [];
const created = await createWorkbenchCodingSessionInProject({
  createCodingSessionWithSelection: async (projectId, title, options) => {
    persistenceCalls += 1;
    assert.equal(projectId, 'explicit-project');
    assert.equal(title, 'Precise title');
    assert.deepEqual(options, { engineId: 'codex', modelId: 'gpt-5' });
    return {
      id: 'coding-session-1',
      projectId,
      title,
    } as BirdCoderCodingSession;
  },
  projectId: 'explicit-project',
  requestedEngineId: 'codex',
  requestedModelId: 'gpt-5',
  selectCodingSession: (codingSessionId, options) => {
    selections.push({ codingSessionId, projectId: options?.projectId });
  },
  title: 'Precise title',
});
assert.equal(created.id, 'coding-session-1');
assert.equal(persistenceCalls, 1);
assert.deepEqual(selections, [{
  codingSessionId: 'coding-session-1',
  projectId: 'explicit-project',
}]);

let messageCreationCalls = 0;
const ensuredSession = await ensureWorkbenchCodingSessionForMessage({
  createCodingSessionFromRequest: async (request, options) => {
    messageCreationCalls += 1;
    assert.deepEqual(request, {
      engineId: 'codex',
      modelId: 'gpt-5',
      projectId: 'message-project',
      source: 'message-submit',
      title: '12345678901234567890...',
    });
    assert.deepEqual(options, { showSuccessToast: false });
    return {
      id: 'coding-session-message',
      projectId: request?.projectId,
      title: request?.title,
    } as BirdCoderCodingSession;
  },
  currentCodingSessionId: null,
  currentProjectId: 'message-project',
  messageContent: '123456789012345678901',
  requestedEngineId: 'codex',
  requestedModelId: 'gpt-5',
  resolveProjectId: () => null,
});
assert.deepEqual(ensuredSession, {
  codingSessionId: 'coding-session-message',
  projectId: 'message-project',
  wasCreated: true,
});
assert.equal(messageCreationCalls, 1);

console.log('new session command contract passed.');
