import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  const fileSystemModule = await import(
    '@sdkwork/birdcoder-infrastructure/platform/openLocalFolder'
  );
  return fileSystemModule.openLocalFolder();
}
