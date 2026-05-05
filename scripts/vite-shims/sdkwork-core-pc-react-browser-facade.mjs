import { useMemo, useSyncExternalStore } from 'react';
import {
  applyRuntimeSessionToAppClient,
  getAppClientWithSession,
} from '../../../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts';
import {
  clearStoredPcReactRuntimeSession,
  configureRuntime,
  getImConnectionState,
  getPcReactEnv,
  getPcReactRuntimeVersion,
  persistPcReactRuntimeSession as persistStoredPcReactRuntimeSession,
  readPcReactRuntimeSession as readStoredPcReactRuntimeSession,
  resetRuntime,
  SDKWORK_PC_REACT_LEGACY_ACCESS_TOKEN_STORAGE_KEY,
  SDKWORK_PC_REACT_LEGACY_AUTH_TOKEN_STORAGE_KEY,
  SDKWORK_PC_REACT_LEGACY_REFRESH_TOKEN_STORAGE_KEY,
  subscribeImConnectionState,
  subscribePcReactRuntime,
} from '../../../sdkwork-core/sdkwork-core-pc-react/src/internal/runtimeState.ts';
import {
  getPcReactShellPreferencesVersion,
  readPcReactShellPreferences,
  resolvePcReactShellPreferences,
  subscribePcReactShellPreferences,
} from '../../../sdkwork-core/sdkwork-core-pc-react/src/internal/preferencesState.ts';
import {
  createPcReactLocaleFormatting,
  readPcReactShellBridgeValue,
  resolvePcReactLocaleDirection,
} from '../../../sdkwork-core/sdkwork-core-pc-react/src/runtime/shell-bridge.ts';

export * from '../../../sdkwork-core/sdkwork-core-pc-react/src/env/index.ts';
export * from '../../../sdkwork-core/sdkwork-core-pc-react/src/app/index.ts';
export * from '../../../sdkwork-core/sdkwork-core-pc-react/src/preferences/index.ts';

export function configurePcReactRuntime(options = {}) {
  return configureRuntime(options);
}

export function resetPcReactRuntime(options = {}) {
  resetRuntime(options);
}

export function persistRuntimeSession(session) {
  const nextSession = persistStoredPcReactRuntimeSession(session);
  applyRuntimeSessionToAppClient(nextSession);
  return nextSession;
}

export const persistPcReactRuntimeSession = persistRuntimeSession;

export function readRuntimeSession() {
  return readStoredPcReactRuntimeSession();
}

export const readPcReactRuntimeSession = readRuntimeSession;

export async function clearPcReactRuntimeSession() {
  clearStoredPcReactRuntimeSession();
  applyRuntimeSessionToAppClient(readStoredPcReactRuntimeSession());
}

export const SDKWORK_PC_REACT_LEGACY_STORAGE_KEYS = {
  authToken: SDKWORK_PC_REACT_LEGACY_AUTH_TOKEN_STORAGE_KEY,
  accessToken: SDKWORK_PC_REACT_LEGACY_ACCESS_TOKEN_STORAGE_KEY,
  refreshToken: SDKWORK_PC_REACT_LEGACY_REFRESH_TOKEN_STORAGE_KEY,
};

function useRuntimeSubscription() {
  useSyncExternalStore(
    subscribePcReactRuntime,
    getPcReactRuntimeVersion,
    getPcReactRuntimeVersion,
  );
}

function usePreferenceSubscription() {
  useSyncExternalStore(
    subscribePcReactShellPreferences,
    getPcReactShellPreferencesVersion,
    getPcReactShellPreferencesVersion,
  );
}

export function useAppClient() {
  useRuntimeSubscription();
  return getAppClientWithSession();
}

export function usePcReactEnv() {
  useRuntimeSubscription();
  return getPcReactEnv();
}

export function usePcReactRuntimeSession() {
  useRuntimeSubscription();
  return readRuntimeSession();
}

export function usePcReactShellPreferences() {
  usePreferenceSubscription();
  return readPcReactShellPreferences();
}

export function usePcReactResolvedShellPreferences() {
  usePreferenceSubscription();
  return resolvePcReactShellPreferences();
}

export function usePcReactShellBridgeValue() {
  useRuntimeSubscription();
  usePreferenceSubscription();

  const env = getPcReactEnv();
  const preferences = resolvePcReactShellPreferences();
  const session = readRuntimeSession();

  return useMemo(
    () => readPcReactShellBridgeValue(),
    [env, preferences, session],
  );
}

export {
  createPcReactLocaleFormatting,
  getImConnectionState,
  getPcReactEnv,
  getPcReactRuntimeVersion,
  readPcReactShellBridgeValue,
  resolvePcReactLocaleDirection,
  SDKWORK_PC_REACT_LEGACY_ACCESS_TOKEN_STORAGE_KEY,
  SDKWORK_PC_REACT_LEGACY_AUTH_TOKEN_STORAGE_KEY,
  SDKWORK_PC_REACT_LEGACY_REFRESH_TOKEN_STORAGE_KEY,
  subscribeImConnectionState,
  subscribePcReactRuntime,
};
