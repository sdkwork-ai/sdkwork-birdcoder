import { useCallback, useLayoutEffect, useRef } from 'react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  importProjectProviderSessions as importProjectProviderSessionsFromAuthority,
  refreshImportedProjectFromAuthority,
  type ImportedProjectSessionInventoryResult,
} from '../workbench/importedProjectHydration.ts';
import {
  buildProjectsStoreScopeKey,
  mutateProjectsStoreByScopeKey,
} from '../stores/projectsStore.ts';
import { applyProjectSessionActivityRefresh } from '../workbench/sessionRefresh.ts';
import {
  buildProjectSessionSynchronizationScopeKey,
  createProjectSessionSynchronizationCoordinator,
  type ProjectSessionSynchronizationScope,
} from '../workbench/projectSessionSynchronization.ts';

export interface UseImportedProjectSessionInventoryOptions {
  agentSessionService: IAgentSessionService;
  knownProjects: readonly AgentProjectView[];
  onRefreshed: (result: ImportedProjectSessionInventoryResult) => void;
  projectService: IProjectService;
  userScope: string;
  workspaceId: string;
}

interface ActiveProjectSessionInventoryScope {
  consumerCount: number;
  scope: ProjectSessionSynchronizationScope;
}

interface ProjectSessionInventoryLifecycleScope {
  userScope: string;
  workspaceId: string;
}

export function useImportedProjectSessionInventory({
  agentSessionService,
  knownProjects,
  onRefreshed,
  projectService,
  userScope,
  workspaceId,
}: UseImportedProjectSessionInventoryOptions) {
  const coordinatorRef = useRef(
    createProjectSessionSynchronizationCoordinator<ImportedProjectSessionInventoryResult>(),
  );
  const activeScopesRef = useRef(new Map<string, ActiveProjectSessionInventoryScope>());
  const lifecycleGenerationRef = useRef(0);
  const onRefreshedRef = useRef(onRefreshed);
  const lifecycleScopeRef = useRef<ProjectSessionInventoryLifecycleScope | null>({
    userScope: userScope.trim(),
    workspaceId: workspaceId.trim(),
  });

  useLayoutEffect(() => {
    onRefreshedRef.current = onRefreshed;
  }, [onRefreshed]);

  useLayoutEffect(() => {
    lifecycleScopeRef.current = {
      userScope: userScope.trim(),
      workspaceId: workspaceId.trim(),
    };
    return () => {
      lifecycleScopeRef.current = null;
      lifecycleGenerationRef.current += 1;
      for (const activeScope of activeScopesRef.current.values()) {
        coordinatorRef.current.invalidate(activeScope.scope);
      }
      activeScopesRef.current.clear();
    };
  }, [userScope, workspaceId]);

  const resolveScope = useCallback((projectId: string) => {
    const normalizedProjectId = projectId.trim();
    const normalizedUserScope = userScope.trim();
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedProjectId || !normalizedUserScope || !normalizedWorkspaceId) {
      return null;
    }
    return {
      projectId: normalizedProjectId,
      userScope: normalizedUserScope,
      workspaceId: normalizedWorkspaceId,
    };
  }, [userScope, workspaceId]);

  const invalidateImportedProjectSessionInventory = useCallback((projectId: string) => {
    const scope = resolveScope(projectId);
    if (scope) {
      coordinatorRef.current.invalidate(scope);
    }
  }, [resolveScope]);

  const runProjectSessionInventoryRequest = useCallback(async (
    projectId: string,
    options: { force: boolean; importProviderSessions: boolean },
  ) => {
    const scope = resolveScope(projectId);
    if (!scope) {
      return null;
    }
    const lifecycleScope = lifecycleScopeRef.current;
    if (
      !lifecycleScope
      || lifecycleScope.userScope !== scope.userScope
      || lifecycleScope.workspaceId !== scope.workspaceId
    ) {
      return null;
    }

    const lifecycleGeneration = lifecycleGenerationRef.current;
    const scopeKey = buildProjectSessionSynchronizationScopeKey(scope);
    let activeScope = activeScopesRef.current.get(scopeKey);
    if (!activeScope) {
      activeScope = { consumerCount: 0, scope };
      activeScopesRef.current.set(scopeKey, activeScope);
    }
    activeScope.consumerCount += 1;

    try {
      const result = await coordinatorRef.current.synchronize(scope, async ({ signal }) => {
        const request = {
          agentSessionService,
          knownProjects,
          projectId: scope.projectId,
          projectService,
          signal,
          userScope: scope.userScope,
          workspaceId: scope.workspaceId,
        };
        const refreshed = options.importProviderSessions
          ? await importProjectProviderSessionsFromAuthority(request)
          : await refreshImportedProjectFromAuthority(request);
        if (!refreshed) {
          throw new Error('The project Session inventory could not be refreshed from Agents.');
        }
        return refreshed;
      }, { force: options.force });
      const currentLifecycleScope = lifecycleScopeRef.current;
      if (
        lifecycleGenerationRef.current !== lifecycleGeneration
        || !currentLifecycleScope
        || currentLifecycleScope.userScope !== scope.userScope
        || currentLifecycleScope.workspaceId !== scope.workspaceId
        || !result
      ) {
        return null;
      }
      const storeScopeKey = buildProjectsStoreScopeKey(scope.userScope, scope.workspaceId);
      mutateProjectsStoreByScopeKey(
        storeScopeKey,
        (projects) => applyProjectSessionActivityRefresh(
          projects,
          result.project,
          result.deletedSessionIds,
          {
            deletedSessionTombstones: result.deletedSessionTombstones,
            scopeKey: storeScopeKey,
          },
        ),
      );
      if (options.force) {
        onRefreshedRef.current(result);
      }
      return result;
    } finally {
      if (activeScopesRef.current.get(scopeKey) === activeScope) {
        activeScope.consumerCount -= 1;
        if (activeScope.consumerCount === 0) {
          activeScopesRef.current.delete(scopeKey);
        }
      }
    }
  }, [agentSessionService, knownProjects, projectService, resolveScope]);

  const refreshImportedProject = useCallback(
    (projectId: string, force = false) => runProjectSessionInventoryRequest(projectId, {
      force,
      importProviderSessions: false,
    }),
    [runProjectSessionInventoryRequest],
  );

  const importProjectProviderSessions = useCallback(
    (projectId: string) => runProjectSessionInventoryRequest(projectId, {
      force: true,
      importProviderSessions: true,
    }),
    [runProjectSessionInventoryRequest],
  );

  return {
    importProjectProviderSessions,
    invalidateImportedProjectSessionInventory,
    refreshImportedProject,
  };
}
