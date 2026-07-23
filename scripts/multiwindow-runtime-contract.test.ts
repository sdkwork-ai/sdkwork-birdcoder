import assert from 'node:assert/strict';

import {
  DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT,
  MAX_MULTI_WINDOW_PANES,
  MULTI_WINDOW_LAYOUT_COUNTS,
  normalizeMultiWindowActiveWindowCount,
  normalizeMultiWindowLayoutCount,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowLayout.ts';
import {
  buildMultiWindowPendingAddProgress,
  resolveNextMultiWindowAddWindowCount,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowAddFlow.ts';
import {
  collectFailedMultiWindowDispatchPaneIds,
  dispatchMultiWindowPrompt,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowDispatch.ts';
import {
  countMultiWindowDispatchablePanes,
  resolveMultiWindowComposerDisabledReason,
  resolveMultiWindowPaneDispatchability,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowDispatchability.ts';
import {
  buildMultiWindowMessageMetadata,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowMessageMetadata.ts';
import {
  buildMultiWindowPaneDispatchPrompt,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowPromptProfile.ts';
import {
  resolveMultiWindowPaneAutoPreviewUrl,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowPreviewUrl.ts';
import {
  buildMultiWindowProvisionedSessionTitle,
  resolveMultiWindowPaneSessionProvisioningStatus,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowSessionProvisioning.ts';
import {
  buildMultiWindowLayoutState,
  createMultiWindowLayoutStateStorageKey,
  MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  MAX_MULTI_WINDOW_DURABLE_LAYOUT_STATE_BYTES,
  readMultiWindowLayoutState,
  writeMultiWindowLayoutState,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/runtime/multiWindowLayoutState.ts';

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
      agentSessionId: 'session-a',
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
      agentSessionId: 'session-b',
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
      agentSessionId: 'session-c',
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
      agentSessionId: 'session-d',
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
      agentSessionId: 'duplicate-session',
      durationMs: 1,
      paneId: 'pane-2',
      projectId: 'project-b',
      status: 'failed',
    },
    {
      agentSessionId: 'session-late-failure',
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
      agentSessionId: '',
      requiresSessionProvisioning: true,
      sendPrompt: async ({ agentSessionId, prompt }) => {
        assert.equal(
          agentSessionId,
          '',
          'Auto-provisioned panes must be able to dispatch before a session id exists.',
        );
        assert.equal(prompt, 'Create a comparative mobile UI');
        return {
          agentSessionId: 'session-auto-created',
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
  autoProvisionedResult.results[0]?.agentSessionId,
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
      agentSessionId: 'session-a',
      sendPrompt: async () => undefined,
    },
    {
      id: 'progress-pane-2',
      enabled: true,
      projectId: 'project-b',
      agentSessionId: 'session-b',
      sendPrompt: async () => {
        throw new Error('provider quota exceeded');
      },
    },
    {
      id: 'progress-pane-3',
      enabled: false,
      projectId: 'project-c',
      agentSessionId: 'session-c',
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
        agentSessionId: 'session-observer-failure',
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

const stoppedEvents: Array<[string, string]> = [];
const stoppedController = new AbortController();
stoppedController.abort();
const stoppedResult = await dispatchMultiWindowPrompt({
  maxConcurrentDispatches: 2,
  onPaneResult: (event) => {
    stoppedEvents.push([event.paneId, event.status]);
  },
  panes: [
    {
      id: 'stopped-pane-1',
      enabled: true,
      projectId: 'project-a',
      agentSessionId: 'session-a',
      sendPrompt: async () => {
        throw new Error('stopped panes must not dispatch');
      },
    },
    {
      id: 'stopped-pane-2',
      enabled: true,
      projectId: 'project-b',
      agentSessionId: 'session-b',
      sendPrompt: async () => {
        throw new Error('stopped panes must not dispatch');
      },
    },
  ],
  prompt: 'Do not dispatch after stop',
  signal: stoppedController.signal,
});
assert.equal(
  stoppedResult.status,
  'stopped',
  'A pre-stopped multi-window batch must return an explicit stopped status.',
);
assert.deepEqual(
  stoppedResult.results.map((paneResult) => [paneResult.paneId, paneResult.status]),
  [
    ['stopped-pane-1', 'not-submitted'],
    ['stopped-pane-2', 'not-submitted'],
  ],
  'A stopped batch must mark every dispatchable pane as not submitted without calling sendPrompt.',
);
assert.equal(
  stoppedResult.summary.notSubmittedPaneCount,
  2,
  'Batch summary must expose not-submitted panes for lifecycle observability.',
);
assert.deepEqual(
  stoppedEvents,
  [
    ['stopped-pane-1', 'not-submitted'],
    ['stopped-pane-2', 'not-submitted'],
  ],
  'Stopped panes must publish deterministic lifecycle progress events.',
);

let releaseActivePane: (() => void) | null = null;
let activePaneStarted: (() => void) | null = null;
const activePaneStartedPromise = new Promise<void>((resolve) => {
  activePaneStarted = resolve;
});
const activePaneReleasePromise = new Promise<void>((resolve) => {
  releaseActivePane = resolve;
});
const midFlightStopController = new AbortController();
let midFlightSecondPaneCalls = 0;
const midFlightResultPromise = dispatchMultiWindowPrompt({
  maxConcurrentDispatches: 1,
  panes: [
    {
      id: 'mid-flight-active',
      enabled: true,
      projectId: 'project-mid-flight-a',
      agentSessionId: 'session-mid-flight-a',
      sendPrompt: async () => {
        activePaneStarted?.();
        await activePaneReleasePromise;
      },
    },
    {
      id: 'mid-flight-pending',
      enabled: true,
      projectId: 'project-mid-flight-b',
      agentSessionId: 'session-mid-flight-b',
      sendPrompt: async () => {
        midFlightSecondPaneCalls += 1;
      },
    },
  ],
  prompt: 'Stop only undispatched windows',
  signal: midFlightStopController.signal,
});
await activePaneStartedPromise;
midFlightStopController.abort();
releaseActivePane?.();
const midFlightResult = await midFlightResultPromise;
assert.equal(
  midFlightResult.results.find((result) => result.paneId === 'mid-flight-active')?.status,
  'success',
  'A prompt already submitted before stop must report its real completion result.',
);
assert.equal(
  midFlightResult.results.find((result) => result.paneId === 'mid-flight-pending')?.status,
  'not-submitted',
  'Stopping a batch must prevent queued panes from being submitted.',
);
assert.equal(midFlightSecondPaneCalls, 0);
assert.equal(midFlightResult.status, 'stopped');

const memoryStorage = new Map<string, string>();
const storage = {
  getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
};
const persistedState = buildMultiWindowLayoutState({
  layoutScopeId: MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID,
  now: () => '2026-04-28T00:00:00.000Z',
  panes: [
    {
      agentSessionId: 'session-a',
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
});
writeMultiWindowLayoutState(storage, persistedState);
assert.ok(
  memoryStorage.has(createMultiWindowLayoutStateStorageKey(MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID)),
  'Multi-window layout state must be stored under the selected layout-scope key.',
);
assert.deepEqual(
  readMultiWindowLayoutState(storage, MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID),
  persistedState,
  'Multi-window layout state must round-trip every pane configuration and layout setting.',
);
storage.setItem(
  createMultiWindowLayoutStateStorageKey(MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID),
  '{"version":999}',
);
assert.equal(
  readMultiWindowLayoutState(storage, MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID),
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
  readMultiWindowLayoutState(inaccessibleStorage, 'layout-inaccessible'),
  null,
  'Blocked browser storage reads must be ignored instead of crashing startup hydration.',
);
assert.equal(
  inaccessibleGetItemCount,
  1,
  'Startup hydration should attempt each layout storage read once before falling back.',
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
const quotaFallbackState = buildMultiWindowLayoutState({
  layoutScopeId: 'layout-quota',
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
});
assert.doesNotThrow(
  () => writeMultiWindowLayoutState(quotaExceededStorage, quotaFallbackState),
  'Multi-window layout persistence must not crash React effects when browser storage quota is exceeded.',
);
assert.deepEqual(
  readMultiWindowLayoutState(quotaExceededStorage, 'layout-quota'),
  quotaFallbackState,
  'Quota-exceeded writes must keep the latest layout state in a same-session volatile fallback.',
);
writeMultiWindowLayoutState(quotaExceededStorage, {
  ...quotaFallbackState,
  updatedAt: '2026-04-28T00:00:02.000Z',
});
assert.equal(
  quotaExceededSetItemCount,
  1,
  'After a quota failure, repeated writes for the same layout key must use volatile fallback without hammering localStorage.setItem again.',
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
const recoveringLargeState = buildMultiWindowLayoutState({
  layoutScopeId: 'layout-recovering',
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
});
const recoveringSmallState = buildMultiWindowLayoutState({
  layoutScopeId: 'layout-recovering',
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
});
writeMultiWindowLayoutState(recoveringStorage, recoveringLargeState);
writeMultiWindowLayoutState(recoveringStorage, recoveringSmallState);
assert.equal(
  recoveringSetItemCount,
  2,
  'Durable multi-window persistence must retry after a quota failure once the next payload is smaller.',
);
assert.deepEqual(
  readMultiWindowLayoutState(recoveringStorage, 'layout-recovering'),
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
const oversizedState = buildMultiWindowLayoutState({
  layoutScopeId: 'layout-oversized',
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
});
writeMultiWindowLayoutState(oversizedStorage, oversizedState);
assert.equal(
  oversizedSetItemCount,
  1,
  'Oversized multi-window layout state must compact durable localStorage writes instead of writing the full payload.',
);
assert.ok(
  new TextEncoder().encode(oversizedStoredValue).byteLength <=
    MAX_MULTI_WINDOW_DURABLE_LAYOUT_STATE_BYTES,
  'Compacted multi-window layout state must stay within the durable storage byte budget.',
);
assert.equal(
  JSON.parse(oversizedStoredValue).panes[0].parameters.systemPrompt.length,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  'Durable multi-window persistence must bound large system prompts while preserving the active in-memory prompt.',
);
assert.deepEqual(
  readMultiWindowLayoutState(oversizedStorage, 'layout-oversized'),
  oversizedState,
  'Oversized layout state must remain available through same-session volatile fallback.',
);
assert.equal(
  readMultiWindowLayoutState({
    getItem(key: string) {
      return oversizedMemoryStorage.get(key) ?? null;
    },
    setItem() {
      throw new Error('reloaded storage should only be read');
    },
  }, 'layout-oversized')?.panes[0]?.parameters.systemPrompt.length,
  MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
  'A fresh page load must hydrate the compact durable state instead of a stale oversized payload.',
);

const alignedPane = {
  agentSessionId: 'session-aligned',
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
    agentSessionId: 'session-aligned',
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
    agentSessionId: 'session-aligned',
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
      agentSessionId: 'session-aligned',
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
        agentSessionId: 'session-aligned',
        engineId: 'codex',
        modelId: 'gpt-5-codex',
      },
      pane: alignedPane,
    },
    {
      binding: null,
      pane: {
        ...alignedPane,
        agentSessionId: '',
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
      agentSessionId: 'session-aligned',
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
      agentSessionId: '',
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
