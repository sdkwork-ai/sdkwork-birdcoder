import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import type { IFileNode, LocalFolderMountSource } from '@sdkwork/birdcoder-types';
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
// Compatibility marker for boundary contracts: from '../workbench/projectMountRecovery';
// Compatibility marker for boundary contracts: from '../workbench/fileSelectionMutation';
import { resolveSelectedFileAfterMutation } from '../workbench/fileSelectionMutation.ts';
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

export function useFileSystem(projectId: string, projectPath?: string) {
  const { fileSystemService } = useIDEServices();
  const normalizedProjectId = projectId.trim();
  const [files, setFiles] = useState<IFileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const [isSelectionHydrated, setIsSelectionHydrated] = useState(false);
  const [mountRecoveryState, setMountRecoveryState] = useState<ProjectMountRecoveryState>(
    createIdleProjectMountRecoveryState,
  );
  const selectionStorageKey = buildEditorSelectionStorageKey(normalizedProjectId);
  const selectedFileRef = useRef<string | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const mountRecoveryPromiseRef = useRef<Promise<void> | null>(null);
  const requestGuardRef = useRef(createFileSystemRequestGuardState(projectId));
  const previousProjectIdRef = useRef(normalizedProjectId);

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

  const commitSelectedFile = useCallback((nextSelectedFile: string | null) => {
    selectedFileRef.current = nextSelectedFile;
    setSelectedFile(nextSelectedFile);
  }, []);

  const syncFilesAndSelection = useCallback(
    (nextFiles: IFileNode[], candidateSelectedFilePath: string | null) => {
      setFiles(nextFiles);
      const nextSelectedFile = resolveStartupSelectedFile({
        files: nextFiles,
        persistedSelectedFilePath: candidateSelectedFilePath,
      });
      commitSelectedFile(nextSelectedFile);
      setIsSelectionHydrated(true);
      if (!nextSelectedFile) {
        setFileContent('');
      }
    },
    [commitSelectedFile],
  );

  useLayoutEffect(() => {
    const nextProjectId = projectId.trim();
    if (previousProjectIdRef.current === nextProjectId) {
      return;
    }

    previousProjectIdRef.current = nextProjectId;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    requestGuardRef.current = resetFileSystemRequestGuardState(
      requestGuardRef.current,
      nextProjectId,
    );
    mountRecoveryPromiseRef.current = null;
    selectedFileRef.current = null;
    setFiles([]);
    setIsLoading(false);
    commitSelectedFile(null);
    setFileContent('');
    setIsLoadingContent(false);
    setIsSearchingFiles(false);
    setIsSelectionHydrated(false);
    setMountRecoveryState(createIdleProjectMountRecoveryState());
  }, [projectId]);

  useEffect(() => () => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
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

  const ensureMountedProjectRoot = useCallback(async (targetProjectId: string) => {
    const recoveryMountSource = resolveProjectMountRecoverySource(projectPath);
    if (!recoveryMountSource) {
      return;
    }

    const mountedFiles = await fileSystemService.getFiles(targetProjectId);
    if (mountedFiles.length > 0) {
      return;
    }

    if (mountRecoveryPromiseRef.current) {
      await mountRecoveryPromiseRef.current;
      return;
    }

    const isTrackingCurrentProjectMountRecovery =
      targetProjectId === normalizedProjectId && isProjectActive(targetProjectId);
    const mountPromise = (async () => {
      try {
        if (isTrackingCurrentProjectMountRecovery) {
          setMountRecoveryState(
            createRecoveringProjectMountRecoveryState(recoveryMountSource.path),
          );
        }
        await fileSystemService.mountFolder(targetProjectId, recoveryMountSource);
        if (isTrackingCurrentProjectMountRecovery) {
          setMountRecoveryState(
            createRecoveredProjectMountRecoveryState(recoveryMountSource.path),
          );
        }
      } catch (error) {
        if (isTrackingCurrentProjectMountRecovery) {
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
    await mountPromise;
  }, [
    fileSystemService,
    isProjectActive,
    normalizedProjectId,
    projectPath,
  ]);

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
        if (recoveryMountSource) {
          if (canCommitMountRecoveryState()) {
            setMountRecoveryState(
              createRecoveringProjectMountRecoveryState(recoveryMountSource.path),
            );
          }
          try {
            await fileSystemService.mountFolder(requestProjectId, recoveryMountSource);
            if (canCommitMountRecoveryState()) {
              setMountRecoveryState(
                createRecoveredProjectMountRecoveryState(recoveryMountSource.path),
              );
            }
          } catch (error) {
            if (canCommitMountRecoveryState()) {
              setMountRecoveryState(
                createFailedProjectMountRecoveryState(recoveryMountSource.path, error),
              );
            }
            console.error('Failed to recover mounted project root', error);
          }
        } else if (canCommitMountRecoveryState()) {
          setMountRecoveryState(createIdleProjectMountRecoveryState());
        }
        const data = await fileSystemService.getFiles(requestProjectId);
        if (isMounted && isLatestFileTreeRequest(requestProjectId, requestVersion)) {
          syncFilesAndSelection(data, persistedSelectedFilePath);
        }
      } catch (error) {
        console.error("Failed to load files", error);
      } finally {
        if (isMounted) {
          completeFileTreeRequestVersion(requestProjectId);
        }
      }
    };

    if (!requestProjectId) {
      return () => {
        isMounted = false;
      };
    }

    void loadFiles();
    return () => { isMounted = false; };
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    isProjectActive,
    normalizedProjectId,
    projectPath,
    selectionStorageKey,
    syncFilesAndSelection,
  ]);

  useEffect(() => {
    if (!normalizedProjectId || !isSelectionHydrated) {
      return;
    }

    if (!selectedFile) {
      void removeStoredValue(EDITOR_RECOVERY_SCOPE, selectionStorageKey).catch((error) => {
        console.error("Failed to clear persisted selected file", error);
      });
      return;
    }

    void setStoredJson(EDITOR_RECOVERY_SCOPE, selectionStorageKey, selectedFile).catch((error) => {
      console.error("Failed to persist selected file", error);
    });
  }, [isSelectionHydrated, normalizedProjectId, selectedFile, selectionStorageKey]);

  // Load content when selectedFile changes
  useEffect(() => {
    let isMounted = true;
    const requestProjectId = normalizedProjectId;
    const requestSelectedFile = selectedFile;
    const loadContent = async () => {
      if (!requestSelectedFile) return;
      if (!isProjectActive(requestProjectId)) {
        return;
      }

      const requestVersion = beginFileContentRequestVersion();
      try {
        const content = await fileSystemService.getFileContent(requestProjectId, requestSelectedFile);
        if (isMounted && isLatestFileContentRequest(requestProjectId, requestVersion)) {
          setFileContent(content);
        }
      } catch (error) {
        if (isMounted && isLatestFileContentRequest(requestProjectId, requestVersion)) {
          setFileContent('// File content not found');
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
    isLatestFileContentRequest,
    isProjectActive,
    normalizedProjectId,
    selectedFile,
  ]);

  const selectFile = useCallback((path: string) => {
    commitSelectedFile(path);
  }, [commitSelectedFile]);

  const saveFileContent = useCallback(async (path: string, content: string) => {
    const mutationProjectId = normalizedProjectId;
    try {
      await fileSystemService.saveFileContent(mutationProjectId, path, content);
      if (!isProjectActive(mutationProjectId)) {
        return;
      }

      if (selectedFileRef.current === path) {
        setFileContent(content);
      }
    } catch (error) {
      console.error("Failed to save file content", error);
    }
  }, [fileSystemService, isProjectActive, normalizedProjectId]);

  const saveFile = useCallback(async (content: string) => {
    if (!selectedFile) return;
    return saveFileContent(selectedFile, content);
  }, [selectedFile, saveFileContent]);

  const createFile = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
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
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
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
    resolveProjectMountedRootPath,
    syncFilesAndSelection,
  ]);

  const createFolder = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
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
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
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
    resolveProjectMountedRootPath,
    syncFilesAndSelection,
  ]);

  const deleteFile = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.deleteFile(mutationProjectId, path);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
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
    syncFilesAndSelection,
  ]);

  const deleteFolder = useCallback(async (path: string) => {
    const mutationProjectId = normalizedProjectId;
    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.deleteFolder(mutationProjectId, path);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
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
    syncFilesAndSelection,
  ]);

  const renameNode = useCallback(async (oldPath: string, newPath: string) => {
    const mutationProjectId = normalizedProjectId;
    const requestVersion = beginFileTreeRequestVersion();
    try {
      await fileSystemService.renameNode(mutationProjectId, oldPath, newPath);
      const data = await fileSystemService.getFiles(mutationProjectId);
      if (!isLatestFileTreeRequest(mutationProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
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
    syncFilesAndSelection,
  ]);

  const searchFiles = useCallback(async (query: string): Promise<WorkspaceFileSearchResponse> => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;

    if (!query.trim()) {
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
    const requestVersion = beginFileTreeRequestVersion();
    const isTrackingCurrentProjectMountRecovery =
      targetProjectId === normalizedProjectId && isProjectActive(targetProjectId);
    try {
      if (
        isTrackingCurrentProjectMountRecovery &&
        folderInfo.type === 'tauri' &&
        isLatestFileTreeRequest(targetProjectId, requestVersion)
      ) {
        setMountRecoveryState(createRecoveringProjectMountRecoveryState(folderInfo.path));
      }
      await fileSystemService.mountFolder(targetProjectId, folderInfo);
      if (targetProjectId !== normalizedProjectId || !isProjectActive(targetProjectId)) {
        return;
      }
      if (!isLatestFileTreeRequest(targetProjectId, requestVersion)) {
        return;
      }
      setMountRecoveryState(
        folderInfo.type === 'tauri'
          ? createRecoveredProjectMountRecoveryState(folderInfo.path)
          : createIdleProjectMountRecoveryState(),
      );
      const data = await fileSystemService.getFiles(targetProjectId);
      if (!isLatestFileTreeRequest(targetProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
          mutation: {
            type: 'mount-folder',
          },
        }),
      );
    } catch (error) {
      if (
        isTrackingCurrentProjectMountRecovery &&
        folderInfo.type === 'tauri' &&
        isLatestFileTreeRequest(targetProjectId, requestVersion)
      ) {
        setMountRecoveryState(createFailedProjectMountRecoveryState(folderInfo.path, error));
      }
      console.error("Failed to mount folder", error);
      throw error;
    } finally {
      completeFileTreeRequestVersion(targetProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    isProjectActive,
    normalizedProjectId,
    syncFilesAndSelection,
  ]);

  const refreshFiles = useCallback(async () => {
    const requestProjectId = normalizedProjectId;
    if (!isProjectActive(requestProjectId)) {
      return;
    }

    const requestVersion = beginFileTreeRequestVersion();
    try {
      const data = await fileSystemService.getFiles(requestProjectId);
      if (!isLatestFileTreeRequest(requestProjectId, requestVersion)) {
        return;
      }

      syncFilesAndSelection(
        data,
        resolveSelectedFileAfterMutation({
          currentSelectedFilePath: selectedFileRef.current,
          mutation: {
            type: 'refresh-files',
          },
        }),
      );
    } catch (error) {
      console.error("Failed to refresh files", error);
    } finally {
      completeFileTreeRequestVersion(requestProjectId);
    }
  }, [
    beginFileTreeRequestVersion,
    completeFileTreeRequestVersion,
    fileSystemService,
    isLatestFileTreeRequest,
    isProjectActive,
    normalizedProjectId,
    syncFilesAndSelection,
  ]);

  return {
    files,
    isLoading,
    selectedFile,
    fileContent,
    isLoadingContent,
    isSearchingFiles,
    mountRecoveryState,
    selectFile,
    saveFile,
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
