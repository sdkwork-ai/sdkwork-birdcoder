import assert from 'node:assert/strict';

const runtimeModule = await import(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowLayoutState.ts',
    import.meta.url,
  ).href
);

const state = runtimeModule.buildMultiWindowLayoutState({
  layoutScopeId: runtimeModule.MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
  now: () => '2026-04-29T00:00:00.000Z',
  panes: [
    {
      agentSessionId: 'session-1',
      enabled: true,
      id: 'pane-1',
      mode: 'chat',
      parameters: {
        maxOutputTokens: 4096,
        systemPrompt: 'Keep the layout state compact.',
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
  runtimeModule.writeMultiWindowLayoutState(
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
  'Multi-window layout persistence must serialize the complete state at most once per scheduled write.',
);

console.log('multiwindow layout-state serialization performance contract passed.');
