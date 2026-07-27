import type { IFileSystemService } from './interfaces/IFileSystemService.ts';
import type { BirdCoderExecutionLocation } from './runtimeTopology.ts';

export interface CreateProjectFileSystemServiceOptions {
  createRemoteFileSystem: () => IFileSystemService;
  executionLocation: BirdCoderExecutionLocation;
  localFileSystem: IFileSystemService;
}

/**
 * Keeps the stable project file-system port independent from the execution-specific provider.
 * Provider selection is explicit and never falls back after an operation fails.
 */
export function createProjectFileSystemService({
  createRemoteFileSystem,
  executionLocation,
  localFileSystem,
}: CreateProjectFileSystemServiceOptions): IFileSystemService {
  switch (executionLocation) {
    case 'local-host':
      return localFileSystem;
    case 'cloud-workspace':
      return createRemoteFileSystem();
    default: {
      const unsupportedExecutionLocation: never = executionLocation;
      throw new Error(
        `Unsupported project file-system execution location: ${String(unsupportedExecutionLocation)}.`,
      );
    }
  }
}
