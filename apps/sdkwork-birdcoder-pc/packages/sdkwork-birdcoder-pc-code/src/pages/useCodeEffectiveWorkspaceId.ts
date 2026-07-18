import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaces } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkspaces';
import { resolveEffectiveWorkspaceId } from '@sdkwork/birdcoder-pc-workbench/workbench/workspaceBootstrap';

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
