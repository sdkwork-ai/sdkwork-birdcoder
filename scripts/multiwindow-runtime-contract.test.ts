import assert from 'node:assert/strict';

import {
  DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  MAX_MULTI_WINDOW_PANES,
  MULTI_WINDOW_LAYOUT_COUNTS,
  normalizeMultiWindowActiveWindowCount,
  normalizeMultiWindowLayoutCount,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowLayout.ts';
import {
  buildMultiWindowPendingAddProgress,
  resolveNextMultiWindowAddWindowCount,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowAddFlow.ts';
import {
  collectFailedMultiWindowDispatchPaneIds,
  dispatchMultiWindowPrompt,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowDispatch.ts';
import {
  countMultiWindowDispatchablePanes,
  resolveMultiWindowComposerDisabledReason,
  resolveMultiWindowPaneDispatchability,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowDispatchability.ts';
import {
  buildMultiWindowMessageMetadata,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowMessageMetadata.ts';
import {
  buildMultiWindowPaneDispatchPrompt,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowPromptProfile.ts';
import {
  resolveMultiWindowPaneAutoPreviewUrl,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowPreviewUrl.ts';
import {
  buildMultiWindowProvisionedSessionTitle,
  resolveMultiWindowPaneSessionProvisioningStatus,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowSessionProvisioning.ts';
import {
  buildMultiWindowWorkspaceState,
  createMultiWindowWorkspaceStateStorageKey,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  MAX_MULTI_WINDOW_DURABLE_WORKSPACE_STATE_BYTES,
  readMultiWindowWorkspaceState,
  writeMultiWindowWorkspaceState,
} from '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowWorkspaceState.ts';

assert.deepEqual(
  [...MULTI_WINDOW_LAYOUT_COUNTS],
  [2, 3, 4, 6, 8],
  'Multi-window layout counts must be the product-standard 2/3/4/6/8 set.',
);
assert.equal(
  MAX_MULTI_WINDOW_PANES,
  8,
  'Multi-window dispatch must cap visible panes at eight for bounded concurrency.',
);
assert.equal(normalizeMultiWindowLayoutCount(1), 2);
assert.equal(normalizeMultiWindowLayoutCount(4), 4);
assert.equal(normalizeMultiWindowLayoutCount(9), 8);
assert.equal(normalizeMultiWindowLayoutCount(Number.NaN), 2);
assert.equal(
  DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  0,
  'Multi-window programming must start with no active windows so users manually add comparison panes.',
);
assert.equal(normalizeMultiWindowActiveWindowCount(-1), 0);
assert.equal(normalizeMultiWindowActiveWindowCount(0), 0);
assert.equal(normalizeMultiWindowActiveWindowCount(1), 1);
assert.equal(normalizeMultiWindowActiveWindowCount(9), 8);
assert.equal(resolveNextMultiWindowAddWindowCount(0), 1);
assert.equal(resolveNextMultiWindowAddWindowCount(7), 8);
assert.equal(resolveNextMultiWindowAddWindowCount(8), 8);
assert.deepEqual(
  buildMultiWindowPendingAddProgress({
    paneIndex: 2,
    pendingWindowCountTarget: 6,
    windowCount: 2,
  }),
  {
    currentWindowNumber: 3,
    remainingWindowCount: 3,
    targetWindowCount: 6,
  },
  'Pending multi-window add progress must describe which window in a requested batch is being configured.',
);
assert.equal(
  buildMultiWindowPendingAddProgress({
    paneIndex: 1,
    pendingWindowCountTarget: 6,
    windowCount: 2,
  }),
  null,
  'Rebinding an already visible pane must not be presented as a batch add step.',
);
assert.equal(
  buildMultiWindowPendingAddProgress({
    paneIndex: 8,
    pendingWindowCountTarget: 99,
    windowCount: 7,
  }),
  null,
  'Pending add progress must ignore panes beyond the bounded multi-window capacity.',
);

let activeDispatches = 0;
let maxActiveDispatches = 0;
const observedPrompts: string[] = [];

const result = await dispatchMultiWindowPrompt({
  maxConcurrentDispatches: 2,
  panes: [
    {
      id: 'pane-1',
      enabled: true,
      projectId: 'project-a',
      codingSessionId: 'session-a',
      sendPrompt: async ({ prompt }) => {
        activeDispatches += 1;
        maxActiveDispatches = Math.max(maxActiveDispatches, activeDispatches);
        observedPrompts.push(prompt);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeDispatches -= 1;
      },
    },
    {
      id: 'pane-2',
      enabled: true,
      projectId: 'project-b',
      codingSessionId: 'session-b',
      sendPrompt: async ({ prompt }) => {
        activeDispatches += 1;
        maxActiveDispatches = Math.max(maxActiveDispatches, activeDispatches);
        observedPrompts.push(prompt);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeDispatches -= 1;
        throw new Error('model unavailable');
      },
    },
    {
      id: 'pane-3',
      enabled: true,
      projectId: 'project-c',
      codingSessionId: 'session-c',
      sendPrompt: async ({ prompt }) => {
        activeDispatches += 1;
        maxActiveDispatches = Math.max(maxActiveDispatches, activeDispatches);
        observedPrompts.push(prompt);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeDispatches -= 1;
      },
    },
    {
      id: 'pane-4',
      enabled: false,
      projectId: 'project-d',
      codingSessionId: 'session-d',
      sendPrompt: async () => {
        throw new Error('disabled panes must not dispatch');
      },
    },
  ],
  prompt: 'Build the same page in every window',
});

assert.equal(
  result.status,
  'partial-failure',
  'One failed pane must not reject or hide successful pane results.',
);
assert.equal(maxActiveDispatches, 2, 'Dispatch must respect the requested concurrency limit.');
assert.deepEqual(
  {
    dispatchablePaneCount: result.summary.dispatchablePaneCount,
    effectiveConcurrency: result.summary.effectiveConcurrency,
    failedPaneCount: result.summary.failedPaneCount,
    maxObservedConcurrency: result.summary.maxObservedConcurrency,
    requestedConcurrency: result.summary.requestedConcurrency,
    skippedPaneCount: result.summary.skippedPaneCount,
    successPaneCount: result.summary.successPaneCount,
    totalPaneCount: result.summary.totalPaneCount,
  },
  {
    dispatchablePaneCount: 3,
    effectiveConcurrency: 2,
    failedPaneCount: 1,
    maxObservedConcurrency: 2,
    requestedConcurrency: 2,
    skippedPaneCount: 1,
    successPaneCount: 2,
    totalPaneCount: 4,
  },
  'Dispatch result summary must expose deterministic high-concurrency batch metrics.',
);
assert.ok(
  typeof result.summary.startedAt === 'number' &&
    typeof result.summary.completedAt === 'number' &&
    typeof result.summary.durationMs === 'number' &&
    result.summary.completedAt >= result.summary.startedAt &&
    result.summary.durationMs >= 0,
  'Dispatch result summary must expose timing metrics for batch-level observability.',
);
assert.deepEqual(
  observedPrompts,
  [
    'Build the same page in every window',
    'Build the same page in every window',
    'Build the same page in every window',
  ],
  'Every active pane must receive the same normalized prompt.',
);
assert.deepEqual(
  result.results.map((paneResult) => [paneResult.paneId, paneResult.status]),
  [
    ['pane-1', 'success'],
    ['pane-2', 'failed'],
    ['pane-3', 'success'],
    ['pane-4', 'skipped'],
  ],
  'Dispatch result must preserve per-pane success, failure, and skipped status.',
);
assert.match(
  result.results.find((paneResult) => paneResult.paneId === 'pane-2')?.errorMessage ?? '',
  /model unavailable/,
  'Failed pane results must retain their own error message.',
);

assert.ok(
  result.results.every((paneResult) => typeof paneResult.durationMs === 'number'),
  'Every pane result must expose durationMs for high-concurrency observability.',
);
assert.deepEqual(
  collectFailedMultiWindowDispatchPaneIds([
    ...result.results,
    {
      codingSessionId: 'duplicate-session',
      durationMs: 1,
      paneId: 'pane-2',
      projectId: 'project-b',
      status: 'failed',
    },
    {
      codingSessionId: 'session-late-failure',
      durationMs: 1,
      paneId: 'pane-5',
      projectId: 'project-e',
      status: 'failed',
    },
  ]),
  ['pane-2', 'pane-5'],
  'Retry targeting must return each failed pane id once, preserving first failure order.',
);

const autoProvisionedResult = await dispatchMultiWindowPrompt({
  panes: [
    {
      id: 'pane-auto-session',
      enabled: true,
      projectId: 'project-auto',
      codingSessionId: '',
      requiresSessionProvisioning: true,
      sendPrompt: async ({ codingSessionId, prompt }) => {
        assert.equal(
          codingSessionId,
          '',
          'Auto-provisioned panes must be able to dispatch before a session id exists.',
        );
        assert.equal(prompt, 'Create a comparative mobile UI');
        return {
          codingSessionId: 'session-auto-created',
        };
      },
    },
  ],
  prompt: 'Create a comparative mobile UI',
});
assert.equal(
  autoProvisionedResult.status,
  'success',
  'Panes that can create their own session must participate in the broadcast.',
);
assert.equal(
  autoProvisionedResult.results[0]?.codingSessionId,
  'session-auto-created',
  'Dispatch results must expose the newly provisioned session id for pane state reconciliation.',
);

const progressEvents: Array<[string, string]> = [];
await dispatchMultiWindowPrompt({
  maxConcurrentDispatches: 1,
  onPaneResult: (event) => {
    progressEvents.push([event.paneId, event.status]);
  },
  panes: [
    {
      id: 'progress-pane-1',
      enabled: true,
      projectId: 'project-a',
      codingSessionId: 'session-a',
      sendPrompt: async () => undefined,
    },
    {
      id: 'progress-pane-2',
      enabled: true,
      projectId: 'project-b',
      codingSessionId: 'session-b',
      sendPrompt: async () => {
        throw new Error('provider quota exceeded');
      },
    },
    {
      id: 'progress-pane-3',
      enabled: false,
      projectId: 'project-c',
      codingSessionId: 'session-c',
      sendPrompt: async () => {
        throw new Error('skipped pane should not run');
      },
    },
  ],
  prompt: 'Compare models',
});
assert.deepEqual(
  progressEvents,
  [
    ['progress-pane-3', 'skipped'],
    ['progress-pane-1', 'pending'],
    ['progress-pane-1', 'success'],
    ['progress-pane-2', 'pending'],
    ['progress-pane-2', 'failed'],
  ],
  'Dispatch must publish deterministic per-pane progress for UI status rendering.',
);

let observerFailureCount = 0;
let observerFailureResult: Awaited<ReturnType<typeof dispatchMultiWindowPrompt>> | null = null;
const originalConsoleError = console.error;
console.error = () => undefined;
try {
  observerFailureResult = await dispatchMultiWindowPrompt({
    maxConcurrentDispatches: 1,
    onPaneResult: () => {
      observerFailureCount += 1;
      throw new Error('progress observer failed');
    },
    panes: [
      {
        id: 'observer-failure-pane',
        enabled: true,
        projectId: 'project-observer-failure',
        codingSessionId: 'session-observer-failure',
        sendPrompt: async () => undefined,
      },
    ],
    prompt: 'Keep dispatch resilient when UI progress observers fail',
  });
} finally {
  console.error = originalConsoleError;
}
assert.ok(
  observerFailureResult,
  'The progress observer failure contract must complete the dispatch call.',
);
assert.equal(
  observerFailureResult.status,
  'success',
  'A failing progress observer must not reject or poison the multi-window dispatch batch.',
);
assert.equal(
  observerFailureResult.results[0]?.status,
  'success',
  'A failing progress observer must not overwrite the pane result lifecycle.',
);
assert.equal(
  observerFailureCount >= 1,
  true,
  'The progress observer failure contract must exercise the observer callback path.',
);

const cancelledEvents: Array<[string, string]> = [];
const cancelledController = new AbortController();
cancelledController.abort();
const cancelledResult = await dispatchMultiWindowPrompt({
  maxConcurrentDispatches: 2,
  onPaneResult: (event) => {
    cancelledEvents.push([event.paneId, event.status]);
  },
  panes: [
    {
      id: 'cancelled-pane-1',
      enabled: true,
      projectId: 'project-a',
      codingSessionId: 'session-a',
      sendPrompt: async () => {
        throw new Error('cancelled panes must not dispatch');
      },
    },
    {
      id: 'cancelled-pane-2',
      enabled: true,
      projectId: 'project-b',
      codingSessionId: 'session-b',
      sendPrompt: async () => {
        throw new Error('cancelled panes must not dispatch');
      },
    },
  ],
  prompt: 'Do not dispatch after cancellation',
  signal: cancelledController.signal,
});
assert.equal(
  cancelledResult.status,
  'cancelled',
  'A pre-cancelled multi-window batch must return an explicit cancelled status.',
);
assert.deepEqual(
  cancelledResult.results.map((paneResult) => [paneResult.paneId, paneResult.status]),
  [
    ['cancelled-pane-1', 'cancelled'],
    ['cancelled-pane-2', 'cancelled'],
  ],
  'A cancelled batch must mark every dispatchable pane as cancelled without calling sendPrompt.',
);
assert.equal(
  cancelledResult.summary.cancelledPaneCount,
  2,
  'Batch summary must expose cancelled panes for lifecycle observability.',
);
assert.deepEqual(
  cancelledEvents,
  [
    ['cancelled-pane-1', 'cancelled'],
    ['cancelled-pane-2', 'cancelled'],
  ],
  'Cancelled panes must publish deterministic lifecycle progress events.',
);

const memoryStorage = new Map<string, string>();
const storage = {
  getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
};
const persistedState = buildMultiWindowWorkspaceState({
  now: () => '2026-04-28T00:00:00.000Z',
  panes: [
    {
      codingSessionId: 'session-a',
      enabled: true,
      id: 'multiwindow-pane-1',
      mode: 'preview',
      parameters: {
        maxOutputTokens: 8192,
        systemPrompt: 'Use concise implementation notes.',
        temperature: 0.4,
        topP: 0.85,
      },
      previewUrl: 'http://127.0.0.1:3000/',
      projectId: 'project-a',
      selectedEngineId: 'codex',
      selectedModelId: 'gpt-5-codex',
      title: '1. Codex baseline',
    },
  ],
  windowCount: 3,
  workspaceId: 'workspace-a',
});
writeMultiWindowWorkspaceState(storage, persistedState);
assert.ok(
  memoryStorage.has(createMultiWindowWorkspaceStateStorageKey('workspace-a')),
  'Multi-window workspace state must be stored under a workspace-scoped key.',
);
assert.deepEqual(
  readMultiWindowWorkspaceState(storage, 'workspace-a'),
  persistedState,
  'Multi-window workspace state must round-trip every pane configuration and layout setting.',
);
storage.setItem(createMultiWindowWorkspaceStateStorageKey('workspace-a'), '{"version":999}');
assert.equal(
  readMultiWindowWorkspaceState(storage, 'workspace-a'),
  null,
  'Unsupported persisted state versions must be ignored instead of crashing the page.',
);

let inaccessibleGetItemCount = 0;
const inaccessibleStorage = {
  getItem() {
    inaccessibleGetItemCount += 1;
    throw new Error('browser storage is blocked');
  },
  setItem() {
    throw new Error('inaccessible storage must not be written by this read contract');
  },
};
assert.equal(
  readMultiWindowWorkspaceState(inaccessibleStorage, 'workspace-inaccessible'),
  null,
  'Blocked browser storage reads must be ignored instead of crashing startup hydration.',
);
assert.equal(
  inaccessibleGetItemCount,
  1,
  'Startup hydration should attempt each workspace storage read once before falling back.',
);

let quotaExceededSetItemCount = 0;
const quotaExceededStorage = {
  getItem() {
    return null;
  },
  setItem() {
    quotaExceededSetItemCount += 1;
    const error = new Error('Setting the value exceeded the quota.');
    error.name = 'QuotaExceededError';
    throw error;
  },
};
const quotaFallbackState = buildMultiWindowWorkspaceState({
  now: () => '2026-04-28T00:00:01.000Z',
  panes: [
    {
      ...persistedState.panes[0]!,
      id: 'multiwindow-pane-quota',
      parameters: {
        ...persistedState.panes[0]!.parameters,
        systemPrompt: 'Persist this prompt through volatile fallback when localStorage is full.',
      },
      title: 'Quota fallback pane',
    },
  ],
  windowCount: 2,
  workspaceId: 'workspace-quota',
});
assert.doesNotThrow(
  () => writeMultiWindowWorkspaceState(quotaExceededStorage, quotaFallbackState),
  'Multi-window workspace persistence must not crash React effects when browser storage quota is exceeded.',
);
assert.deepEqual(
  readMultiWindowWorkspaceState(quotaExceededStorage, 'workspace-quota'),
  quotaFallbackState,
  'Quota-exceeded writes must keep the latest workspace state in a same-session volatile fallback.',
);
writeMultiWindowWorkspaceState(quotaExceededStorage, {
  ...quotaFallbackState,
  updatedAt: '2026-04-28T00:00:02.000Z',
});
assert.equal(
  quotaExceededSetItemCount,
  1,
  'After a quota failure, repeated multi-window writes for the same workspace key must use volatile fallback without hammering localStorage.setItem again.',
);

let recoveringSetItemCount = 0;
const recoveringMemoryStorage = new Map<string, string>();
const recoveringStorage = {
  getItem(key: string) {
    return recoveringMemoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    recoveringSetItemCount += 1;
    if (recoveringSetItemCount === 1) {
      const error = new Error('Temporary quota pressure.');
      error.name = 'QuotaExceededError';
      throw error;
    }

    recoveringMemoryStorage.set(key, value);
  },
};
const recoveringLargeState = buildMultiWindowWorkspaceState({
  now: () => '2026-04-28T00:00:03.000Z',
  panes: [
    {
      ...persistedState.panes[0]!,
      id: 'multiwindow-pane-recovering',
      parameters: {
        ...persistedState.panes[0]!.parameters,
        systemPrompt: 'Temporary quota pressure prompt. '.repeat(2_000),
      },
      title: 'Recovering pane',
    },
  ],
  windowCount: 2,
  workspaceId: 'workspace-recovering',
});
const recoveringSmallState = buildMultiWindowWorkspaceState({
  now: () => '2026-04-28T00:00:04.000Z',
  panes: [
    {
      ...persistedState.panes[0]!,
      id: 'multiwindow-pane-recovering',
      parameters: {
        ...persistedState.panes[0]!.parameters,
        systemPrompt: 'Recovered prompt.',
      },
      title: 'Recovering pane',
    },
  ],
  windowCount: 2,
  workspaceId: 'workspace-recovering',
});
writeMultiWindowWorkspaceState(recoveringStorage, recoveringLargeState);
writeMultiWindowWorkspaceState(recoveringStorage, recoveringSmallState);
assert.equal(
  recoveringSetItemCount,
  2,
  'Durable multi-window persistence must retry after a quota failure once the next payload is smaller.',
);
assert.deepEqual(
  readMultiWindowWorkspaceState(recoveringStorage, 'workspace-recovering'),
  recoveringSmallState,
  'A recovered durable write must clear the volatile fallback and expose the latest persisted state.',
);

let oversizedSetItemCount = 0;
let oversizedStoredValue = '';
const oversizedMemoryStorage = new Map<string, string>();
const oversizedStorage = {
  getItem(key: string) {
    return oversizedMemoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    oversizedSetItemCount += 1;
    oversizedStoredValue = value;
    oversizedMemoryStorage.set(key, value);
  },
};
const oversizedState = buildMultiWindowWorkspaceState({
  now: () => '2026-04-28T00:00:05.000Z',
  panes: [
    {
      ...persistedState.panes[0]!,
      id: 'multiwindow-pane-oversized',
      parameters: {
        ...persistedState.panes[0]!.parameters,
        systemPrompt: 'x'.repeat(2_000_000),
      },
      title: 'Oversized pane',
    },
  ],
  windowCount: 2,
  workspaceId: 'workspace-oversized',
});
writeMultiWindowWorkspaceState(oversizedStorage, oversizedState);
assert.equal(
  oversizedSetItemCount,
  1,
  'Oversized multi-window workspace state must compact durable localStorage writes instead of writing the full payload.',
);
assert.ok(
  new TextEncoder().encode(oversizedStoredValue).byteLength <=
    MAX_MULTI_WINDOW_DURABLE_WORKSPACE_STATE_BYTES,
  'Compacted multi-window workspace state must stay within the durable storage byte budget.',
);
assert.equal(
  JSON.parse(oversizedStoredValue).panes[0].parameters.systemPrompt.length,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  'Durable multi-window persistence must bound large system prompts while preserving the active in-memory prompt.',
);
assert.deepEqual(
  readMultiWindowWorkspaceState(oversizedStorage, 'workspace-oversized'),
  oversizedState,
  'Oversized workspace state must remain available through same-session volatile fallback.',
);
assert.equal(
  readMultiWindowWorkspaceState({
    getItem(key: string) {
      return oversizedMemoryStorage.get(key) ?? null;
    },
    setItem() {
      throw new Error('reloaded storage should only be read');
    },
  }, 'workspace-oversized')?.panes[0]?.parameters.systemPrompt.length,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  'A fresh page load must hydrate the compact durable state instead of a stale oversized payload.',
);

const alignedPane = {
  codingSessionId: 'session-aligned',
  enabled: true,
  id: 'multiwindow-pane-aligned',
  mode: 'chat' as const,
  parameters: {
    maxOutputTokens: 4096,
    systemPrompt: '',
    temperature: 0.2,
    topP: 0.9,
  },
  previewUrl: 'about:blank',
  projectId: 'project-aligned',
  selectedEngineId: 'codex',
  selectedModelId: 'gpt-5-codex',
  title: '1. Aligned',
};
assert.deepEqual(
  resolveMultiWindowPaneSessionProvisioningStatus(alignedPane, {
    codingSessionId: 'session-aligned',
    engineId: 'codex',
    modelId: 'gpt-5-codex',
  }),
  {
    reason: 'session-ready',
    status: 'ready',
  },
  'A pane whose bound session matches its engine/model configuration is ready to dispatch.',
);
assert.deepEqual(
  resolveMultiWindowPaneDispatchability(alignedPane, {
    codingSessionId: 'session-aligned',
    engineId: 'codex',
    modelId: 'gpt-5-codex',
  }),
  {
    reason: 'session-ready',
    requiresSessionProvisioning: false,
    status: 'dispatchable',
  },
  'Pane dispatchability must treat a matching bound session as immediately dispatchable.',
);
assert.deepEqual(
  resolveMultiWindowPaneDispatchability(
    {
      ...alignedPane,
      selectedModelId: 'gpt-5.4',
    },
    {
      codingSessionId: 'session-aligned',
      engineId: 'codex',
      modelId: 'gpt-5-codex',
    },
  ),
  {
    reason: 'engine-model-mismatch',
    requiresSessionProvisioning: true,
    status: 'dispatchable',
  },
  'Pane dispatchability must treat model mismatches as dispatchable because the page can provision a matching session.',
);
assert.deepEqual(
  resolveMultiWindowPaneDispatchability(
    {
      ...alignedPane,
      enabled: false,
    },
    null,
  ),
  {
    reason: 'disabled',
    requiresSessionProvisioning: false,
    status: 'not-dispatchable',
  },
  'Disabled panes must be explicitly not dispatchable before a broadcast starts.',
);
assert.deepEqual(
  resolveMultiWindowPaneDispatchability(
    {
      ...alignedPane,
      projectId: '',
    },
    null,
  ),
  {
    reason: 'missing-project',
    requiresSessionProvisioning: false,
    status: 'not-dispatchable',
  },
  'Panes without a project must be explicitly not dispatchable before a broadcast starts.',
);
assert.equal(
  countMultiWindowDispatchablePanes([
    {
      binding: {
        codingSessionId: 'session-aligned',
        engineId: 'codex',
        modelId: 'gpt-5-codex',
      },
      pane: alignedPane,
    },
    {
      binding: null,
      pane: {
        ...alignedPane,
        codingSessionId: '',
      },
    },
    {
      binding: null,
      pane: {
        ...alignedPane,
        enabled: false,
      },
    },
    {
      binding: null,
      pane: {
        ...alignedPane,
        projectId: '',
      },
    },
  ]),
  2,
  'Dispatchable pane count must include ready panes and auto-provisionable panes while excluding disabled or projectless panes.',
);
assert.equal(
  resolveMultiWindowComposerDisabledReason({
    dispatchablePaneCount: 0,
    hasFetchedProjects: false,
    projectCount: 0,
    visiblePaneCount: 0,
  }),
  'loading',
  'Composer disabled reason must prioritize project inventory loading.',
);
assert.equal(
  resolveMultiWindowComposerDisabledReason({
    dispatchablePaneCount: 0,
    hasFetchedProjects: true,
    projectCount: 0,
    visiblePaneCount: 0,
  }),
  'no-projects',
  'Composer disabled reason must explain when no projects are available.',
);
assert.equal(
  resolveMultiWindowComposerDisabledReason({
    dispatchablePaneCount: 0,
    hasFetchedProjects: true,
    projectCount: 1,
    visiblePaneCount: 0,
  }),
  'no-windows',
  'Composer disabled reason must explain when no windows are visible.',
);
assert.equal(
  resolveMultiWindowComposerDisabledReason({
    dispatchablePaneCount: 0,
    hasFetchedProjects: true,
    projectCount: 1,
    visiblePaneCount: 2,
  }),
  'no-dispatchable-windows',
  'Composer disabled reason must explain when visible windows cannot receive a broadcast.',
);
assert.equal(
  resolveMultiWindowComposerDisabledReason({
    dispatchablePaneCount: 1,
    hasFetchedProjects: true,
    projectCount: 1,
    visiblePaneCount: 2,
  }),
  null,
  'Composer disabled reason must clear once at least one visible pane can receive a broadcast.',
);
assert.deepEqual(
  resolveMultiWindowPaneSessionProvisioningStatus(
    {
      ...alignedPane,
      selectedModelId: 'gpt-5.4',
    },
    {
      codingSessionId: 'session-aligned',
      engineId: 'codex',
      modelId: 'gpt-5-codex',
    },
  ),
  {
    reason: 'engine-model-mismatch',
    status: 'needs-session',
  },
  'A pane with a different selected model must create a new session instead of silently reusing the old model.',
);
assert.deepEqual(
  resolveMultiWindowPaneSessionProvisioningStatus(
    {
      ...alignedPane,
      codingSessionId: '',
    },
    null,
  ),
  {
    reason: 'missing-session',
    status: 'needs-session',
  },
  'A configured project without a session must be auto-provisioned before dispatch.',
);
assert.deepEqual(
  resolveMultiWindowPaneSessionProvisioningStatus(
    {
      ...alignedPane,
      projectId: '',
    },
    null,
  ),
  {
    reason: 'missing-project',
    status: 'skipped',
  },
  'A pane without a project cannot create or dispatch a coding session.',
);
assert.equal(
  buildMultiWindowProvisionedSessionTitle(
    {
      ...alignedPane,
      selectedEngineId: 'opencode',
      selectedModelId: 'qwen3-coder',
      title: '2. Mobile checkout',
    },
    1,
  ),
  '2. Mobile checkout - opencode/qwen3-coder',
  'Provisioned sessions must include the pane title and model identity for later comparison.',
);

const profiledDispatch = buildMultiWindowPaneDispatchPrompt(
  'Create a checkout page',
  {
    ...alignedPane,
    parameters: {
      maxOutputTokens: 8192,
      systemPrompt: 'Use compact mobile-first React components.',
      temperature: 0.7,
      topP: 0.8,
    },
  },
);
assert.match(
  profiledDispatch.prompt,
  /System instructions for this multi-window pane:\nUse compact mobile-first React components\./,
  'Pane systemPrompt must be applied to the actual prompt text so it affects execution immediately.',
);
assert.match(
  profiledDispatch.prompt,
  /User request:\nCreate a checkout page/,
  'The compiled pane prompt must preserve the original user request.',
);
assert.deepEqual(
  profiledDispatch.executionProfile.parameterApplication,
  {
    maxOutputTokens: 'metadata',
    systemPrompt: 'inline-prompt',
    temperature: 'metadata',
    topP: 'metadata',
  },
  'Execution profile must explicitly describe which pane parameters affect the current execution path.',
);
const metadataWithProfile = buildMultiWindowMessageMetadata({
  broadcastId: 'broadcast-profile',
  executionProfile: profiledDispatch.executionProfile,
  pane: alignedPane,
  paneIndex: 0,
  windowCount: 2,
});
assert.equal(
  (metadataWithProfile.multiWindow as Record<string, unknown>).executionProfile,
  profiledDispatch.executionProfile,
  'Multi-window message metadata must include the execution profile for downstream observability.',
);
assert.equal(
  (metadataWithProfile.multiWindow as Record<string, unknown>).parameters,
  profiledDispatch.executionProfile.parameters,
  'Multi-window metadata parameters must reuse the normalized execution profile parameters when a profile exists.',
);

assert.equal(
  resolveMultiWindowPaneAutoPreviewUrl([
    {
      content: 'Docs: https://docs.example.com. Preview: http://localhost:5173/mobile-checkout.',
    },
  ]),
  'http://localhost:5173/mobile-checkout',
  'Preview URL detection must prefer runnable local preview URLs and trim trailing punctuation.',
);
assert.equal(
  resolveMultiWindowPaneAutoPreviewUrl([
    {
      content: 'First preview is http://localhost:3000/old',
    },
    {
      content: 'Latest deployed preview: https://preview.example.com/build/42',
    },
  ]),
  'http://localhost:3000/old',
  'Preview URL detection must keep local development URLs ahead of generic links so panes open runnable dev servers.',
);
assert.equal(
  resolveMultiWindowPaneAutoPreviewUrl([
    {
      content: 'No preview url here.',
    },
  ]),
  null,
  'Preview URL detection must return null when no http(s) preview URL is present.',
);

console.log('multi-window runtime contract passed.');
