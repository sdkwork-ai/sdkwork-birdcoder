import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentProjectView, AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';

import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import { useIDEServices } from '../context/IDEContext.ts';
import { loadAgentSessionView } from '../services/agentSessionViewModels.ts';
import { updateAgentSessionUserState } from '../services/agentSessionUserStateUpdate.ts';
import {
  buildProjectsStoreScopeKey,
  normalizeProjectsStoreUserScope,
  removeAgentSessionFromProjectsStore,
  upsertAgentSessionIntoProjectsStore,
} from '../stores/projectsStore.ts';

const ARCHIVED_INVENTORY_PAGE_SIZE = 200;
const ARCHIVED_SESSION_HYDRATION_CONCURRENCY = 6;

interface ArchivedAgentSessionInventory {
  availableProjects: AgentProjectView[];
  error: string | null;
  isLoading: boolean;
  projects: AgentProjectView[];
}

interface UseArchivedAgentSessionsOptions {
  isActive?: boolean;
  workspaceIds: readonly string[];
}

async function mapInBatches<TInput, TOutput>(
  values: readonly TInput[],
  mapper: (value: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = [];
  for (let index = 0; index < values.length; index += ARCHIVED_SESSION_HYDRATION_CONCURRENCY) {
    results.push(...await Promise.all(
      values
        .slice(index, index + ARCHIVED_SESSION_HYDRATION_CONCURRENCY)
        .map(mapper),
    ));
  }
  return results;
}

export function useArchivedAgentSessions({
  isActive = true,
  workspaceIds,
}: UseArchivedAgentSessionsOptions) {
  const { agentSessionService, projectService } = useIDEServices();
  const { sessionRevision, user } = useAuth();
  const userScope = normalizeProjectsStoreUserScope(
    buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision),
  );
  const workspaceKey = useMemo(() => Array.from(new Set(
    workspaceIds.map((workspaceId) => workspaceId.trim()).filter(Boolean),
  )).sort().join('\u0001'), [workspaceIds]);
  const normalizedWorkspaceIds = useMemo(
    () => workspaceKey ? workspaceKey.split('\u0001') : [],
    [workspaceKey],
  );
  const requestGenerationRef = useRef(0);
  const [inventory, setInventory] = useState<ArchivedAgentSessionInventory>({
    availableProjects: [],
    error: null,
    isLoading: false,
    projects: [],
  });

  const refresh = useCallback(async () => {
    if (!isActive || normalizedWorkspaceIds.length === 0) {
      setInventory({ availableProjects: [], error: null, isLoading: false, projects: [] });
      return [];
    }
    const requestGeneration = ++requestGenerationRef.current;
    setInventory((current) => ({ ...current, error: null, isLoading: true }));
    try {
      const projectsByWorkspace = await Promise.all(normalizedWorkspaceIds.map(async (workspaceId) => {
        const workspaceProjects: AgentProjectView[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const projectPage = await projectService.getProjectsPage({
            page,
            pageSize: ARCHIVED_INVENTORY_PAGE_SIZE,
            status: 'active',
            workspaceId,
          });
          workspaceProjects.push(...projectPage.items.filter(
            (project) => project.workspaceId === workspaceId && project.status !== 'deleted',
          ));
          hasMore = projectPage.pageInfo.hasMore === true;
          if (hasMore) {
            const returnedPage = projectPage.pageInfo.page ?? page;
            if (returnedPage < page) {
              throw new Error('Archived project pagination did not advance.');
            }
            page = returnedPage + 1;
          }
        }
        return workspaceProjects;
      }));

      const projects = projectsByWorkspace.flat();
      const archivedProjects = await mapInBatches(projects, async (project) => {
        const sessionRecords: Awaited<
          ReturnType<typeof agentSessionService.listSessionsByProject>
        >['items'] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const sessionPage = await agentSessionService.listSessionsByProject({
            includeArchived: true,
            page,
            pageSize: ARCHIVED_INVENTORY_PAGE_SIZE,
            projectId: project.projectId,
          });
          sessionRecords.push(...sessionPage.items.filter(
            (session) => session.projectId === project.projectId,
          ));
          hasMore = sessionPage.pageInfo.hasMore === true;
          if (hasMore) {
            const returnedPage = sessionPage.pageInfo.page ?? page;
            if (returnedPage < page) {
              throw new Error('Archived Session pagination did not advance.');
            }
            page = returnedPage + 1;
          }
        }

        const identities = sessionRecords.map((session) => ({
          agentId: session.agentId,
          sessionId: session.sessionId,
        }));
        const userStates = identities.length > 0
          ? await agentSessionService.getSessionUserStates(identities)
          : new Map();
        const archivedRecords = sessionRecords.filter((session) => (
          session.status === 'archived' || Boolean(userStates.get(session.sessionId)?.hiddenAt)
        ));
        const archivedSessions = await mapInBatches(archivedRecords, (session) => (
          loadAgentSessionView(
            agentSessionService,
            session,
            project.projectId,
            [],
            undefined,
            undefined,
            userStates,
            { tolerateAuxiliaryMetadataFailure: true },
          )
        ));
        archivedSessions.forEach((session) => {
          upsertAgentSessionIntoProjectsStore(
            project.projectId,
            session,
            project.workspaceId,
            userScope,
            { projectMetadata: project },
          );
        });
        return { ...project, agentSessions: archivedSessions };
      });

      if (requestGenerationRef.current !== requestGeneration) {
        return archivedProjects;
      }
      const projectsWithArchivedSessions = archivedProjects.filter(
        (project) => project.agentSessions.length > 0,
      );
      setInventory({
        availableProjects: archivedProjects,
        error: null,
        isLoading: false,
        projects: projectsWithArchivedSessions,
      });
      return projectsWithArchivedSessions;
    } catch (error) {
      if (requestGenerationRef.current !== requestGeneration) {
        return [];
      }
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to load archived Sessions';
      setInventory((current) => ({ ...current, error: message, isLoading: false }));
      throw error;
    }
  }, [agentSessionService, isActive, normalizedWorkspaceIds, projectService, userScope]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [refresh]);

  const updateInventory = useCallback((
    projectId: string,
    sessionId: string,
    updater: (session: AgentSessionView) => AgentSessionView | null,
  ) => {
    setInventory((current) => ({
      ...current,
      projects: current.projects.flatMap((project) => {
        if (project.projectId !== projectId) {
          return [project];
        }
        const sessions = project.agentSessions.flatMap((session) => {
          if (session.id !== sessionId) {
            return [session];
          }
          const nextSession = updater(session);
          return nextSession ? [nextSession] : [];
        });
        return sessions.length > 0 ? [{ ...project, agentSessions: sessions }] : [];
      }),
    }));
  }, []);

  const restoreSession = useCallback(async (projectId: string, sessionId: string) => {
    const project = inventory.projects.find((candidate) => candidate.projectId === projectId);
    const session = project?.agentSessions.find((candidate) => candidate.id === sessionId);
    if (!project || !session) {
      return false;
    }
    try {
      await updateAgentSessionUserState(
        agentSessionService,
        { agentId: session.agentId, sessionId: session.id },
        session,
        { archived: false },
      );
      const restoredSession = { ...session, archived: false };
      upsertAgentSessionIntoProjectsStore(
        project.projectId,
        restoredSession,
        project.workspaceId,
        userScope,
        { projectMetadata: project },
      );
      updateInventory(projectId, sessionId, () => null);
      return true;
    } catch {
      return false;
    }
  }, [agentSessionService, inventory.projects, updateInventory, userScope]);

  const deleteSession = useCallback(async (projectId: string, sessionId: string) => {
    const project = inventory.projects.find((candidate) => candidate.projectId === projectId);
    const session = project?.agentSessions.find((candidate) => candidate.id === sessionId);
    if (!project || !session) {
      return false;
    }
    try {
      await agentSessionService.deleteSession({
        agentId: session.agentId,
        sessionId: session.id,
      });
      removeAgentSessionFromProjectsStore(
        buildProjectsStoreScopeKey(userScope, project.workspaceId),
        project.projectId,
        session.id,
        session.agentId,
      );
      updateInventory(projectId, sessionId, () => null);
      return true;
    } catch {
      return false;
    }
  }, [agentSessionService, inventory.projects, updateInventory, userScope]);

  return {
    ...inventory,
    deleteSession,
    refresh,
    restoreSession,
  };
}
