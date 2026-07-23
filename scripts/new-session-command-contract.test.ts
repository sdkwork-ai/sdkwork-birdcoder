import assert from 'node:assert/strict';

import {
  buildCreateNewAgentSessionInFlightKey,
  createWorkbenchAgentSessionInProject,
  ensureWorkbenchAgentSessionForTurnInput,
  normalizeCreateNewAgentSessionRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionCreation.ts';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';

const normalized = normalizeCreateNewAgentSessionRequest({
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
  buildCreateNewAgentSessionInFlightKey(normalized!),
  buildCreateNewAgentSessionInFlightKey({ ...normalized!, source: 'keyboard-shortcut' }),
  'equivalent overlapping UI intents must share one in-flight identity.',
);

let persistenceCalls = 0;
const selections: Array<{ agentSessionId: string; projectId?: string }> = [];
const created = await createWorkbenchAgentSessionInProject({
  createAgentSessionWithSelection: async (projectId, title, options) => {
    persistenceCalls += 1;
    assert.equal(projectId, 'explicit-project');
    assert.equal(title, 'Precise title');
    assert.deepEqual(options, { engineId: 'codex', modelId: 'gpt-5' });
    return {
      id: 'coding-session-1',
      projectId,
      title,
    } as AgentSessionView;
  },
  projectId: 'explicit-project',
  requestedEngineId: 'codex',
  requestedModelId: 'gpt-5',
  selectAgentSession: (agentSessionId, options) => {
    selections.push({ agentSessionId, projectId: options?.projectId });
  },
  title: 'Precise title',
});
assert.equal(created.id, 'coding-session-1');
assert.equal(persistenceCalls, 1);
assert.deepEqual(selections, [{
  agentSessionId: 'coding-session-1',
  projectId: 'explicit-project',
}]);

let turnSessionCreationCalls = 0;
const ensuredSession = await ensureWorkbenchAgentSessionForTurnInput({
  createAgentSessionFromRequest: async (request, options) => {
    turnSessionCreationCalls += 1;
    assert.deepEqual(request, {
      engineId: 'codex',
      modelId: 'gpt-5',
      projectId: 'turn-project',
      source: 'turn-submit',
      title: '12345678901234567890...',
    });
    assert.deepEqual(options, { showSuccessToast: false });
    return {
      id: 'coding-session-turn',
      projectId: request?.projectId,
      title: request?.title,
    } as AgentSessionView;
  },
  currentAgentSessionId: null,
  currentProjectId: 'turn-project',
  turnInputContent: '123456789012345678901',
  requestedEngineId: 'codex',
  requestedModelId: 'gpt-5',
  resolveProjectId: () => null,
});
assert.deepEqual(ensuredSession, {
  agentSessionId: 'coding-session-turn',
  projectId: 'turn-project',
  wasCreated: true,
});
assert.equal(turnSessionCreationCalls, 1);

console.log('new session command contract passed.');
