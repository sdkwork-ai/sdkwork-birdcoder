import {
  MAX_MULTI_WINDOW_PANES,
  normalizeMultiWindowActiveWindowCount,
} from './multiWindowLayout.ts';
import type {
  MultiWindowPaneConfig,
} from '../types.ts';

export const MULTI_WINDOW_LAYOUT_STATE_VERSION = 1;
const MULTI_WINDOW_LAYOUT_STATE_STORAGE_PREFIX = 'sdkwork.birdcoder.multiwindow.layout';
export const MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID = 'default';
export const MAX_MULTI_WINDOW_DURABLE_LAYOUT_STATE_BYTES = 128 * 1024;
export const MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS = 8_192;
const MAX_MULTI_WINDOW_DURABLE_PREVIEW_URL_CHARS = 2_048;
const DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS = {
  maxOutputTokens: 4096,
  systemPrompt: '',
  temperature: 0.2,
  topP: 0.9,
};

export interface MultiWindowLayoutState {
  layoutScopeId: string;
  panes: MultiWindowPaneConfig[];
  updatedAt: string;
  version: typeof MULTI_WINDOW_LAYOUT_STATE_VERSION;
  windowCount: number;
}

export interface MultiWindowLayoutStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const volatileLayoutStateFallbackByStorage = new WeakMap<
  MultiWindowLayoutStateStorage,
  Map<string, string>
>();
const durableLayoutStateWriteFailuresByStorage = new WeakMap<
  MultiWindowLayoutStateStorage,
  Map<string, number>
>();

interface BuildMultiWindowLayoutStateOptions {
  layoutScopeId: string;
  now?: () => string;
  panes: readonly MultiWindowPaneConfig[];
  windowCount: number;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeLayoutScopeId(value: string): string {
  return value.trim() || MULTI_WINDOW_DEFAULT_LAYOUT_SCOPE_ID;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readVolatileLayoutStateFallback(
  storage: MultiWindowLayoutStateStorage,
  key: string,
): string | null {
  return volatileLayoutStateFallbackByStorage.get(storage)?.get(key) ?? null;
}

function writeVolatileLayoutStateFallback(
  storage: MultiWindowLayoutStateStorage,
  key: string,
  value: string,
): void {
  const storageFallback =
    volatileLayoutStateFallbackByStorage.get(storage) ?? new Map<string, string>();
  storageFallback.set(key, value);
  volatileLayoutStateFallbackByStorage.set(storage, storageFallback);
}

function clearVolatileLayoutStateFallback(
  storage: MultiWindowLayoutStateStorage,
  key: string,
): void {
  const storageFallback = volatileLayoutStateFallbackByStorage.get(storage);
  if (!storageFallback) {
    return;
  }

  storageFallback.delete(key);
  if (storageFallback.size === 0) {
    volatileLayoutStateFallbackByStorage.delete(storage);
  }
}

function getUtf8ByteLength(value: string): number {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7ff) {
      byteLength += 2;
    } else if (codePoint <= 0xffff) {
      byteLength += 3;
    } else {
      byteLength += 4;
      index += 1;
    }
  }

  return byteLength;
}

function truncateDurableText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function readDurableLayoutStateWriteFailureBytes(
  storage: MultiWindowLayoutStateStorage,
  key: string,
): number | null {
  return durableLayoutStateWriteFailuresByStorage.get(storage)?.get(key) ?? null;
}

function rememberDurableLayoutStateWriteFailure(
  storage: MultiWindowLayoutStateStorage,
  key: string,
  payloadBytes: number,
): void {
  const failures =
    durableLayoutStateWriteFailuresByStorage.get(storage) ?? new Map<string, number>();
  failures.set(key, payloadBytes);
  durableLayoutStateWriteFailuresByStorage.set(storage, failures);
}

