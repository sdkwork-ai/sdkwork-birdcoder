import { openLocalFolder as openInfrastructureLocalFolder } from '@sdkwork/birdcoder-infrastructure-runtime';
import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  return openInfrastructureLocalFolder();
}
