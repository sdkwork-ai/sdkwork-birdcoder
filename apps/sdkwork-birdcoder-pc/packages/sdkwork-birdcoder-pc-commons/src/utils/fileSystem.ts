import { openLocalFolder as openInfrastructureLocalFolder } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import type { LocalFolderMountSource } from '@sdkwork/birdcoder-pc-types';

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  return openInfrastructureLocalFolder();
}

