import {
  createBirdcoderBackendSdkClient,
  type BirdcoderBackendSdkClient,
} from '@sdkwork/birdcoder-backend-sdk';
import {
  getBirdCoderGlobalTokenManager as getCoreBirdCoderGlobalTokenManager,
  setBirdCoderGlobalTokenManager,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import type { BirdCoderApiTransport } from '@sdkwork/birdcoder-pc-types';
import type { AuthTokenManager } from '@sdkwork/sdk-common';

export interface BirdCoderGeneratedBackendSdkClientOptions {
  accessToken?: string;
  apiBaseUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  tokenManager?: AuthTokenManager;
  transport?: BirdCoderApiTransport;
}

type BirdCoderTokenManagerAwareClient<TClient> = TClient & {
  setTokenManager(manager: AuthTokenManager): BirdCoderTokenManagerAwareClient<TClient>;
};

export type BirdCoderTokenManagerAwareBackendSdkClient =
  BirdCoderTokenManagerAwareClient<BirdcoderBackendSdkClient>;

interface BirdCoderSdkTokenManagerRef {
  current?: AuthTokenManager;
}

export type BirdCoderBackendSdkTransportResolver = (
  options: BirdCoderGeneratedBackendSdkClientOptions,
  tokenManagerRef: BirdCoderSdkTokenManagerRef,
) => BirdCoderApiTransport;

let generatedBackendClient: BirdCoderTokenManagerAwareBackendSdkClient | null = null;
let backendSdkTransportResolver: BirdCoderBackendSdkTransportResolver = () =>
  createUnavailableBirdCoderGeneratedSdkTransport();

export function registerBirdCoderBackendSdkTransportResolver(
  resolver: BirdCoderBackendSdkTransportResolver,
): void {
  backendSdkTransportResolver = resolver;
}

export function createBirdCoderGeneratedBackendSdkClient(
  options: BirdCoderGeneratedBackendSdkClientOptions = {},
): BirdCoderTokenManagerAwareBackendSdkClient {
  const tokenManagerRef: BirdCoderSdkTokenManagerRef = {
    current: options.tokenManager ?? getCoreBirdCoderGlobalTokenManager(),
  };
  const client = createBirdcoderBackendSdkClient({
    accessToken: options.accessToken,
    authToken: options.authToken,
    transport: backendSdkTransportResolver(options, tokenManagerRef),
  });
  return attachBirdCoderBackendSdkTokenManager(client, tokenManagerRef);
}

export function getBirdCoderGeneratedBackendSdkClient(
  options: BirdCoderGeneratedBackendSdkClientOptions = {},
): BirdCoderTokenManagerAwareBackendSdkClient {
  if (options.tokenManager) {
    setBirdCoderBackendSdkTokenManager(options.tokenManager);
  }
  if (hasGeneratedBackendSdkRuntimeOverrides(options)) {
    return createBirdCoderGeneratedBackendSdkClient(options);
  }

  if (!generatedBackendClient) {
    generatedBackendClient = createBirdCoderGeneratedBackendSdkClient({
      tokenManager: getCoreBirdCoderGlobalTokenManager(),
    });
  }
  return generatedBackendClient;
}

export function setBirdCoderBackendSdkTokenManager(tokenManager: AuthTokenManager): void {
  setBirdCoderGlobalTokenManager(tokenManager);
  generatedBackendClient?.setTokenManager(tokenManager);
}

export function resetBirdCoderGeneratedBackendSdkClient(): void {
  generatedBackendClient = null;
}

function hasGeneratedBackendSdkRuntimeOverrides(
  options: BirdCoderGeneratedBackendSdkClientOptions,
): boolean {
  return Object.entries(options).some(([key, value]) => key !== 'tokenManager' && value !== undefined);
}

function createUnavailableBirdCoderGeneratedSdkTransport(): BirdCoderApiTransport {
  return {
    async request(request: Parameters<BirdCoderApiTransport['request']>[0]) {
      throw new Error(
        `BirdCoder generated backend SDK client is unavailable. Configure a backend API base URL or explicit transport before using ${request.method} ${request.path}.`,
      );
    },
  };
}

function attachBirdCoderBackendSdkTokenManager(
  client: BirdcoderBackendSdkClient,
  tokenManagerRef: BirdCoderSdkTokenManagerRef,
): BirdCoderTokenManagerAwareBackendSdkClient {
  const tokenManagerAwareClient = client as BirdCoderTokenManagerAwareBackendSdkClient;
  tokenManagerAwareClient.setTokenManager = (manager: AuthTokenManager) => {
    tokenManagerRef.current = manager;
    syncBirdCoderBackendSdkAuthTokensFromTokenManager(client, manager);
    return tokenManagerAwareClient;
  };
  if (tokenManagerRef.current) {
    syncBirdCoderBackendSdkAuthTokensFromTokenManager(client, tokenManagerRef.current);
  }
  return tokenManagerAwareClient;
}

function syncBirdCoderBackendSdkAuthTokensFromTokenManager(
  client: BirdcoderBackendSdkClient,
  tokenManager: AuthTokenManager,
): void {
  const tokens = tokenManager.getTokens();
  if (tokens.authToken || tokens.accessToken) {
    client.setSdkworkAuthTokens({
      ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
      ...(tokens.authToken ? { authToken: tokens.authToken } : {}),
    });
    return;
  }
  client.clearSdkworkAuthTokens();
}
