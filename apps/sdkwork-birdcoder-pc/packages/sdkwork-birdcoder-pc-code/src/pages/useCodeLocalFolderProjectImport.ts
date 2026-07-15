import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { importLocalFolderProject } from '@sdkwork/birdcoder-pc-commons/workbench/localFolderProjectImport';
import { LocalFolderPickerUnsupportedError, openLocalFolder } from '@sdkwork/birdcoder-pc-commons/utils/fileSystem';
import { resolveEffectiveWorkspaceId } from '@sdkwork/birdcoder-pc-commons/workbench/workspaceBootstrap';
import { resolveLocalFolderImportWorkspaceId as resolveSharedLocalFolderImportWorkspaceId } from '@sdkwork/birdcoder-pc-commons/workbench/localFolderProjectWorkspace';
import { useWorkspaces } from '@sdkwork/birdcoder-pc-commons/hooks/useWorkspaces';
import type { BirdCoderProject, LocalFolderMountSource } from '@sdkwork/birdcoder-pc-types';

type CreateProjectOptions = {
  appTemplateVersionId?: string;
  description?: string;
  templatePresetKey?: string;
};

type ProjectServiceForLocalFolderImport = {
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
};

type WorkspaceIdentity = {
  id: string;
};

export function useCodeEffectiveWorkspaceId({
  isVisible,
  workspaceId,
}: {
  isVisible: boolean;
  workspaceId?: string;
}) {
  const {
    createWorkspace,
    error: workspacesError,
    hasFetched,
    workspaces,
    refreshWorkspaces,
  } = useWorkspaces({ isActive: isVisible });
  const [bootstrappedWorkspaceId, setBootstrappedWorkspaceId] = useState('');
  const workspaceBootstrapPromiseRef = useRef<Promise<string> | null>(null);
  const effectiveWorkspaceId = useMemo(() => {
    const explicitWorkspaceId = workspaceId?.trim() ?? '';
    if (explicitWorkspaceId) {
      return explicitWorkspaceId;
    }

    const normalizedBootstrappedWorkspaceId = bootstrappedWorkspaceId.trim();
    if (
      normalizedBootstrappedWorkspaceId &&
      workspaces.some((workspace) => String(workspace.id).trim() === normalizedBootstrappedWorkspaceId)
    ) {
      return normalizedBootstrappedWorkspaceId;
    }

    return workspaces
      .map((workspace) => String(workspace.id).trim())
      .find((candidateWorkspaceId) => candidateWorkspaceId.length > 0) ?? '';
  }, [bootstrappedWorkspaceId, workspaceId, workspaces]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const explicitWorkspaceId = workspaceId?.trim() ?? '';
    if (explicitWorkspaceId) {
      setBootstrappedWorkspaceId('');
      return;
    }

    if (
      effectiveWorkspaceId ||
      !hasFetched ||
      workspacesError ||
      workspaceBootstrapPromiseRef.current
    ) {
      return;
    }

    const request = resolveEffectiveWorkspaceId({
      createWorkspace,
      currentWorkspaceId: bootstrappedWorkspaceId,
      refreshWorkspaces,
      workspaces,
    });
    workspaceBootstrapPromiseRef.current = request;
    let isCancelled = false;
    void request
      .then((resolvedWorkspaceId) => {
        if (!isCancelled) {
          setBootstrappedWorkspaceId(resolvedWorkspaceId);
        }
      })
      .catch((error) => {
        console.error('Failed to initialize Code workspace', error);
      })
      .finally(() => {
        if (workspaceBootstrapPromiseRef.current === request) {
          workspaceBootstrapPromiseRef.current = null;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    bootstrappedWorkspaceId,
    createWorkspace,
    effectiveWorkspaceId,
    hasFetched,
    isVisible,
    refreshWorkspaces,
    workspaceId,
    workspaces,
    workspacesError,
  ]);

  return {
    createWorkspace,
    effectiveWorkspaceId,
    refreshWorkspaces,
  };
}

export function useCodeLocalFolderProjectImport({
  createProject,
  createWorkspace,
  effectiveWorkspaceId,
  mountFolder,
  onLocalFolderPickerUnsupported,
  projectService,
  refreshWorkspaces,
}: {
  createProject: (name: string, options?: CreateProjectOptions) => Promise<BirdCoderProject>;
  createWorkspace: (name: string, description?: string) => Promise<WorkspaceIdentity>;
  effectiveWorkspaceId: string;
  mountFolder: (projectId: string, folderInfo: LocalFolderMountSource) => Promise<void> | void;
  onLocalFolderPickerUnsupported?: (message: string) => void;
  projectService: ProjectServiceForLocalFolderImport;
  refreshWorkspaces: () => Promise<Array<{ id: string }>>;
  updateProject?: (projectId: string, updates: Partial<BirdCoderProject>) => Promise<void> | void;
}) {
  const resolveLocalFolderImportWorkspaceId = useCallback(
    () =>
      resolveSharedLocalFolderImportWorkspaceId({
        createWorkspace,
        effectiveWorkspaceId,
        refreshWorkspaces,
      }),
    [createWorkspace, effectiveWorkspaceId, refreshWorkspaces],
  );

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    const pickerResult = await openLocalFolder();
    if (pickerResult.status === 'cancelled') {
      return null;
    }
    if (pickerResult.status === 'unsupported') {
      if (onLocalFolderPickerUnsupported) {
        onLocalFolderPickerUnsupported(pickerResult.message);
        return null;
      }

      throw new LocalFolderPickerUnsupportedError(pickerResult);
    }

    const folderInfo = pickerResult.source;

    const targetWorkspaceId = await resolveLocalFolderImportWorkspaceId();
    const createProjectForTargetWorkspace = (name: string, options?: CreateProjectOptions) => {
      if (targetWorkspaceId === effectiveWorkspaceId) {
        return createProject(name, options);
      }

      return projectService.createProject(targetWorkspaceId, name, options);
    };
    const importedProject = await importLocalFolderProject({
      createProject: createProjectForTargetWorkspace,
      fallbackProjectName,
      folderInfo,
      mountFolder: async (projectId, nextFolderInfo) => {
        await mountFolder(projectId, nextFolderInfo);
      },
    });

    return {
      ...importedProject,
      workspaceId: targetWorkspaceId,
    };
  }, [
    createProject,
    effectiveWorkspaceId,
    mountFolder,
    onLocalFolderPickerUnsupported,
    projectService,
    resolveLocalFolderImportWorkspaceId,
  ]);

  return {
    selectFolderAndImportProject,
  };
}
