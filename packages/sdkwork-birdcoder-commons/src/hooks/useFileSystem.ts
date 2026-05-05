import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  IFileNode,
  LocalFolderMountSource,
  ProjectFileSystemChangeEvent,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext.ts';
import { getStoredJson, removeStoredValue, setStoredJson } from '../storage/localStore.ts';
import {
  buildEditorSelectionStorageKey,
  resolveStartupSelectedFile,
} from '../workbench/editorRecovery.ts';
// Compatibility marker for boundary contracts: from '../workbench/fileSearch';
import { type WorkspaceFileSearchResponse } from '../workbench/fileSearch.ts';
import {
  createFailedProjectMountRecoveryState,
  createIdleProjectMountRecoveryState,
  createRecoveredProjectMountRecoveryState,
  createRecoveringProjectMountRecoveryState,
  resolveProjectMountRecoverySource,
  type ProjectMountRecoveryState,
} from '../workbench/projectMountRecovery.ts';
import { emitProjectGitOverviewRefresh } from '../workbench/projectGitOverview.ts';
// Compatibility marker for boundary contracts: from '../workbench/projectMountRecovery';
// Compatibility marker for boundary contracts: from '../workbench/fileSelectionMutation';
import {
  resolveEditorOpenFileStateAfterMutation,
  type EditorOpenFileState,
} from '../workbench/fileSelectionMutation.ts';
import {
  beginFileContentRequest,
  beginSearchRequest,
  beginFileTreeRequest,
  completeFileContentRequest,
  completeFileTreeRequest,
  completeSearchRequest,
  createFileSystemRequestGuardState,
  hasPendingFileContentRequests,
  hasPendingSearchRequests,
  hasPendingFileTreeRequests,
  isLatestFileContentRequestForGuard,
  isLatestSearchRequestForGuard,
  isLatestFileTreeRequestForGuard,
  isProjectActiveForRequestGuard,
  resetFileSystemRequestGuardState,
} from '../workbench/fileSystemRequestGuard.ts';
// Compatibility marker for boundary contracts: from '../workbench/fileSystemRequestGuard';

const EDITOR_RECOVERY_SCOPE = 'workbench.editor';
const MAX_FILE_SEARCH_RESULTS = 200;
const MAX_FILE_SEARCH_SNIPPET_LENGTH = 160;
const FILE_AUTOSAVE_DELAY_MS = 400;
const MAX_INACTIVE_OPEN_FILE_REVISIONS_PER_CYCLE = 6;

interface FileTreeIndex {
  filePaths: ReadonlySet<string>;
  loadedDirectoryPaths: ReadonlySet<string>;
}

function readDocumentForegroundState(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  const isVisible = document.visibilityState !== 'hidden';
  const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  return isVisible && hasFocus;
}

function isMissingFileSystemEntryError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'NotFoundError';
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  return /not found|does not exist|not available because project|must be a file|failed to inspect mounted file|no such file/iu.test(
    message,
  );
}

function createEmptyFileTreeIndex(): FileTreeIndex {
  return {
    filePaths: new Set<string>(),
    loadedDirectoryPaths: new Set<string>(),
  };
}

function buildFileTreeIndex(nodes: ReadonlyArray<IFileNode>): FileTreeIndex {
  const filePaths = new Set<string>();
  const loadedDirectoryPaths = new Set<string>();

  const visit = (node: IFileNode) => {
    if (node.type === 'file') {
      filePaths.add(node.path);
      return;
    }

    if (node.children === undefined) {
      return;
    }

    loadedDirectoryPaths.add(node.path);
    node.children.forEach((child) => visit(child));
  };

  nodes.forEach((node) => visit(node));
  return {
    filePaths,
    loadedDirectoryPaths,
  };
}

function resolveParentFilePath(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath || normalizedPath === '/') {
    return '/';
  }

  const separatorIndex = normalizedPath.lastIndexOf('/');
  if (separatorIndex <= 0) {
    return '/';
  }

  return normalizedPath.slice(0, separatorIndex);
}

function isPathWithinDirectory(path: string, directoryPath: string): boolean {
  const normalizedPath = path.trim();
  const normalizedDirectoryPath = directoryPath.trim();
  if (!normalizedPath || !normalizedDirectoryPath) {
    return false;
  }

  return (
    normalizedPath === normalizedDirectoryPath ||
    normalizedPath.startsWith(`${normalizedDirectoryPath}/`)
  );
}

function resolveLoadedRootDirectoryPaths(loadedDirectoryPaths: ReadonlySet<string>): string[] {
  const rootDirectoryPaths: string[] = [];
  for (const candidatePath of loadedDirectoryPaths) {
    if (candidatePath === '/') {
      rootDirectoryPaths.push(candidatePath);
      continue;
    }

    const parentPath = resolveParentFilePath(candidatePath);
    if (!loadedDirectoryPaths.has(parentPath)) {
      rootDirectoryPaths.push(candidatePath);
    }
  }

  return rootDirectoryPaths;
}

function resolveNearestLoadedDirectoryPath(
  loadedDirectoryPaths: ReadonlySet<string>,
  path: string,
): string | null {
  let candidatePath = path.trim();
  while (candidatePath) {
    if (loadedDirectoryPaths.has(candidatePath)) {
      return candidatePath;
    }

    const parentPath = resolveParentFilePath(candidatePath);
    if (!parentPath || parentPath === candidatePath) {
      break;
    }
    candidatePath = parentPath;
  }

  return null;
}

function resolveFileChangeRefreshDirectoryPaths(
  fileTreeIndex: FileTreeIndex,
  event: ProjectFileSystemChangeEvent,
): string[] {
  const loadedDirectoryPaths = fileTreeIndex.loadedDirectoryPaths;
  if (loadedDirectoryPaths.size === 0) {
    return [];
  }

  const refreshPaths = new Set<string>();
  const appendRefreshPath = (path: string | null | undefined) => {
    const normalizedPath = path?.trim() ?? '';
    if (!normalizedPath) {
      return;
    }

    refreshPaths.add(normalizedPath);
  };

  for (const rawPath of event.paths) {
    const normalizedPath = rawPath.trim();
    if (!normalizedPath) {
      continue;
    }

    if (event.kind === 'modify') {
      if (loadedDirectoryPaths.has(normalizedPath)) {
        appendRefreshPath(normalizedPath);
        continue;
      }

      if (fileTreeIndex.filePaths.has(normalizedPath)) {
        continue;
      }
    }

    appendRefreshPath(resolveNearestLoadedDirectoryPath(loadedDirectoryPaths, normalizedPath));
  }

  if (refreshPaths.size > 0) {
    return [...refreshPaths];
  }

  if (event.kind === 'modify') {
    return [];
  }

  return resolveLoadedRootDirectoryPaths(loadedDirectoryPaths);
}

function shouldKeepOpenFilePath(fileTreeIndex: FileTreeIndex, path: string): boolean {
  if (fileTreeIndex.filePaths.has(path)) {
    return true;
  }

  return !fileTreeIndex.loadedDirectoryPaths.has(resolveParentFilePath(path));
}

