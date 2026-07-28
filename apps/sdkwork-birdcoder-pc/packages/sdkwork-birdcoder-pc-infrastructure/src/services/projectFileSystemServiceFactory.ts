import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { BirdCoderExecutionLocation } from './runtimeTopology.ts';

export interface CreateProjectFileSystemServiceOptions {
  createLocalFileSystem: () => IFileSystemService;
  createRemoteFileSystem: () => IFileSystemService;
  executionLocation: BirdCoderExecutionLocation;
}

export type ProjectFileSystemProvider = 'device-mount' | 'drive-sandbox';

export function resolveProjectFileSystemProvider(
  executionLocation: BirdCoderExecutionLocation,
): ProjectFileSystemProvider {
  switch (executionLocation) {
    case 'local-host':
      return 'device-mount';
    case 'cloud-workspace':
      return 'drive-sandbox';
    default: {
      const unsupportedExecutionLocation: never = executionLocation;
      throw new Error(
        `Unsupported project file-system execution location: ${String(unsupportedExecutionLocation)}.`,
      );
    }
  }
}

/**
 * Keeps the stable project file-system port independent from the execution-specific provider.
 * Provider selection is explicit and never falls back after an operation fails.
 */
export function createProjectFileSystemService({
  createLocalFileSystem,
  createRemoteFileSystem,
  executionLocation,
}: CreateProjectFileSystemServiceOptions): IFileSystemService {
  const provider = resolveProjectFileSystemProvider(executionLocation);
  switch (provider) {
    case 'device-mount':
      return createLocalFileSystem();
    case 'drive-sandbox':
      return createRemoteFileSystem();
    default: {
      const unsupportedProvider: never = provider;
      throw new Error(
        `Unsupported project file-system provider: ${String(unsupportedProvider)}.`,
      );
    }
  }
}
