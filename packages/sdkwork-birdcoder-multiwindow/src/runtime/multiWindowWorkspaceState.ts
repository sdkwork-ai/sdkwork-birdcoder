import {
  MAX_MULTI_WINDOW_PANES,
  normalizeMultiWindowActiveWindowCount,
} from './multiWindowLayout.ts';
import type {
  MultiWindowPaneConfig,
} from '../types.ts';

export const MULTI_WINDOW_WORKSPACE_STATE_VERSION = 2;
const MULTI_WINDOW_WORKSPACE_STATE_STORAGE_PREFIX = 'sdkwork.birdcoder.multiwindow.workspace';
export const MAX_MULTI_WINDOW_DURABLE_WORKSPACE_STATE_BYTES = 128 * 1024;
export const MAX_MULTI_WINDOW_DURABLE_SYSTEM_PROMPT_CHARS = 8_192;
const MAX_MULTI_WINDOW_DURABLE_PREVIEW_URL_CHARS = 2_048;
const DEFAULT_MULTI_WINDOW_MODEL_PARAMETERS = {
  maxOutputTokens: 4096,
  systemPrompt: '',
  temperature: 0.2,
  topP: 0.9,
};

export interface MultiWindowWorkspaceState {
  panes: MultiWindowPaneConfig[];
  updatedAt: string;
  version: typeof MULTI_WINDOW_WORKSPACE_STATE_VERSION;
  windowCount: number;
  workspaceId: string;
}

export interface MultiWindowWorkspaceStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const volatileWorkspaceStateFallbackByStorage = new WeakMap<
  MultiWindowWorkspaceStateStorage,
  Map<string, string>
>();
const durableWorkspaceStateWriteFailuresByStorage = new WeakMap<
  MultiWindowWorkspaceStateStorage,
  Map<string, number>
>();