function normalizeEditorOpenFileState(state: EditorOpenFileState): EditorOpenFileState {
  const openFilePaths: string[] = [];
  const seenPaths = new Set<string>();

  for (const path of state.openFilePaths) {
    const normalizedPath = path.trim();
    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    openFilePaths.push(normalizedPath);
  }

  const normalizedSelectedFilePath = state.selectedFilePath?.trim() || null;
  const selectedFilePath =
    normalizedSelectedFilePath && openFilePaths.includes(normalizedSelectedFilePath)
      ? normalizedSelectedFilePath
      : openFilePaths[openFilePaths.length - 1] ?? null;

  return {
    openFilePaths,
    selectedFilePath,
  };
}

function areOrderedStringArraysEqual(
  currentValues: readonly string[],
  nextValues: readonly string[],
): boolean {
  if (currentValues === nextValues) {
    return true;
  }

  if (currentValues.length !== nextValues.length) {
    return false;
  }

  for (let index = 0; index < currentValues.length; index += 1) {
    if (currentValues[index] !== nextValues[index]) {
      return false;
    }
  }

  return true;
}

function selectInactiveOpenFileProbePaths(
  inactiveOpenFilePaths: readonly string[],
  cursor: number,
  limit: number,
): {
  nextCursor: number;
  paths: string[];
} {
  if (inactiveOpenFilePaths.length === 0 || limit <= 0) {
    return {
      nextCursor: 0,
      paths: [],
    };
  }

  const normalizedCursor =
    Number.isFinite(cursor) && cursor >= 0
      ? Math.floor(cursor) % inactiveOpenFilePaths.length
      : 0;
  if (inactiveOpenFilePaths.length <= limit) {
    return {
      nextCursor: 0,
      paths: [...inactiveOpenFilePaths],
    };
  }

  const selectedPaths: string[] = [];
  const batchSize = Math.min(limit, inactiveOpenFilePaths.length);
  for (let offset = 0; offset < batchSize; offset += 1) {
    const path = inactiveOpenFilePaths[
      (normalizedCursor + offset) % inactiveOpenFilePaths.length
    ];
    if (path) {
      selectedPaths.push(path);
    }
  }

  return {
    nextCursor: (normalizedCursor + selectedPaths.length) % inactiveOpenFilePaths.length,
    paths: selectedPaths,
  };
}

function filterEditorOpenFileStateByFiles(
  fileTreeIndex: FileTreeIndex,
  state: EditorOpenFileState,
): EditorOpenFileState {
  const normalizedState = normalizeEditorOpenFileState(state);
  const openFilePaths = normalizedState.openFilePaths.filter((path) =>
    shouldKeepOpenFilePath(fileTreeIndex, path),
  );
  const selectedFilePath =
    normalizedState.selectedFilePath && openFilePaths.includes(normalizedState.selectedFilePath)
      ? normalizedState.selectedFilePath
      : openFilePaths[openFilePaths.length - 1] ?? null;

  return {
    openFilePaths,
    selectedFilePath,
  };
}

function resolveStartupEditorOpenFileState(
  files: ReadonlyArray<IFileNode>,
  fileTreeIndex: FileTreeIndex,
  state: EditorOpenFileState,
  persistedSelectedFilePath: string | null,
): EditorOpenFileState {
  const filteredState = filterEditorOpenFileStateByFiles(fileTreeIndex, state);
  if (filteredState.selectedFilePath) {
    return filteredState;
  }

  const startupSelectedFilePath = resolveStartupSelectedFile({
    files,
    persistedSelectedFilePath,
  });
  if (!startupSelectedFilePath) {
    return filteredState;
  }

  return {
    openFilePaths: [startupSelectedFilePath],
    selectedFilePath: startupSelectedFilePath,
  };
}

function openEditorFile(state: EditorOpenFileState, path: string): EditorOpenFileState {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return normalizeEditorOpenFileState(state);
  }

  const normalizedState = normalizeEditorOpenFileState(state);
  if (normalizedState.openFilePaths.includes(normalizedPath)) {
    return {
      openFilePaths: normalizedState.openFilePaths,
      selectedFilePath: normalizedPath,
    };
  }

  return {
    openFilePaths: [...normalizedState.openFilePaths, normalizedPath],
    selectedFilePath: normalizedPath,
  };
}

function closeEditorFile(state: EditorOpenFileState, path: string): EditorOpenFileState {
  return resolveEditorOpenFileStateAfterMutation({
    state,
    mutation: {
      type: 'delete-file',
      path,
    },
  });
}

function resolveMountedRootPathFromProjectPath(projectPath: string): string | null {
  const normalizedProjectPath = projectPath.trim().replace(/[\\/]+$/u, '');
  if (!normalizedProjectPath) {
    return null;
  }

  const pathSegments = normalizedProjectPath.split(/[\\/]+/u).filter(Boolean);
  const candidateRootName = pathSegments[pathSegments.length - 1]?.trim() || 'mounted-folder';
  const rootName =
    candidateRootName.endsWith(':') || candidateRootName.length === 0
      ? 'mounted-folder'
      : candidateRootName;
  return `/${rootName}`;
}

function resolveMountedMutationPath(path: string, mountedRootPath: string | null): string {
  const trimmedPath = path.trim();
  if (!trimmedPath || !mountedRootPath) {
    return trimmedPath;
  }

  const normalizedRootPath =
    mountedRootPath.endsWith('/') && mountedRootPath.length > 1
      ? mountedRootPath.slice(0, -1)
      : mountedRootPath;
  if (
    trimmedPath === normalizedRootPath ||
    trimmedPath.startsWith(`${normalizedRootPath}/`)
  ) {
    return trimmedPath;
  }

  const normalizedRelativePath = trimmedPath.replace(/^[/\\]+/, '').replace(/[\\/]+/g, '/');
  return normalizedRelativePath ? `${normalizedRootPath}/${normalizedRelativePath}` : normalizedRootPath;
}

function mergeProjectFileSystemChangeEvents(
  currentEvent: ProjectFileSystemChangeEvent | null,
  nextEvent: ProjectFileSystemChangeEvent,
): ProjectFileSystemChangeEvent {
  const paths = [
    ...new Set(
      [...(currentEvent?.paths ?? []), ...nextEvent.paths]
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    ),
  ];

  if (!currentEvent) {
    return {
      kind: nextEvent.kind,
      paths,
    };
  }

  return {
    kind: currentEvent.kind === nextEvent.kind ? nextEvent.kind : 'other',
    paths,
  };
}

interface UseFileSystemOptions {
  isActive?: boolean;
  loadActive?: boolean;
  realtimeActive?: boolean;
}

