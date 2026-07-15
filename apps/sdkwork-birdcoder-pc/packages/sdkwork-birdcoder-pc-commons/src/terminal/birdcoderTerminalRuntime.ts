import { useMemo, useSyncExternalStore } from 'react';
import {
  createAuthorizedFetchEventSourceFactory,
  createWebRuntimeBridgeClient,
  resolveWebRuntimeBridgeAuthToken,
  type WebRuntimeBridgeClient,
} from '@sdkwork/terminal-pc-infrastructure';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  getBirdCoderGlobalTokenManager,
  readBirdCoderRuntimePublicEnv,
} from '@sdkwork/birdcoder-pc-infrastructure';

export interface BirdcoderBrowserTerminalScope {
  projectId?: string;
  workspaceId?: string;
}

export interface BirdcoderBrowserTerminalTarget {
  workspaceId: string;
  authority: string;
  target: 'remote-runtime' | 'server-runtime-node';
  workingDirectory?: string;
  modeTags: ['cli-native'];
  tags: string[];
}

function readRuntimeTarget() {
  return readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET') ||
    readBirdCoderRuntimePublicEnv('VITE_SDKWORK_RUNTIME_TARGET');
}

export function isBirdcoderTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const runtimeTarget = readRuntimeTarget();
  if (runtimeTarget && runtimeTarget !== 'desktop') return false;

  const host = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };
  const hasInvoke = typeof host.__TAURI__?.core?.invoke === 'function' ||
    typeof host.__TAURI_INTERNALS__?.invoke === 'function';
  return hasInvoke && (runtimeTarget === 'desktop' || window.location.protocol === 'tauri:');
}

export function resolveBirdcoderBrowserTerminalTarget(
  scope: BirdcoderBrowserTerminalScope,
): BirdcoderBrowserTerminalTarget {
  const workspaceId = scope.workspaceId?.trim() ||
    readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_TERMINAL_WORKSPACE_ID') ||
    readBirdCoderRuntimePublicEnv('VITE_SDKWORK_TERMINAL_RUNTIME_WORKSPACE_ID') ||
    'birdcoder';
  const authority = readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_TERMINAL_AUTHORITY') ||
    readBirdCoderRuntimePublicEnv('VITE_SDKWORK_TERMINAL_RUNTIME_AUTHORITY') ||
    'birdcoder';
  const configuredTarget = readBirdCoderRuntimePublicEnv(
    'VITE_SDKWORK_BIRDCODER_TERMINAL_RUNTIME_TARGET',
  ) || readBirdCoderRuntimePublicEnv('VITE_SDKWORK_TERMINAL_RUNTIME_TARGET') ||
    'server-runtime-node';
  const workingDirectory = readBirdCoderRuntimePublicEnv(
    'VITE_SDKWORK_BIRDCODER_TERMINAL_WORKING_DIRECTORY',
  ) || undefined;

  return {
    workspaceId,
    authority,
    target: configuredTarget === 'remote-runtime' ? 'remote-runtime' : 'server-runtime-node',
    workingDirectory,
    modeTags: ['cli-native'],
    tags: [
      'birdcoder',
      ...(scope.projectId?.trim() ? [`project:${scope.projectId.trim()}`] : []),
      ...(workingDirectory ? [`cwd:${workingDirectory}`] : []),
    ],
  };
}

interface BirdcoderTerminalAuthTokens {
  accessToken: string;
  authToken: string;
}

let cachedBirdcoderTerminalAuthTokens: BirdcoderTerminalAuthTokens = {
  accessToken: '',
  authToken: '',
};

function readBirdcoderTerminalAuthTokens(): BirdcoderTerminalAuthTokens {
  const tokenManager = getBirdCoderGlobalTokenManager();
  const authToken = resolveWebRuntimeBridgeAuthToken(
    tokenManager.getAuthToken() || tokenManager.getAccessToken(),
  ) ?? '';
  const accessToken = tokenManager.getAccessToken()?.trim() ?? '';
  if (
    cachedBirdcoderTerminalAuthTokens.authToken === authToken
    && cachedBirdcoderTerminalAuthTokens.accessToken === accessToken
  ) {
    return cachedBirdcoderTerminalAuthTokens;
  }

  cachedBirdcoderTerminalAuthTokens = { accessToken, authToken };
  return cachedBirdcoderTerminalAuthTokens;
}

function subscribeBirdcoderTerminalAuthToken(listener: () => void): () => void {
  globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
  return () => globalThis.removeEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
}

export function useBirdcoderBrowserTerminalClient(): WebRuntimeBridgeClient | undefined {
  const { accessToken, authToken } = useSyncExternalStore(
    subscribeBirdcoderTerminalAuthToken,
    readBirdcoderTerminalAuthTokens,
    readBirdcoderTerminalAuthTokens,
  );

  return useMemo(() => {
    if (!authToken || !accessToken) return undefined;
    const baseUrl = readBirdCoderRuntimePublicEnv(
      'VITE_SDKWORK_BIRDCODER_TERMINAL_RUNTIME_BASE_URL',
    ) || readBirdCoderRuntimePublicEnv('VITE_SDKWORK_TERMINAL_RUNTIME_BASE_URL') ||
      getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl || '';
    return createWebRuntimeBridgeClient({
      baseUrl,
      authToken,
      accessToken,
      createEventSource: createAuthorizedFetchEventSourceFactory(authToken, { accessToken }),
    });
  }, [accessToken, authToken]);
}

export function resolveBirdcoderTerminalUnavailableMessage(): string {
  const locale = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return locale.startsWith('zh')
    ? '\u8bf7\u5148\u767b\u5f55 BirdCoder\uff0c\u7136\u540e\u91cd\u8bd5\u8fdc\u7a0b\u7ec8\u7aef\u8fde\u63a5\u3002'
    : 'Sign in to BirdCoder, then retry the remote terminal connection.';
}
