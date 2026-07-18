import type { SdkworkDriveAppClient } from '@sdkwork/birdcoder-pc-core/sdk/drive-app';
import {
  configureDriveSandboxExplorerRuntime,
  type SandboxExplorerPort,
} from '@sdkwork/drive-pc-sandbox-explorer';
import { createDriveSandboxExplorerSdkPort } from '@sdkwork/drive-pc-sandbox-explorer-sdk-adapter';
import { executeBirdCoderProtectedOperationWithRecovery } from './appSessionRecovery.ts';
import { getBirdCoderDriveAppClient } from './iamRuntime.ts';

export interface BirdCoderDriveSandboxExplorerRuntimeOptions {
  readonly getClient?: () => SdkworkDriveAppClient;
}

export function createBirdCoderDriveSandboxExplorerPort(
  options: BirdCoderDriveSandboxExplorerRuntimeOptions = {},
): SandboxExplorerPort {
  const getClient = options.getClient ?? getBirdCoderDriveAppClient;
  const getPort = () => createDriveSandboxExplorerSdkPort({ client: getClient() });

  return {
    listSandboxes: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().listSandboxes(input),
      { retryAfterRefresh: true },
    ),
    listChildren: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().listChildren(input),
      { retryAfterRefresh: true },
    ),
    createDirectory: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().createDirectory(input),
    ),
    createFile: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().createFile(input),
    ),
    readFile: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().readFile(input),
      { retryAfterRefresh: true },
    ),
    updateFile: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().updateFile(input),
    ),
    moveEntry: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().moveEntry(input),
    ),
    deleteEntry: (input) => executeBirdCoderProtectedOperationWithRecovery(
      () => getPort().deleteEntry(input),
    ),
  };
}

export function bootstrapBirdCoderDriveSandboxExplorer(
  options: BirdCoderDriveSandboxExplorerRuntimeOptions = {},
): void {
  configureDriveSandboxExplorerRuntime({
    port: createBirdCoderDriveSandboxExplorerPort(options),
  });
}