export function useFileSystem(projectId: string, projectPath?: string, options?: UseFileSystemOptions) {
  const { fileSystemService } = useIDEServices();
  const normalizedProjectId = projectId.trim();
  const isActive = options?.isActive ?? true;
  const loadActive = options?.loadActive ?? isActive;
  const realtimeActive = options?.realtimeActive ?? isActive;
  const selectionStorageKey = buildEditorSelectionStorageKey(normalizedProjectId);
  const [files, setFiles] = useState<IFileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDirectoryPaths, setLoadingDirectoryPaths] = useState<Record<string, boolean>>({});
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const [isRealtimeDocumentActive, setIsRealtimeDocumentActive] = useState<boolean>(() =>
    readDocumentForegroundState(),
  );
  const [mountRecoveryState, setMountRecoveryState] = useState<ProjectMountRecoveryState>(
    createIdleProjectMountRecoveryState,
  );
  const openFilesRef = useRef<string[]>([]);
  const selectedFileRef = useRef<string | null>(null);
  const editorStateByProjectIdRef = useRef<Map<string, EditorOpenFileState>>(new Map());
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const mountRecoveryPromiseRef = useRef<Promise<IFileNode[]> | null>(null);
  const requestGuardRef = useRef(createFileSystemRequestGuardState(projectId));
  const previousProjectIdRef = useRef(normalizedProjectId);
  const filesRef = useRef<IFileNode[]>([]);
  const filesIndexRef = useRef<FileTreeIndex>(createEmptyFileTreeIndex());
  const fileContentRef = useRef('');
  const selectedFileRevisionRef = useRef<string | null>(null);
  const openFileRevisionsRef = useRef<Map<string, string | null>>(new Map());
  const inactiveOpenFileProbeCursorRef = useRef(0);
  const openFileContentCacheRef = useRef<Map<string, string>>(new Map());
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutosaveRef = useRef<{
    projectId: string;
    path: string;
    content: string;
  } | null>(null);
  const realtimeSyncCycleInFlightRef = useRef(false);
  const fileChangeReconciliationInFlightRef = useRef(false);
  const pendingFileChangeRef = useRef<ProjectFileSystemChangeEvent | null>(null);
  const previousRealtimeSyncEnabledRef = useRef<boolean>(
    realtimeActive && readDocumentForegroundState(),
  );
  const shouldRunRealtimeSync = realtimeActive && isRealtimeDocumentActive;

  const isProjectActive = useCallback(
    (candidateProjectId: string) =>
      isProjectActiveForRequestGuard(requestGuardRef.current, candidateProjectId),
    [],
  );

  const beginFileTreeRequestVersion = useCallback(() => {
    const nextRequest = beginFileTreeRequest(requestGuardRef.current);
    requestGuardRef.current = nextRequest.state;
    setIsLoading(hasPendingFileTreeRequests(nextRequest.state));
    return nextRequest.requestVersion;
  }, []);

  const beginFileContentRequestVersion = useCallback(() => {
    const nextRequest = beginFileContentRequest(requestGuardRef.current);
    requestGuardRef.current = nextRequest.state;
    setIsLoadingContent(hasPendingFileContentRequests(nextRequest.state));
    return nextRequest.requestVersion;
  }, []);

  const beginSearchRequestVersion = useCallback(() => {
    const nextRequest = beginSearchRequest(requestGuardRef.current);
    requestGuardRef.current = nextRequest.state;
    setIsSearchingFiles(hasPendingSearchRequests(nextRequest.state));
    return nextRequest.requestVersion;
  }, []);

  const completeFileTreeRequestVersion = useCallback((candidateProjectId: string) => {
    const nextState = completeFileTreeRequest(requestGuardRef.current, candidateProjectId);
    requestGuardRef.current = nextState;
    setIsLoading(hasPendingFileTreeRequests(nextState));
  }, []);

  const completeFileContentRequestVersion = useCallback((candidateProjectId: string) => {
    const nextState = completeFileContentRequest(requestGuardRef.current, candidateProjectId);
    requestGuardRef.current = nextState;
    setIsLoadingContent(hasPendingFileContentRequests(nextState));
  }, []);

  const completeSearchRequestVersion = useCallback((candidateProjectId: string) => {
    const nextState = completeSearchRequest(requestGuardRef.current, candidateProjectId);
    requestGuardRef.current = nextState;
    setIsSearchingFiles(hasPendingSearchRequests(nextState));
  }, []);

  const isLatestFileTreeRequest = useCallback(
    (candidateProjectId: string, requestVersion: number) =>
      isLatestFileTreeRequestForGuard(
        requestGuardRef.current,
        candidateProjectId,
        requestVersion,
      ),
    [],
  );

  const isLatestFileContentRequest = useCallback(
    (candidateProjectId: string, requestVersion: number) =>
      isLatestFileContentRequestForGuard(
        requestGuardRef.current,
        candidateProjectId,
        requestVersion,
      ),
    [],
  );

  const isLatestSearchRequest = useCallback(
    (candidateProjectId: string, requestVersion: number) =>
      isLatestSearchRequestForGuard(
        requestGuardRef.current,
        candidateProjectId,
        requestVersion,
      ),
    [],
  );

  const commitVisibleFileContent = useCallback((content: string) => {
    fileContentRef.current = content;
    setFileContent(content);
  }, []);

  const clearPendingAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const setTrackedFileRevision = useCallback((path: string, revision: string | null) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return;
    }

    if (revision === null) {
      openFileRevisionsRef.current.delete(normalizedPath);
      if (selectedFileRef.current === normalizedPath) {
        selectedFileRevisionRef.current = null;
      }
      return;
    }

    openFileRevisionsRef.current.set(normalizedPath, revision);
    if (selectedFileRef.current === normalizedPath) {
      selectedFileRevisionRef.current = revision;
    }
  }, []);

  const setCachedFileContent = useCallback((path: string, content: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return;
    }

    openFileContentCacheRef.current.set(normalizedPath, content);
  }, []);

  const deleteCachedFileContent = useCallback((path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return;
    }

    openFileContentCacheRef.current.delete(normalizedPath);
  }, []);

  const pruneTrackedFileRevisions = useCallback((paths: readonly string[]) => {
    const normalizedOpenPaths = new Set(
      paths
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    );
    openFileRevisionsRef.current.forEach((_, path) => {
      if (!normalizedOpenPaths.has(path)) {
        openFileRevisionsRef.current.delete(path);
      }
    });
  }, []);

  const pruneCachedFileContent = useCallback((paths: readonly string[]) => {
    const normalizedOpenPaths = new Set(
      paths
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    );
    openFileContentCacheRef.current.forEach((_, path) => {
      if (!normalizedOpenPaths.has(path)) {
        openFileContentCacheRef.current.delete(path);
      }
    });
  }, []);

  const persistFileContentForProject = useCallback(async (
    targetProjectId: string,
    path: string,
    content: string,
  ) => {
    if (!targetProjectId) {
      return;
    }

    try {
      await fileSystemService.saveFileContent(targetProjectId, path, content);
      if (!isProjectActive(targetProjectId)) {
        return;
      }

      setCachedFileContent(path, content);
      if (
        targetProjectId === normalizedProjectId &&
        selectedFileRef.current === path
      ) {
        try {
          setTrackedFileRevision(
            path,
            await fileSystemService.getFileRevision(
              targetProjectId,
              path,
            ),
          );
        } catch {
          setTrackedFileRevision(path, null);
        }
        commitVisibleFileContent(content);
      }
    } catch (error) {
      console.error('Failed to save file content', error);
    }
  }, [
    commitVisibleFileContent,
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    setCachedFileContent,
    setTrackedFileRevision,
  ]);

  const flushPendingAutosave = useCallback(async () => {
    const pendingAutosave = pendingAutosaveRef.current;
    clearPendingAutosaveTimer();
    pendingAutosaveRef.current = null;
    if (!pendingAutosave) {
      return;
    }

    await persistFileContentForProject(
      pendingAutosave.projectId,
      pendingAutosave.path,
      pendingAutosave.content,
    );
  }, [clearPendingAutosaveTimer, persistFileContentForProject]);

  const queueFileAutosave = useCallback((path: string, content: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    pendingAutosaveRef.current = {
      projectId: mutationProjectId,
      path,
      content,
    };
    clearPendingAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      const pendingAutosave = pendingAutosaveRef.current;
      pendingAutosaveRef.current = null;
      autosaveTimerRef.current = null;
      if (!pendingAutosave) {
        return;
      }

      void persistFileContentForProject(
        pendingAutosave.projectId,
        pendingAutosave.path,
        pendingAutosave.content,
      );
    }, FILE_AUTOSAVE_DELAY_MS);
  }, [
    clearPendingAutosaveTimer,
    normalizedProjectId,
    persistFileContentForProject,
  ]);

  const persistProjectEditorState = useCallback((candidateProjectId: string, state: EditorOpenFileState) => {
    const normalizedCandidateProjectId = candidateProjectId.trim();
    if (!normalizedCandidateProjectId) {
      return;
    }

    const normalizedState = normalizeEditorOpenFileState(state);
    if (normalizedState.openFilePaths.length === 0 && !normalizedState.selectedFilePath) {
      editorStateByProjectIdRef.current.delete(normalizedCandidateProjectId);
      return;
    }

    editorStateByProjectIdRef.current.set(normalizedCandidateProjectId, normalizedState);
  }, []);

  const commitEditorOpenFileState = useCallback((nextState: EditorOpenFileState) => {
    const normalizedState = normalizeEditorOpenFileState(nextState);
    const didOpenFilePathsChange = !areOrderedStringArraysEqual(
      openFilesRef.current,
      normalizedState.openFilePaths,
    );
    const previousSelectedFilePath = selectedFileRef.current;
    const didSelectedFileChange = normalizedState.selectedFilePath !== previousSelectedFilePath;
    if (didSelectedFileChange) {
      void flushPendingAutosave();
    }
    openFilesRef.current = normalizedState.openFilePaths;
    selectedFileRef.current = normalizedState.selectedFilePath;
    pruneTrackedFileRevisions(normalizedState.openFilePaths);
    pruneCachedFileContent(normalizedState.openFilePaths);
    if (didSelectedFileChange) {
      selectedFileRevisionRef.current =
        normalizedState.selectedFilePath
          ? openFileRevisionsRef.current.get(normalizedState.selectedFilePath) ?? null
          : null;
    }
    if (didOpenFilePathsChange) {
      setOpenFiles(normalizedState.openFilePaths);
    }
    if (didSelectedFileChange) {
      setSelectedFile(normalizedState.selectedFilePath);
    }
    if (didSelectedFileChange) {
      commitVisibleFileContent('');
    }
    persistProjectEditorState(normalizedProjectId, normalizedState);
  }, [
    commitVisibleFileContent,
    flushPendingAutosave,
    normalizedProjectId,
    persistProjectEditorState,
    pruneCachedFileContent,
    pruneTrackedFileRevisions,
  ]);

  const readCurrentEditorOpenFileState = useCallback(
    (): EditorOpenFileState => ({
      openFilePaths: openFilesRef.current,
      selectedFilePath: selectedFileRef.current,
    }),
    [],
  );

  const reconcileMissingActiveFile = useCallback((path: string) => {
    if (selectedFileRef.current !== path) {
      return;
    }

    const nextState = closeEditorFile(readCurrentEditorOpenFileState(), path);
    commitEditorOpenFileState(nextState);
    if (!nextState.selectedFilePath) {
      commitVisibleFileContent('');
    }
  }, [
    commitEditorOpenFileState,
    commitVisibleFileContent,
    readCurrentEditorOpenFileState,
  ]);

  const syncSelectedFileFromSource = useCallback(async (
    targetProjectId: string,
    targetPath: string,
  ) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    const normalizedTargetPath = targetPath.trim();
    if (!normalizedTargetProjectId || !normalizedTargetPath) {
      return;
    }

    if (
      pendingAutosaveRef.current?.projectId === normalizedTargetProjectId &&
      pendingAutosaveRef.current.path === normalizedTargetPath
    ) {
      return;
    }

    if (!isProjectActive(normalizedTargetProjectId)) {
      return;
    }

    try {
      const latestRevision = await fileSystemService.getFileRevision(
        normalizedTargetProjectId,
        normalizedTargetPath,
      );
      if (
        !isProjectActive(normalizedTargetProjectId) ||
        selectedFileRef.current !== normalizedTargetPath ||
        latestRevision === selectedFileRevisionRef.current
      ) {
        return;
      }

      const latestContent = await fileSystemService.getFileContent(
        normalizedTargetProjectId,
        normalizedTargetPath,
      );
      if (
        !isProjectActive(normalizedTargetProjectId) ||
        selectedFileRef.current !== normalizedTargetPath
      ) {
        return;
      }

      setTrackedFileRevision(normalizedTargetPath, latestRevision);
      setCachedFileContent(normalizedTargetPath, latestContent);
      if (latestContent === fileContentRef.current) {
        return;
      }

      commitVisibleFileContent(latestContent);
    } catch (error) {
      if (
        !isProjectActive(normalizedTargetProjectId) ||
        selectedFileRef.current !== normalizedTargetPath
      ) {
        return;
      }

      setTrackedFileRevision(normalizedTargetPath, null);
      deleteCachedFileContent(normalizedTargetPath);
      if (isMissingFileSystemEntryError(error)) {
        reconcileMissingActiveFile(normalizedTargetPath);
        return;
      }
      commitVisibleFileContent('// File content not found');
    }
  }, [
    commitVisibleFileContent,
    deleteCachedFileContent,
    fileSystemService,
    isProjectActive,
    reconcileMissingActiveFile,
    setCachedFileContent,
    setTrackedFileRevision,
  ]);

  const syncInactiveOpenFilesFromSource = useCallback(async (targetProjectId: string) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    if (!normalizedTargetProjectId || !isProjectActive(normalizedTargetProjectId)) {
      return;
    }

    const inactiveOpenFilePaths = openFilesRef.current.filter((path) => {
      const normalizedPath = path.trim();
      return (
        normalizedPath.length > 0 &&
        normalizedPath !== selectedFileRef.current &&
        !(
          pendingAutosaveRef.current?.projectId === normalizedTargetProjectId &&
          pendingAutosaveRef.current.path === normalizedPath
        )
      );
    });
    if (inactiveOpenFilePaths.length === 0) {
      inactiveOpenFileProbeCursorRef.current = 0;
      return;
    }

    const inactiveOpenFileProbeBatch = selectInactiveOpenFileProbePaths(
      inactiveOpenFilePaths,
      inactiveOpenFileProbeCursorRef.current,
      MAX_INACTIVE_OPEN_FILE_REVISIONS_PER_CYCLE,
    );
    inactiveOpenFileProbeCursorRef.current = inactiveOpenFileProbeBatch.nextCursor;
    if (inactiveOpenFileProbeBatch.paths.length === 0) {
      return;
    }

    const revisionResults = await fileSystemService.getFileRevisions(
      normalizedTargetProjectId,
      inactiveOpenFileProbeBatch.paths,
    );
    if (!isProjectActive(normalizedTargetProjectId)) {
      return;
    }

    let nextEditorState: EditorOpenFileState | null = null;
    revisionResults.forEach((result) => {
      if (!result.error && !result.missing) {
        setTrackedFileRevision(result.path, result.revision);
        return;
      }

      if (result.missing) {
        setTrackedFileRevision(result.path, null);
        deleteCachedFileContent(result.path);
        nextEditorState = closeEditorFile(
          nextEditorState ?? readCurrentEditorOpenFileState(),
          result.path,
        );
        return;
      }

      console.error(
        `Failed to sync inactive open file "${result.path}"`,
        result.error,
      );
    });

    if (nextEditorState) {
    commitEditorOpenFileState(nextEditorState);
    }
  }, [
    commitEditorOpenFileState,
    deleteCachedFileContent,
    fileSystemService,
    isProjectActive,
    readCurrentEditorOpenFileState,
    setTrackedFileRevision,
  ]);

  const resolveTrackedRealtimeFilePaths = useCallback((): readonly string[] => {
    const trackedPaths: string[] = [];
    const seenPaths = new Set<string>();
    const pendingAutosave = pendingAutosaveRef.current;
    const activeSelectedFile = selectedFileRef.current?.trim() || '';

    const appendTrackedPath = (path: string) => {
      const normalizedPath = path.trim();
      if (
        !normalizedPath ||
        seenPaths.has(normalizedPath) ||
        (
          pendingAutosave?.projectId === normalizedProjectId &&
          pendingAutosave.path === normalizedPath
        )
      ) {
        return;
      }

      seenPaths.add(normalizedPath);
      trackedPaths.push(normalizedPath);
    };

    if (activeSelectedFile) {
      appendTrackedPath(activeSelectedFile);
    }

    openFilesRef.current.forEach((path) => {
      if (path.trim() === activeSelectedFile) {
        return;
      }

      appendTrackedPath(path);
    });

    return trackedPaths;
  }, [normalizedProjectId]);

  const syncFilesAndSelection = useCallback(
    (
      nextFiles: IFileNode[],
      candidateState?: EditorOpenFileState,
      startupSelectedFilePath?: string | null,
    ) => {
      if (filesRef.current !== nextFiles) {
        filesRef.current = nextFiles;
        setFiles(nextFiles);
      } else {
        filesRef.current = nextFiles;
      }
      filesIndexRef.current = buildFileTreeIndex(nextFiles);
      const nextCandidateState =
        candidateState ??
        editorStateByProjectIdRef.current.get(normalizedProjectId) ?? {
          openFilePaths: [],
          selectedFilePath: null,
        };
      const nextEditorOpenFileState =
        startupSelectedFilePath === undefined
          ? filterEditorOpenFileStateByFiles(filesIndexRef.current, nextCandidateState)
          : resolveStartupEditorOpenFileState(
              nextFiles,
              filesIndexRef.current,
              nextCandidateState,
              startupSelectedFilePath,
            );
      commitEditorOpenFileState(nextEditorOpenFileState);
      if (!nextEditorOpenFileState.selectedFilePath) {
        selectedFileRevisionRef.current = null;
        pruneTrackedFileRevisions(nextEditorOpenFileState.openFilePaths);
        commitVisibleFileContent('');
      }
    },
    [
      commitEditorOpenFileState,
      commitVisibleFileContent,
      normalizedProjectId,
      pruneTrackedFileRevisions,
    ],
  );

  const reconcileFileChangeEvent = useCallback(async (
    requestProjectId: string,
    event: ProjectFileSystemChangeEvent,
  ) => {
    if (!isProjectActive(requestProjectId)) {
      return;
    }

    try {
      const refreshDirectoryPaths = resolveFileChangeRefreshDirectoryPaths(
        filesIndexRef.current,
        event,
      );
      if (refreshDirectoryPaths.length > 0) {
        const nextFiles = await fileSystemService.refreshDirectories(
          requestProjectId,
          refreshDirectoryPaths,
        );
        if (!isProjectActive(requestProjectId)) {
          return;
        }

        syncFilesAndSelection(nextFiles, readCurrentEditorOpenFileState());
      }
      const activeSelectedFile = selectedFileRef.current;
      if (
        !activeSelectedFile ||
        !event.paths.some((path) => {
          const normalizedPath = path.trim();
          return (
            normalizedPath === activeSelectedFile ||
            isPathWithinDirectory(activeSelectedFile, normalizedPath)
          );
        }) ||
        pendingAutosaveRef.current?.path === activeSelectedFile
      ) {
        return;
      }

      await syncSelectedFileFromSource(requestProjectId, activeSelectedFile);
    } catch (error) {
      console.error('Failed to reconcile external file-system change', error);
    }
  }, [
    fileSystemService,
    isProjectActive,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
    syncSelectedFileFromSource,
  ]);

  const drainQueuedFileChangeReconciliation = useCallback(async (requestProjectId: string) => {
    while (true) {
      const nextEvent = pendingFileChangeRef.current;
      if (!nextEvent) {
        return;
      }

      pendingFileChangeRef.current = null;
      await reconcileFileChangeEvent(requestProjectId, nextEvent);
    }
  }, [reconcileFileChangeEvent]);

  const startQueuedFileChangeReconciliation = useCallback((requestProjectId: string) => {
    if (fileChangeReconciliationInFlightRef.current) {
      return;
    }

    fileChangeReconciliationInFlightRef.current = true;
    void (async () => {
      try {
        await drainQueuedFileChangeReconciliation(requestProjectId);
      } finally {
        fileChangeReconciliationInFlightRef.current = false;
        if (pendingFileChangeRef.current) {
          startQueuedFileChangeReconciliation(requestProjectId);
        }
      }
    })();
  }, [drainQueuedFileChangeReconciliation]);

  const queueFileChangeReconciliation = useCallback((
    requestProjectId: string,
    event: ProjectFileSystemChangeEvent,
  ) => {
    pendingFileChangeRef.current = mergeProjectFileSystemChangeEvents(
      pendingFileChangeRef.current,
      event,
    );
    startQueuedFileChangeReconciliation(requestProjectId);
  }, [startQueuedFileChangeReconciliation]);

  useEffect(() => {
    const nextProjectId = projectId.trim();
    if (previousProjectIdRef.current === nextProjectId) {
      return;
    }

    persistProjectEditorState(previousProjectIdRef.current, readCurrentEditorOpenFileState());
    void flushPendingAutosave();
    previousProjectIdRef.current = nextProjectId;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    requestGuardRef.current = resetFileSystemRequestGuardState(
      requestGuardRef.current,
      nextProjectId,
    );
    mountRecoveryPromiseRef.current = null;
    pendingFileChangeRef.current = null;
    fileChangeReconciliationInFlightRef.current = false;
    realtimeSyncCycleInFlightRef.current = false;
    openFilesRef.current = [];
    selectedFileRef.current = null;
    selectedFileRevisionRef.current = null;
    openFileRevisionsRef.current = new Map();
    inactiveOpenFileProbeCursorRef.current = 0;
    openFileContentCacheRef.current = new Map();
    filesRef.current = [];
    filesIndexRef.current = createEmptyFileTreeIndex();
    setFiles([]);
    setIsLoading(false);
    setLoadingDirectoryPaths({});
    setOpenFiles([]);
    setSelectedFile(null);
    commitVisibleFileContent('');
    setIsLoadingContent(false);
    setIsSearchingFiles(false);
    setMountRecoveryState(createIdleProjectMountRecoveryState());
  }, [
    commitVisibleFileContent,
    flushPendingAutosave,
    persistProjectEditorState,
    projectId,
    readCurrentEditorOpenFileState,
  ]);

  useEffect(() => {
    return () => {
      void flushPendingAutosave();
      clearPendingAutosaveTimer();
      searchAbortControllerRef.current?.abort();
      searchAbortControllerRef.current = null;
    };
  }, [clearPendingAutosaveTimer, flushPendingAutosave]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const syncDocumentForegroundState = () => {
      setIsRealtimeDocumentActive(readDocumentForegroundState());
    };

    syncDocumentForegroundState();
    window.addEventListener('focus', syncDocumentForegroundState);
    window.addEventListener('blur', syncDocumentForegroundState);
    document.addEventListener('visibilitychange', syncDocumentForegroundState);

    return () => {
      window.removeEventListener('focus', syncDocumentForegroundState);
      window.removeEventListener('blur', syncDocumentForegroundState);
      document.removeEventListener('visibilitychange', syncDocumentForegroundState);
    };
  }, []);

  const resolveProjectMountedRootPath = useCallback((): string | null => {
    if (files.length === 1 && files[0]?.type === 'directory') {
      return files[0].path;
    }

    const recoveryMountSource = resolveProjectMountRecoverySource(projectPath);
    if (!recoveryMountSource || recoveryMountSource.type !== 'tauri') {
      return null;
    }

    return resolveMountedRootPathFromProjectPath(recoveryMountSource.path);
  }, [files, projectPath]);

  const recoverMountedProjectRoot = useCallback(async (
    targetProjectId: string,
    options?: {
      skipInitialFileCheck?: boolean;
    },
  ): Promise<IFileNode[]> => {
    const requestProjectId = targetProjectId.trim();
    if (!requestProjectId) {
      return [];
    }

    const recoveryMountSource = resolveProjectMountRecoverySource(projectPath);
    if (!recoveryMountSource) {
      return [];
    }

    if (!options?.skipInitialFileCheck) {
      const mountedFiles = await fileSystemService.getFiles(requestProjectId);
      if (mountedFiles.length > 0) {
        return mountedFiles;
      }
    }

    if (mountRecoveryPromiseRef.current) {
      return await mountRecoveryPromiseRef.current;
    }

    const isTrackingCurrentProjectMountRecovery =
      requestProjectId === normalizedProjectId && isProjectActive(requestProjectId);
    const mountPromise: Promise<IFileNode[]> = (async () => {
      try {
        if (isTrackingCurrentProjectMountRecovery && recoveryMountSource.type === 'tauri') {
          setMountRecoveryState(
            createRecoveringProjectMountRecoveryState(recoveryMountSource.path),
          );
        }
        await fileSystemService.mountFolder(requestProjectId, recoveryMountSource);
        emitProjectGitOverviewRefresh(requestProjectId);
        const recoveredFiles = await fileSystemService.getFiles(requestProjectId);
        if (isTrackingCurrentProjectMountRecovery && recoveryMountSource.type === 'tauri') {
          setMountRecoveryState(
            createRecoveredProjectMountRecoveryState(recoveryMountSource.path),
          );
        }
        return recoveredFiles;
      } catch (error) {
        if (isTrackingCurrentProjectMountRecovery && recoveryMountSource.type === 'tauri') {
          setMountRecoveryState(
            createFailedProjectMountRecoveryState(recoveryMountSource.path, error),
          );
        }
        throw error;
      }
    })().finally(() => {
      if (mountRecoveryPromiseRef.current === mountPromise) {
        mountRecoveryPromiseRef.current = null;
      }
    });

    mountRecoveryPromiseRef.current = mountPromise;
    return await mountPromise;
  }, [
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    projectPath,
  ]);

  const ensureMountedProjectRoot = useCallback(async (targetProjectId: string) => {
    return await recoverMountedProjectRoot(targetProjectId);
  }, [recoverMountedProjectRoot]);

  useEffect(() => {
    let isMounted = true;
    const requestProjectId = normalizedProjectId;
    const recoveryMountSource = resolveProjectMountRecoverySource(projectPath);
    const loadFiles = async () => {
      if (!isProjectActive(requestProjectId)) {
        return;
      }

      const requestVersion = beginFileTreeRequestVersion();
      const canCommitMountRecoveryState = () =>
        isMounted && isLatestFileTreeRequest(requestProjectId, requestVersion);

      try {
        const persistedSelectedFilePath = await getStoredJson<string | null>(
          EDITOR_RECOVERY_SCOPE,
          selectionStorageKey,
          null,
        ).catch(() => null);
        let data = await fileSystemService.getFiles(requestProjectId);
        if (recoveryMountSource) {
          if (data.length > 0) {
            if (canCommitMountRecoveryState() && recoveryMountSource.type === 'tauri') {
              setMountRecoveryState(
                createRecoveredProjectMountRecoveryState(recoveryMountSource.path),
              );
            }
          } else {
            try {
              data = await recoverMountedProjectRoot(requestProjectId, {
                skipInitialFileCheck: true,
              });
            } catch (error) {
              console.error('Failed to recover mounted project root', error);
            }
          }
        } else if (canCommitMountRecoveryState()) {
          setMountRecoveryState(createIdleProjectMountRecoveryState());
        }
        if (isMounted && isLatestFileTreeRequest(requestProjectId, requestVersion)) {
          syncFilesAndSelection(data, undefined, persistedSelectedFilePath);
        }
      } catch (error) {
        console.error("Failed to load files", error);
      } finally {
        if (isMounted) {
          completeFileTreeRequestVersion(requestProjectId);
        }
      }
    };

    if (!requestProjectId || !loadActive) {
      return () => {
        isMounted = false;
      };
    }

    void loadFiles();
    return () => { isMounted = false; };
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    recoverMountedProjectRoot,
    fileSystemService,
    loadActive,
    isLatestFileTreeRequest,
    isProjectActive,
    normalizedProjectId,
    projectPath,
    selectionStorageKey,
    syncFilesAndSelection,
  ]);

  useEffect(() => {
    if (!normalizedProjectId) {
      return;
    }

    if (!selectedFile) {
      void removeStoredValue(EDITOR_RECOVERY_SCOPE, selectionStorageKey).catch((error) => {
        console.error('Failed to clear persisted selected file', error);
      });
      return;
    }

    void setStoredJson(EDITOR_RECOVERY_SCOPE, selectionStorageKey, selectedFile).catch((error) => {
      console.error('Failed to persist selected file', error);
    });
  }, [normalizedProjectId, selectedFile, selectionStorageKey]);

  // Load content when selectedFile changes
  useEffect(() => {
    let isMounted = true;
    const requestProjectId = normalizedProjectId;
    const requestSelectedFile = selectedFile;
    const loadContent = async () => {
      if (!requestProjectId || !requestSelectedFile || !loadActive) return;
      if (!isProjectActive(requestProjectId)) {
        return;
      }

      const cachedContent = openFileContentCacheRef.current.get(requestSelectedFile);
      if (cachedContent !== undefined) {
        commitVisibleFileContent(cachedContent);
        void syncSelectedFileFromSource(requestProjectId, requestSelectedFile);
        return;
      }

      const requestVersion = beginFileContentRequestVersion();
      try {
        const content = await fileSystemService.getFileContent(requestProjectId, requestSelectedFile);
        if (isMounted && isLatestFileContentRequest(requestProjectId, requestVersion)) {
          try {
            setTrackedFileRevision(
              requestSelectedFile,
              await fileSystemService.getFileRevision(
                requestProjectId,
                requestSelectedFile,
              ),
            );
          } catch {
            setTrackedFileRevision(requestSelectedFile, null);
          }
          setCachedFileContent(requestSelectedFile, content);
          commitVisibleFileContent(content);
        }
      } catch (error) {
        if (isMounted && isLatestFileContentRequest(requestProjectId, requestVersion)) {
          setTrackedFileRevision(requestSelectedFile, null);
          deleteCachedFileContent(requestSelectedFile);
          if (isMissingFileSystemEntryError(error)) {
            reconcileMissingActiveFile(requestSelectedFile);
            return;
          }
          commitVisibleFileContent('// File content not found');
        }
      } finally {
        if (isMounted) {
          completeFileContentRequestVersion(requestProjectId);
        }
      }
    };

    void loadContent();
    return () => { isMounted = false; };
  }, [
    beginFileContentRequestVersion,
    completeFileContentRequestVersion,
    fileSystemService,
    loadActive,
    commitVisibleFileContent,
    deleteCachedFileContent,
    isLatestFileContentRequest,
    isProjectActive,
    normalizedProjectId,
    reconcileMissingActiveFile,
    selectedFile,
    setCachedFileContent,
    setTrackedFileRevision,
    syncSelectedFileFromSource,
  ]);

  const selectFile = useCallback((path: string) => {
    commitEditorOpenFileState(openEditorFile(readCurrentEditorOpenFileState(), path));
  }, [commitEditorOpenFileState, readCurrentEditorOpenFileState]);

  const closeFile = useCallback((path: string) => {
    commitEditorOpenFileState(closeEditorFile(readCurrentEditorOpenFileState(), path));
  }, [commitEditorOpenFileState, readCurrentEditorOpenFileState]);

  const loadDirectory = useCallback(async (path: string) => {
    const requestProjectId = normalizedProjectId;
    const normalizedPath = path.trim();
    if (!requestProjectId || !normalizedPath) {
      return;
    }

    setLoadingDirectoryPaths((previousState) => ({
      ...previousState,
      [normalizedPath]: true,
    }));
    try {
      const data = await fileSystemService.loadDirectory(requestProjectId, normalizedPath);
      if (!isProjectActive(requestProjectId)) {
        return;
      }

      syncFilesAndSelection(data, readCurrentEditorOpenFileState());
    } catch (error) {
      console.error('Failed to load directory', error);
    } finally {
      setLoadingDirectoryPaths((previousState) => {
        if (!previousState[normalizedPath]) {
          return previousState;
        }

        const nextState = { ...previousState };
        delete nextState[normalizedPath];
        return nextState;
      });
    }
  }, [
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  const saveFileContent = useCallback(async (path: string, content: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    if (
      pendingAutosaveRef.current?.projectId === mutationProjectId &&
      pendingAutosaveRef.current.path === path
    ) {
      pendingAutosaveRef.current = null;
      clearPendingAutosaveTimer();
    }

    await persistFileContentForProject(mutationProjectId, path, content);
  }, [
    clearPendingAutosaveTimer,
    normalizedProjectId,
    persistFileContentForProject,
  ]);

  const updateFileDraft = useCallback((content: string) => {
    const activePath = selectedFileRef.current;
    if (!activePath) {
      return;
    }

    setCachedFileContent(activePath, content);
    commitVisibleFileContent(content);
    queueFileAutosave(activePath, content);
  }, [commitVisibleFileContent, queueFileAutosave, setCachedFileContent]);

  const createFile = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      const normalizedPath = resolveMountedMutationPath(path, resolveProjectMountedRootPath());
      await ensureMountedProjectRoot(mutationProjectId);
      await fileSystemService.createFile(mutationProjectId, normalizedPath);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'create-file',
            path: normalizedPath,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to create file", error);
    } finally {
      completeFileTreeRequestVersion(mutationProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    ensureMountedProjectRoot,
    fileSystemService,
    isLatestFileTreeRequest,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    resolveProjectMountedRootPath,
    syncFilesAndSelection,
  ]);

  const createFolder = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      const normalizedPath = resolveMountedMutationPath(path, resolveProjectMountedRootPath());
      await ensureMountedProjectRoot(mutationProjectId);
      await fileSystemService.createFolder(mutationProjectId, normalizedPath);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'create-folder',
            path: normalizedPath,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to create folder", error);
    } finally {
      completeFileTreeRequestVersion(mutationProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    ensureMountedProjectRoot,
    fileSystemService,
    isLatestFileTreeRequest,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    resolveProjectMountedRootPath,
    syncFilesAndSelection,
  ]);

  const deleteFile = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.deleteFile(mutationProjectId, path);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'delete-file',
            path,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to delete file", error);
    } finally {
      completeFileTreeRequestVersion(mutationProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  const deleteFolder = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.deleteFolder(mutationProjectId, path);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'delete-folder',
            path,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to delete folder", error);
    } finally {
      completeFileTreeRequestVersion(mutationProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  const renameNode = useCallback(async (oldPath: string, newPath: string) => {
    const mutationProjectId = normalizedProjectId;
    if (!mutationProjectId) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.renameNode(mutationProjectId, oldPath, newPath);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'rename-node',
            oldPath,
            newPath,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to rename node", error);
    } finally {
      completeFileTreeRequestVersion(mutationProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  const searchFiles = useCallback(async (query: string): Promise<WorkspaceFileSearchResponse> => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;

    if (!normalizedProjectId || !query.trim()) {
      return {
        status: 'completed',
        limitReached: false,
        results: [],
      };
    }

    const searchProjectId = normalizedProjectId;
    const requestVersion = beginSearchRequestVersion();
    const searchAbortController =
      typeof AbortController === 'undefined' ? null : new AbortController();
    searchAbortControllerRef.current = searchAbortController;

    try {
      const results = await fileSystemService.searchFiles(searchProjectId, {
        query,
        maxResults: MAX_FILE_SEARCH_RESULTS,
        maxSnippetLength: MAX_FILE_SEARCH_SNIPPET_LENGTH,
        signal: searchAbortController?.signal,
      });

      if (!isLatestSearchRequest(searchProjectId, requestVersion)) {
        return {
          status: 'stale',
          limitReached: false,
          results: [],
        };
      }

      return {
        status: 'completed',
        limitReached: results.limitReached,
        results: results.results,
      };
    } finally {
      if (searchAbortControllerRef.current === searchAbortController) {
        searchAbortControllerRef.current = null;
      }
      completeSearchRequestVersion(searchProjectId);
    }
  }, [
    beginSearchRequestVersion,
    completeSearchRequestVersion,
    fileSystemService,
    isLatestSearchRequest,
    normalizedProjectId,
  ]);

  const mountFolder = useCallback(async (targetProjectId: string, folderInfo: LocalFolderMountSource) => {
    const normalizedTargetProjectId = targetProjectId.trim();
    if (!normalizedTargetProjectId) {
      throw new Error('Project ID is required to mount a folder.');
    }

    const requestVersion = beginFileTreeRequestVersion();
    const isTrackingCurrentProjectMountRecovery =
      normalizedTargetProjectId === normalizedProjectId && isProjectActive(normalizedTargetProjectId);
    try {
      if (
        isTrackingCurrentProjectMountRecovery &&
        folderInfo.type === 'tauri' &&
        isLatestFileTreeRequest(normalizedTargetProjectId, requestVersion)
      ) {
        setMountRecoveryState(createRecoveringProjectMountRecoveryState(folderInfo.path));
      }
      await fileSystemService.mountFolder(normalizedTargetProjectId, folderInfo);
      emitProjectGitOverviewRefresh(normalizedTargetProjectId);
      if (normalizedTargetProjectId !== normalizedProjectId || !isProjectActive(normalizedTargetProjectId)) {
        return;
      }
      if (!isLatestFileTreeRequest(normalizedTargetProjectId, requestVersion)) {
        return;
      }
      setMountRecoveryState(
        folderInfo.type === 'tauri'
          ? createRecoveredProjectMountRecoveryState(folderInfo.path)
          : createIdleProjectMountRecoveryState(),
      );
      const data = await fileSystemService.getFiles(normalizedTargetProjectId);
      if (!isLatestFileTreeRequest(normalizedTargetProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'mount-folder',
          },
        }),
      );
    } catch (error) {
      if (
        isTrackingCurrentProjectMountRecovery &&
        folderInfo.type === 'tauri' &&
        isLatestFileTreeRequest(normalizedTargetProjectId, requestVersion)
      ) {
        setMountRecoveryState(createFailedProjectMountRecoveryState(folderInfo.path, error));
      }
      console.error("Failed to mount folder", error);
      throw error;
    } finally {
      completeFileTreeRequestVersion(normalizedTargetProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    isProjectActive,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  const refreshFiles = useCallback(async () => {
    const requestProjectId = normalizedProjectId;
    if (!requestProjectId) {
      return;
    }

    if (!isProjectActive(requestProjectId)) {
      return;
    }

    try {
      const loadedDirectoryPaths = [...filesIndexRef.current.loadedDirectoryPaths];
      const data = await fileSystemService.refreshDirectories(
        requestProjectId,
        loadedDirectoryPaths,
      );
      if (!isProjectActive(requestProjectId)) {
        return;
      }
      syncFilesAndSelection(
        data,
        resolveEditorOpenFileStateAfterMutation({
          state: readCurrentEditorOpenFileState(),
          mutation: {
            type: 'refresh-files',
          },
        }),
      );
    } catch (error) {
      console.error("Failed to refresh files", error);
    }
  }, [
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    readCurrentEditorOpenFileState,
    syncFilesAndSelection,
  ]);

  useEffect(() => {
    const wasRealtimeSyncEnabled = previousRealtimeSyncEnabledRef.current;
    previousRealtimeSyncEnabledRef.current = shouldRunRealtimeSync;
    if (!shouldRunRealtimeSync || wasRealtimeSyncEnabled) {
      return;
    }

    if (realtimeSyncCycleInFlightRef.current) {
      return;
    }

    realtimeSyncCycleInFlightRef.current = true;
    void (async () => {
      try {
        await refreshFiles();
        const activeSelectedFile = selectedFileRef.current;
        if (!activeSelectedFile) {
          await syncInactiveOpenFilesFromSource(normalizedProjectId);
          return;
        }

        await syncSelectedFileFromSource(normalizedProjectId, activeSelectedFile);
        await syncInactiveOpenFilesFromSource(normalizedProjectId);
      } finally {
        realtimeSyncCycleInFlightRef.current = false;
      }
    })();
  }, [
    normalizedProjectId,
    refreshFiles,
    shouldRunRealtimeSync,
    syncInactiveOpenFilesFromSource,
    syncSelectedFileFromSource,
  ]);

  useEffect(() => {
    const requestProjectId = normalizedProjectId;
    if (!requestProjectId || !shouldRunRealtimeSync) {
      return;
    }

    const unsubscribe = fileSystemService.subscribeToFileChanges(
      requestProjectId,
      (event) => {
        if (!isProjectActive(requestProjectId)) {
          return;
        }
        queueFileChangeReconciliation(requestProjectId, event);
      },
      {
        getTrackedFilePaths: resolveTrackedRealtimeFilePaths,
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    queueFileChangeReconciliation,
    resolveTrackedRealtimeFilePaths,
    shouldRunRealtimeSync,
  ]);

  return {
    files,
    isLoading,
    loadingDirectoryPaths,
    openFiles,
    selectedFile,
    fileContent,
    isLoadingContent,
    isSearchingFiles,
    mountRecoveryState,
    selectFile,
    loadDirectory,
    closeFile,
    updateFileDraft,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    mountFolder,
    refreshFiles
  };
}