function clearDurableLayoutStateWriteFailure(
  storage: MultiWindowLayoutStateStorage,
  key: string,
): void {
  const failures = durableLayoutStateWriteFailuresByStorage.get(storage);
  if (!failures) {
    return;
  }

  failures.delete(key);
  if (failures.size === 0) {
    durableLayoutStateWriteFailuresByStorage.delete(storage);
  }
}

interface SerializedMultiWindowLayoutState {
  isCompleteState: boolean;
  value: string;
}

interface MultiWindowLayoutStateSerialization {
  completeValue: string;
  durableState: SerializedMultiWindowLayoutState | null;
}

function buildCompactDurableLayoutState(
  state: MultiWindowLayoutState,
): MultiWindowLayoutState {
  return {
    ...state,
    panes: state.panes.map((pane) => ({
      ...pane,
      parameters: {
        ...pane.parameters,
        systemPrompt: truncateDurableText(
          pane.parameters.systemPrompt,
          MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS,
        ),
      },
      previewUrl: truncateDurableText(pane.previewUrl, MAX_MULTI_WINDOW_DURABLE_PREVIEW_URL_CHARS),
    })),
  };
}

function serializeMultiWindowLayoutStateForDurableStorage(
  state: MultiWindowLayoutState,
): MultiWindowLayoutStateSerialization {
  const completeState = JSON.stringify(state);
  if (getUtf8ByteLength(completeState) <= MAX_MULTI_WINDOW_DURABLE_LAYOUT_STATE_BYTES) {
    return {
      completeValue: completeState,
      durableState: {
        isCompleteState: true,
        value: completeState,
      },
    };
  }

  const compactState = JSON.stringify(buildCompactDurableLayoutState(state));
  if (getUtf8ByteLength(compactState) <= MAX_MULTI_WINDOW_DURABLE_LAYOUT_STATE_BYTES) {
    return {
      completeValue: completeState,
      durableState: {
        isCompleteState: false,
        value: compactState,
      },
    };
  }

  return {
    completeValue: completeState,
    durableState: null,
  };
}

function shouldSkipDurableLayoutStateWrite(
  storage: MultiWindowLayoutStateStorage,
  key: string,
  payloadBytes: number,
): boolean {
  const failedPayloadBytes = readDurableLayoutStateWriteFailureBytes(storage, key);
  return typeof failedPayloadBytes === 'number' && payloadBytes >= failedPayloadBytes;
}

function normalizePaneConfig(
  value: unknown,
  index: number,
): MultiWindowPaneConfig {
  const record = readRecord(value) ?? {};
  const parameters = readRecord(record.parameters);

  return {
    agentSessionId: normalizeText(record.agentSessionId),
    enabled: record.enabled !== false,
    id: normalizeText(record.id) || `multiwindow-pane-${index + 1}`,
    mode: normalizeText(record.mode) === 'preview' ? 'preview' : 'chat',
    parameters: {
      maxOutputTokens: Math.max(
        256,
        Math.min(
          128000,
          Math.floor(
            normalizeNumber(
              parameters?.maxOutputTokens,
              DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.maxOutputTokens,
            ),
          ),
        ),
      ),
      systemPrompt: normalizeText(parameters?.systemPrompt),
      temperature: Math.max(
        0,
        Math.min(
          2,
          normalizeNumber(parameters?.temperature, DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.temperature),
        ),
      ),
      topP: Math.max(
        0,
        Math.min(1, normalizeNumber(parameters?.topP, DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS.topP)),
      ),
    },
    previewUrl: normalizeText(record.previewUrl) || 'about:blank',
    projectId: normalizeText(record.projectId),
    selectedEngineId: normalizeText(record.selectedEngineId),
    selectedModelId: normalizeText(record.selectedModelId),
    title: normalizeText(record.title) || `Window ${index + 1}`,
  };
}

function normalizePaneConfigs(
  panes: unknown,
): MultiWindowPaneConfig[] {
  if (!Array.isArray(panes)) {
    return [];
  }

  return panes
    .slice(0, MAX_MULTI_WINDOW_PANES)
    .map((pane, index) => normalizePaneConfig(pane, index));
}