interface BuildMultiWindowWorkspaceStateOptions {
  now?: () => string;
  panes: readonly MultiWindowPaneConfig[];
  windowCount: number;
  workspaceId: string;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeWorkspaceId(value: string): string {
  return value.trim() || 'default';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readVolatileWorkspaceStateFallback(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
): string | null {
  return volatileWorkspaceStateFallbackByStorage.get(storage)?.get(key) ?? null;
}

function writeVolatileWorkspaceStateFallback(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
  value: string,
): void {
  const storageFallback =
    volatileWorkspaceStateFallbackByStorage.get(storage) ?? new Map<string, string>();
  storageFallback.set(key, value);
  volatileWorkspaceStateFallbackByStorage.set(storage, storageFallback);
}

function clearVolatileWorkspaceStateFallback(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
): void {
  const storageFallback = volatileWorkspaceStateFallbackByStorage.get(storage);
  if (!storageFallback) {
    return;
  }

  storageFallback.delete(key);
  if (storageFallback.size === 0) {
    volatileWorkspaceStateFallbackByStorage.delete(storage);
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

function readDurableWorkspaceStateWriteFailureBytes(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
): number | null {
  return durableWorkspaceStateWriteFailuresByStorage.get(storage)?.get(key) ?? null;
}

function rememberDurableWorkspaceStateWriteFailure(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
  payloadBytes: number,
): void {
  const failures =
    durableWorkspaceStateWriteFailuresByStorage.get(storage) ?? new Map<string, number>();
  failures.set(key, payloadBytes);
  durableWorkspaceStateWriteFailuresByStorage.set(storage, failures);
}

function clearDurableWorkspaceStateWriteFailure(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
): void {
  const failures = durableWorkspaceStateWriteFailuresByStorage.get(storage);
  if (!failures) {
    return;
  }

  failures.delete(key);
  if (failures.size === 0) {
    durableWorkspaceStateWriteFailuresByStorage.delete(storage);
  }
}

interface SerializedMultiWindowWorkspaceState {
  isCompleteState: boolean;
  value: string;
}

function buildCompactDurableWorkspaceState(
  state: MultiWindowWorkspaceState,
): MultiWindowWorkspaceState {
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

function serializeMultiWindowWorkspaceStateForDurableStorage(
  state: MultiWindowWorkspaceState,
): SerializedMultiWindowWorkspaceState | null {
  const completeState = JSON.stringify(state);
  if (getUtf8ByteLength(completeState) <= MAX_MULTI_WINDOW_DURABLE_WORKSPACE_STATE_BYTES) {
    return {
      isCompleteState: true,
      value: completeState,
    };
  }

  const compactState = JSON.stringify(buildCompactDurableWorkspaceState(state));
  if (getUtf8ByteLength(compactState) <= MAX_MULTI_WINDOW_DURABLE_WORKSPACE_STATE_BYTES) {
    return {
      isCompleteState: false,
      value: compactState,
    };
  }

  return null;
}

function shouldSkipDurableWorkspaceStateWrite(
  storage: MultiWindowWorkspaceStateStorage,
  key: string,
  payloadBytes: number,
): boolean {
  const failedPayloadBytes = readDurableWorkspaceStateWriteFailureBytes(storage, key);
  return typeof failedPayloadBytes === 'number' && payloadBytes >= failedPayloadBytes;
}

function normalizePaneConfig(
  value: unknown,
  index: number,
): MultiWindowPaneConfig {
  const record = readRecord(value) ?? {};
  const parameters = readRecord(record.parameters);

  return {
    codingSessionId: normalizeText(record.codingSessionId),
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

export function createMultiWindowWorkspaceStateStorageKey(workspaceId: string): string {
  return `${MULTI_WINDOW_WORKSPACE_STATE_STORAGE_PREFIX}.${encodeURIComponent(normalizeWorkspaceId(workspaceId))}`;
}

export function buildMultiWindowWorkspaceState({
  now = () => new Date().toISOString(),
  panes,
  windowCount,
  workspaceId,
}: BuildMultiWindowWorkspaceStateOptions): MultiWindowWorkspaceState {
  return {
    panes: normalizePaneConfigs(panes),
    updatedAt: now(),
    version: MULTI_WINDOW_WORKSPACE_STATE_VERSION,
    windowCount: normalizeMultiWindowActiveWindowCount(windowCount),
    workspaceId: normalizeWorkspaceId(workspaceId),
  };
}

export function readMultiWindowWorkspaceState(
  storage: MultiWindowWorkspaceStateStorage | null | undefined,
  workspaceId: string,
): MultiWindowWorkspaceState | null {
  if (!storage) {
    return null;
  }

  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const storageKey = createMultiWindowWorkspaceStateStorageKey(normalizedWorkspaceId);
  const rawValue =
    readVolatileWorkspaceStateFallback(storage, storageKey) ??
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
      parsed.version !== MULTI_WINDOW_WORKSPACE_STATE_VERSION ||
      normalizeWorkspaceId(normalizeText(parsed.workspaceId)) !== normalizedWorkspaceId
    ) {
      return null;
    }

    const panes = normalizePaneConfigs(parsed.panes);
    if (panes.length === 0) {
      return null;
    }

    return {
      panes,
      updatedAt: normalizeText(parsed.updatedAt) || new Date(0).toISOString(),
      version: MULTI_WINDOW_WORKSPACE_STATE_VERSION,
      windowCount: normalizeMultiWindowActiveWindowCount(
        typeof parsed.windowCount === 'number' ? parsed.windowCount : undefined,
      ),
      workspaceId: normalizedWorkspaceId,
    };
  } catch {
    return null;
  }
}

export function writeMultiWindowWorkspaceState(
  storage: MultiWindowWorkspaceStateStorage | null | undefined,
  state: MultiWindowWorkspaceState,
): void {
  if (!storage) {
    return;
  }

  const storageKey = createMultiWindowWorkspaceStateStorageKey(state.workspaceId);
  const serializedState = JSON.stringify(state);
  const durableState = serializeMultiWindowWorkspaceStateForDurableStorage(state);
  if (!durableState) {
    writeVolatileWorkspaceStateFallback(storage, storageKey, serializedState);
    return;
  }

  const durableStateBytes = getUtf8ByteLength(durableState.value);
  if (shouldSkipDurableWorkspaceStateWrite(storage, storageKey, durableStateBytes)) {
    writeVolatileWorkspaceStateFallback(storage, storageKey, serializedState);
    return;
  }

  try {
    storage.setItem(storageKey, durableState.value);
    clearDurableWorkspaceStateWriteFailure(storage, storageKey);
    if (durableState.isCompleteState) {
      clearVolatileWorkspaceStateFallback(storage, storageKey);
    } else {
      writeVolatileWorkspaceStateFallback(storage, storageKey, serializedState);
    }
  } catch {
    rememberDurableWorkspaceStateWriteFailure(storage, storageKey, durableStateBytes);
    writeVolatileWorkspaceStateFallback(storage, storageKey, serializedState);
  }
}

export function resolveBrowserMultiWindowWorkspaceStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
