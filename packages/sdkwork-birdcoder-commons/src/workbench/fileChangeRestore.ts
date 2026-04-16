import type { FileChange } from '@sdkwork/birdcoder-types';

export interface FileChangeRestoreOperation {
  content: string;
  path: string;
  type: 'write';
}

export interface FileChangeRestorePlan {
  fileChanges: FileChange[];
  operations: FileChangeRestoreOperation[];
  restorable: boolean;
}

function normalizeFileChangePath(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function buildFileChangeRestorePlan(
  fileChanges?: readonly FileChange[] | null,
): FileChangeRestorePlan {
  const normalizedFileChanges = Array.isArray(fileChanges)
    ? fileChanges.map((change) => structuredClone(change))
    : [];

  if (normalizedFileChanges.length === 0) {
    return {
      fileChanges: normalizedFileChanges,
      operations: [],
      restorable: false,
    };
  }

  const operations: FileChangeRestoreOperation[] = [];

  for (const change of normalizedFileChanges) {
    const normalizedPath = normalizeFileChangePath(change.path);
    if (!normalizedPath || typeof change.originalContent !== 'string') {
      return {
        fileChanges: normalizedFileChanges,
        operations: [],
        restorable: false,
      };
    }

    operations.push({
      content: change.originalContent,
      path: normalizedPath,
      type: 'write',
    });
  }

  return {
    fileChanges: normalizedFileChanges,
    operations,
    restorable: true,
  };
}

export function hasRestorableFileChanges(
  fileChanges?: readonly FileChange[] | null,
): boolean {
  return buildFileChangeRestorePlan(fileChanges).restorable;
}