export function createMultiWindowLayoutStateStorageKey(layoutScopeId: string): string {
  return `${MULTI_WINDOW_LAYOUT_STATE_STORAGE_PREFIX}.${encodeURIComponent(
    normalizeLayoutScopeId(layoutScopeId),
  )}`;
}

export function buildMultiWindowLayoutState({
  layoutScopeId,
  now = () => new Date().toISOString(),
  panes,
  windowCount,
}: BuildMultiWindowLayoutStateOptions): MultiWindowLayoutState {
  return {
    layoutScopeId: normalizeLayoutScopeId(layoutScopeId),
    panes: normalizePaneConfigs(panes),
    updatedAt: now(),
    version: MULTI_WINDOW_LAYOUT_STATE_VERSION,
    windowCount: normalizeMultiWindowActiveWindowCount(windowCount),
  };
}

export function readMultiWindowLayoutState(
  storage: MultiWindowLayoutStateStorage | null | undefined,
  layoutScopeId: string,
): MultiWindowLayoutState | null {
  if (!storage) {
    return null;
  }

  const normalizedLayoutScopeId = normalizeLayoutScopeId(layoutScopeId);
  const storageKey = createMultiWindowLayoutStateStorageKey(normalizedLayoutScopeId);
  const rawValue =
    readVolatileLayoutStateFallback(storage, storageKey) ??
    (() => {
      try {
        return storage.getItem(storageKey);
      } catch {
        return null;
      }
    })();
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = readRecord(JSON.parse(rawValue));
    if (
      !parsed ||
      parsed.version !== MULTI_WINDOW_LAYOUT_STATE_VERSION ||
      normalizeLayoutScopeId(normalizeText(parsed.layoutScopeId)) !== normalizedLayoutScopeId
    ) {
      return null;
    }

    const panes = normalizePaneConfigs(parsed.panes);
    if (panes.length === 0) {
      return null;
    }

    return {
      layoutScopeId: normalizedLayoutScopeId,
      panes,
      updatedAt: normalizeText(parsed.updatedAt) || new Date(0).toISOString(),
      version: MULTI_WINDOW_LAYOUT_STATE_VERSION,
      windowCount: normalizeMultiWindowActiveWindowCount(
        typeof parsed.windowCount === 'number' ? parsed.windowCount : undefined,
      ),
    };
  } catch {
    return null;
  }
}

export function writeMultiWindowLayoutState(
  storage: MultiWindowLayoutStateStorage | null | undefined,
  state: MultiWindowLayoutState,
): void {
  if (!storage) {
    return;
  }

  const storageKey = createMultiWindowLayoutStateStorageKey(state.layoutScopeId);
  const serializedState = serializeMultiWindowLayoutStateForDurableStorage(state);
  const durableState = serializedState.durableState;
  if (!durableState) {
    writeVolatileLayoutStateFallback(storage, storageKey, serializedState.completeValue);
    return;
  }

  const durableStateBytes = getUtf8ByteLength(durableState.value);
  if (shouldSkipDurableLayoutStateWrite(storage, storageKey, durableStateBytes)) {
    writeVolatileLayoutStateFallback(storage, storageKey, serializedState.completeValue);
    return;
  }

  try {
    storage.setItem(storageKey, durableState.value);
    clearDurableLayoutStateWriteFailure(storage, storageKey);
    if (durableState.isCompleteState) {
      clearVolatileLayoutStateFallback(storage, storageKey);
    } else {
      writeVolatileLayoutStateFallback(storage, storageKey, serializedState.completeValue);
    }
  } catch {
    rememberDurableLayoutStateWriteFailure(storage, storageKey, durableStateBytes);
    writeVolatileLayoutStateFallback(storage, storageKey, serializedState.completeValue);
  }
}

export function resolveBrowserMultiWindowLayoutStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
