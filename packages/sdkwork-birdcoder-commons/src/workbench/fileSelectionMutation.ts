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

export interface EditorOpenFileState {
  openFilePaths: string[];
  selectedFilePath: string | null;
}

export interface ResolveEditorOpenFileStateAfterMutationOptions {
  state: EditorOpenFileState;
  mutation: FileSelectionMutation;
}

function isDescendantPath(parentPath: string, candidatePath: string): boolean {
  return candidatePath.startsWith(`${parentPath}/`);
}

function normalizeOpenFilePaths(paths: readonly string[]): string[] {
  const nextPaths: string[] = [];
  const seenPaths = new Set<string>();

  for (const path of paths) {
    const normalizedPath = path.trim();
    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    nextPaths.push(normalizedPath);
  }

  return nextPaths;
}

function resolveNextSelectedFileAfterRemoval(
  currentSelectedFilePath: string | null,
  previousOpenFilePaths: readonly string[],
  nextOpenFilePaths: readonly string[],
): string | null {
  if (!currentSelectedFilePath || nextOpenFilePaths.length === 0) {
    return null;
  }

  if (nextOpenFilePaths.includes(currentSelectedFilePath)) {
    return currentSelectedFilePath;
  }

  const currentSelectedFileIndex = previousOpenFilePaths.indexOf(currentSelectedFilePath);
  if (currentSelectedFileIndex < 0) {
    return nextOpenFilePaths[nextOpenFilePaths.length - 1] ?? null;
  }

  const nextSelectedFileIndex = Math.min(
    currentSelectedFileIndex,
    nextOpenFilePaths.length - 1,
  );
  return nextOpenFilePaths[nextSelectedFileIndex] ?? null;
}

function renameOpenFilePath(
  path: string,
  oldPath: string,
  newPath: string,
): string {
  if (path === oldPath) {
    return newPath;
  }

  if (isDescendantPath(oldPath, path)) {
    return path.replace(`${oldPath}/`, `${newPath}/`);
  }

  return path;
}

export function resolveEditorOpenFileStateAfterMutation(
  options: ResolveEditorOpenFileStateAfterMutationOptions,
): EditorOpenFileState {
  const previousOpenFilePaths = normalizeOpenFilePaths(options.state.openFilePaths);
  const currentSelectedFilePath = options.state.selectedFilePath?.trim() || null;
  const { mutation } = options;

  switch (mutation.type) {
    case 'create-file': {
      const nextOpenFilePaths = normalizeOpenFilePaths([
        ...previousOpenFilePaths,
        mutation.path,
      ]);
      return {
        openFilePaths: nextOpenFilePaths,
        selectedFilePath: mutation.path,
      };
    }
    case 'create-folder':
    case 'refresh-files':
    case 'mount-folder':
      return {
        openFilePaths: previousOpenFilePaths,
        selectedFilePath: currentSelectedFilePath,
      };
    case 'delete-file': {
      const nextOpenFilePaths = previousOpenFilePaths.filter(
        (path) => path !== mutation.path,
      );
      return {
        openFilePaths: nextOpenFilePaths,
        selectedFilePath: resolveNextSelectedFileAfterRemoval(
          currentSelectedFilePath,
          previousOpenFilePaths,
          nextOpenFilePaths,
        ),
      };
    }
    case 'delete-folder': {
      const nextOpenFilePaths = previousOpenFilePaths.filter(
        (path) => path !== mutation.path && !isDescendantPath(mutation.path, path),
      );
      return {
        openFilePaths: nextOpenFilePaths,
        selectedFilePath: resolveNextSelectedFileAfterRemoval(
          currentSelectedFilePath,
          previousOpenFilePaths,
          nextOpenFilePaths,
        ),
      };
    }
    case 'rename-node': {
      const nextOpenFilePaths = normalizeOpenFilePaths(
        previousOpenFilePaths.map((path) =>
          renameOpenFilePath(path, mutation.oldPath, mutation.newPath),
        ),
      );
      const nextSelectedFilePath = currentSelectedFilePath
        ? renameOpenFilePath(
            currentSelectedFilePath,
            mutation.oldPath,
            mutation.newPath,
          )
        : null;
      return {
        openFilePaths: nextOpenFilePaths,
        selectedFilePath: nextSelectedFilePath,
      };
    }
    default:
      return {
        openFilePaths: previousOpenFilePaths,
        selectedFilePath: currentSelectedFilePath,
      };
  }
}

export function resolveSelectedFileAfterMutation(
  options: ResolveSelectedFileAfterMutationOptions,
): string | null {
  return resolveEditorOpenFileStateAfterMutation({
    state: {
      openFilePaths: options.currentSelectedFilePath ? [options.currentSelectedFilePath] : [],
      selectedFilePath: options.currentSelectedFilePath,
    },
    mutation: options.mutation,
  }).selectedFilePath;
}
