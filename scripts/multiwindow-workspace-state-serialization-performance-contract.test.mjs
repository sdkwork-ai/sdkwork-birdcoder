import assert from 'node:assert/strict';

const runtimeModule = await import(
  new URL(
    '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowWorkspaceState.ts',
    import.meta.url,
  ).href
);

const state = runtimeModule.buildMultiWindowWorkspaceState({
  now: () => '2026-04-29T00:00:00.000Z',
  panes: [
    {
      codingSessionId: 'session-1',
      enabled: true,
      id: 'pane-1',
      mode: 'chat',
      parameters: {
        maxOutputTokens: 4096,
        systemPrompt: 'Keep the workspace state compact.',
        temperature: 0.2,
        topP: 0.9,
      },
      previewUrl: 'about:blank',
      projectId: 'project-1',
      selectedEngineId: 'codex',
      selectedModelId: 'gpt-5.4',
      title: 'Pane 1',
    },
  ],
  windowCount: 1,
  workspaceId: 'workspace-1',
});

let completeStateSerializationCount = 0;
const originalStringify = JSON.stringify;

JSON.stringify = function stringifyWithStateCounter(value, ...args) {
  if (value === state) {
    completeStateSerializationCount += 1;
  }

  return originalStringify.call(this, value, ...args);
};

try {
  runtimeModule.writeMultiWindowWorkspaceState(
    {
      getItem() {
        return null;
      },
      setItem() {
        // The contract only measures serialization work before the storage write.
      },
    },
    state,
  );
} finally {
  JSON.stringify = originalStringify;
}

assert.equal(
  completeStateSerializationCount,
  1,
  'MultiWindow workspace persistence must serialize the complete state at most once per scheduled write; duplicated JSON.stringify work grows with prompt and pane payload size on the UI thread.',
);

console.log('multiwindow workspace-state serialization performance contract passed.');
