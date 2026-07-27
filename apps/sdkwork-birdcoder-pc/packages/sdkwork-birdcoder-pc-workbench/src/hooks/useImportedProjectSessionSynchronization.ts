import { useCallback, useLayoutEffect, useRef } from 'react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  hydrateImportedProjectFromAuthority,
  type HydrateImportedProjectFromAuthorityResult,
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

export interface UseImportedProjectSessionSynchronizationOptions {
  agentSessionService: IAgentSessionService;
  knownProjects: readonly AgentProjectView[];
  onSynchronized: (result: HydrateImportedProjectFromAuthorityResult) => void;
  projectService: IProjectService;
  userScope: string;
  workspaceId: string;
}

interface ActiveProjectSessionSynchronizationScope {
  consumerCount: number;
  scope: ProjectSessionSynchronizationScope;
}

interface ProjectSessionSynchronizationLifecycleScope {
  userScope: string;
  workspaceId: string;
}

export function useImportedProjectSessionSynchronization({
  agentSessionService,
  knownProjects,
  onSynchronized,
  projectService,
  userScope,
  workspaceId,
}: UseImportedProjectSessionSynchronizationOptions) {
  const coordinatorRef = useRef(
    createProjectSessionSynchronizationCoordinator<HydrateImportedProjectFromAuthorityResult>(),
  );
  const activeScopesRef = useRef(
    new Map<string, ActiveProjectSessionSynchronizationScope>(),
  );
  const lifecycleGenerationRef = useRef(0);
  const onSynchronizedRef = useRef(onSynchronized);
  const lifecycleScopeRef = useRef<ProjectSessionSynchronizationLifecycleScope | null>({
    userScope: userScope.trim(),
    workspaceId: workspaceId.trim(),
  });

  useLayoutEffect(() => {
    onSynchronizedRef.current = onSynchronized;
  }, [onSynchronized]);

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

  const invalidateImportedProjectSessionSynchronization = useCallback((projectId: string) => {
    const scope = resolveScope(projectId);
    if (scope) {
      coordinatorRef.current.invalidate(scope);
    }
  }, [resolveScope]);

  const synchronizeImportedProject = useCallback(async (
    projectId: string,
    force = false,
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
        const result = await hydrateImportedProjectFromAuthority({
          agentSessionService,
          knownProjects,
          projectId: scope.projectId,
          projectService,
          signal,
          userScope: scope.userScope,
          workspaceId: scope.workspaceId,
        });
        if (!result) {
          throw new Error('The project Session inventory could not be refreshed from Agents.');
        }
        return result;
      }, { force });
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
      if (force) {
        onSynchronizedRef.current(result);
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

  return {
    invalidateImportedProjectSessionSynchronization,
    synchronizeImportedProject,
  };
}
