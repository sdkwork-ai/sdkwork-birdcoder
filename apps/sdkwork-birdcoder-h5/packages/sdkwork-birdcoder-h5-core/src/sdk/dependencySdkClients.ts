import {
  createClient as createAgentsAppClient,
  type SdkworkAppClient as AgentsAppClient,
} from '@sdkwork/agents-app-sdk';
import {
  createDriveAppClient,
  type SdkworkDriveAppClient,
} from '@sdkwork/drive-app-sdk';

import {
  resolveBirdCoderH5AgentsAppApiBaseUrl,
  resolveBirdCoderH5DriveAppApiBaseUrl,
} from '../bootstrap/runtimeConfig.ts';
import { getBirdCoderGlobalTokenManager } from '../bootstrap/tokenManager.ts';

let agentsClient: AgentsAppClient | null = null;
let driveClient: SdkworkDriveAppClient | null = null;

export function getBirdCoderH5AgentsAppClient(): AgentsAppClient {
  agentsClient ??= createAgentsAppClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderH5AgentsAppApiBaseUrl(),
    platform: 'h5',
    tokenManager: getBirdCoderGlobalTokenManager(),
  });
  return agentsClient;
}

export function getBirdCoderH5DriveAppClient(): SdkworkDriveAppClient {
  driveClient ??= createDriveAppClient({
    authMode: 'dual-token',
    baseUrl: resolveBirdCoderH5DriveAppApiBaseUrl().replace(/\/app\/v3\/api\/?$/u, ''),
    platform: 'h5',
    tokenManager: getBirdCoderGlobalTokenManager(),
  });
  return driveClient;
}

export function resetBirdCoderH5DependencySdkClients(): void {
  agentsClient = null;
  driveClient = null;
}
