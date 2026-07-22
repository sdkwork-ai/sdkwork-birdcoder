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

interface BirdcoderBrowserTerminalClientCache {
  baseUrl: string;
  client: WebRuntimeBridgeClient;
  tokenManager: ReturnType<typeof getBirdCoderGlobalTokenManager>;
}

let browserTerminalClientCache: BirdcoderBrowserTerminalClientCache | undefined;

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

export function resolveBirdcoderBrowserTerminalClient(): WebRuntimeBridgeClient {
  const tokenManager = getBirdCoderGlobalTokenManager();
  const baseUrl = readBirdCoderRuntimePublicEnv('VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL')
    || readBirdCoderRuntimePublicEnv('VITE_BIRDCODER_API_BASE_URL')
    || '';

  if (
    browserTerminalClientCache?.baseUrl === baseUrl
    && browserTerminalClientCache.tokenManager === tokenManager
  ) {
    return browserTerminalClientCache.client;
  }

  const tokens = tokenManager.getTokens();
  const authToken = tokens.authToken?.trim() ?? '';
  const accessToken = tokens.accessToken?.trim();
  const client = createWebRuntimeBridgeClient({
    baseUrl,
    tokenManager,
    ...(authToken ? { authToken } : {}),
    ...(accessToken ? { accessToken } : {}),
    createEventSource: createAuthorizedFetchEventSourceFactory(authToken, {
      tokenManager,
      ...(accessToken ? { accessToken } : {}),
    }),
  });
  browserTerminalClientCache = { baseUrl, client, tokenManager };
  return client;
}

export const useBirdcoderBrowserTerminalClient = resolveBirdcoderBrowserTerminalClient;

export function resolveBirdcoderTerminalUnavailableMessage(): string {
  const locale = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return locale.startsWith('zh')
    ? '\u5f53\u524d\u9879\u76ee\u5c1a\u672a\u914d\u7f6e\u53ef\u7528\u7684\u8fdc\u7a0b\u7ec8\u7aef\u8fd0\u884c\u4f4d\u7f6e\u3002'
    : 'No remote terminal runtime is configured for the current project.';
}
