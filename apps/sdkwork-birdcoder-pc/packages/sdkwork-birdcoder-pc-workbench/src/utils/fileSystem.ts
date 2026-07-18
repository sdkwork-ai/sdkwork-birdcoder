import { openLocalFolder as openInfrastructureLocalFolder } from '@sdkwork/birdcoder-pc-infrastructure/platform/openLocalFolder';
import type {
  LocalFolderMountSource,
  LocalFolderPickerResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export class LocalFolderPickerUnsupportedError extends Error {
  readonly result: Extract<LocalFolderPickerResult, { status: 'unsupported' }>;

  constructor(result: Extract<LocalFolderPickerResult, { status: 'unsupported' }>) {
    super(result.message);
    this.name = 'LocalFolderPickerUnsupportedError';
    this.result = result;
  }
}

export function resolveSelectedLocalFolderSource(
  result: LocalFolderPickerResult,
): LocalFolderMountSource | null {
  if (result.status === 'selected') {
    return result.source;
  }

  if (result.status === 'cancelled') {
    return null;
  }

  throw new LocalFolderPickerUnsupportedError(result);
}

export async function openLocalFolder(): Promise<LocalFolderPickerResult> {
  return openInfrastructureLocalFolder();
}

