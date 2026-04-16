export type FileSelectionMutation =
  | {
      type: 'create-file';
      path: string;
    }
  | {
      type: 'create-folder';
      path: string;
    }
  | {
      type: 'delete-file';
      path: string;
    }
  | {
      type: 'delete-folder';
      path: string;
    }
  | {
      type: 'rename-node';
      oldPath: string;
      newPath: string;
    }
  | {
      type: 'refresh-files';
    }
  | {
      type: 'mount-folder';
    };

export interface ResolveSelectedFileAfterMutationOptions {
  currentSelectedFilePath: string | null;
  mutation: FileSelectionMutation;
}

function isDescendantPath(parentPath: string, candidatePath: string): boolean {
  return candidatePath.startsWith(`${parentPath}/`);
}

export function resolveSelectedFileAfterMutation(
  options: ResolveSelectedFileAfterMutationOptions,
): string | null {
  const { currentSelectedFilePath, mutation } = options;

  switch (mutation.type) {
    case 'create-file':
      return mutation.path;
    case 'create-folder':
    case 'refresh-files':
    case 'mount-folder':
      return currentSelectedFilePath;
    case 'delete-file':
      return currentSelectedFilePath === mutation.path ? null : currentSelectedFilePath;
    case 'delete-folder':
      if (!currentSelectedFilePath) {
        return currentSelectedFilePath;
      }
      return isDescendantPath(mutation.path, currentSelectedFilePath)
        ? null
        : currentSelectedFilePath;
    case 'rename-node':
      if (!currentSelectedFilePath) {
        return currentSelectedFilePath;
      }
      if (currentSelectedFilePath === mutation.oldPath) {
        return mutation.newPath;
      }
      if (isDescendantPath(mutation.oldPath, currentSelectedFilePath)) {
        return currentSelectedFilePath.replace(
          `${mutation.oldPath}/`,
          `${mutation.newPath}/`,
        );
      }
      return currentSelectedFilePath;
    default:
      return currentSelectedFilePath;
  }
}
