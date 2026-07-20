import {
  createAuthorizedFetchEventSourceFactory,
  createWebRuntimeBridgeClient,
  type WebRuntimeBridgeClient,
} from '@sdkwork/terminal-pc-infrastructure';
import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-infrastructure/services/appSessionTokenManager';
import { readBirdCoderRuntimePublicEnv } from '@sdkwork/birdcoder-pc-infrastructure/services/runtimeTopology';
export { isBirdcoderTauriRuntime } from './runtimeTarget.ts';

export interface BirdcoderBrowserTerminalScope {
  projectId?: string | null;
  runtimeLocationId?: string | null;
}

export interface BirdcoderBrowserTerminalTarget {
  projectId: string;
  runtimeLocationId: string;
  modeTags: ['cli-native'];
  tags: string[];
}

export function resolveBirdcoderBrowserTerminalTarget(
  scope: BirdcoderBrowserTerminalScope,
): BirdcoderBrowserTerminalTarget | undefined {
  const projectId = scope.projectId?.trim();
  const runtimeLocationId = scope.runtimeLocationId?.trim();
  if (!projectId || !runtimeLocationId) {
    return undefined;
  }

  return {
    projectId,
    runtimeLocationId,
    modeTags: ['cli-native'],
    tags: [
      'surface:browser',
      `project:${projectId}`,
    ],
  };
}

export function resolveBirdcoderBrowserTerminalClient(): WebRuntimeBridgeClient | undefined {
  const tokenManager = getBirdCoderGlobalTokenManager();
  const tokens = tokenManager.getTokens();
  const authToken = tokens?.authToken?.trim();
  const accessToken = tokens?.accessToken?.trim();
  if (!authToken || !accessToken) {
    return undefined;
  }

  const baseUrl = readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL')
    || readBirdCoderRuntimePublicEnv('VITE_BIRDCODER_API_BASE_URL')
    || '';
  return createWebRuntimeBridgeClient({
    baseUrl,
    authToken,
    accessToken,
    tokenManager,
    createEventSource: createAuthorizedFetchEventSourceFactory(authToken, {
      accessToken,
      tokenManager,
    }),
  });
}

export const useBirdcoderBrowserTerminalClient = resolveBirdcoderBrowserTerminalClient;

export function resolveBirdcoderTerminalUnavailableMessage(): string {
  const locale = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return locale.startsWith('zh')
    ? 'Browser \u7ec8\u7aef\u9700\u8981\u6709\u6548\u7684\u767b\u5f55\u4f1a\u8bdd\u548c\u53ef\u7528\u7684 Terminal App API\u3002'
    : 'Browser terminal requires an authenticated session and an available Terminal App API.';
}
