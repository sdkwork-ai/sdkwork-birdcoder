import { useEffect, useMemo, useRef, useState } from 'react';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  isAgentSessionViewExecuting,
  type AgentSessionView,
  type AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  buildProjectsStoreScopeKey,
  peekProjectsStore,
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import {
  buildAgentSessionItemsRefreshScopeKey,
  mergeRefreshedAgentSessionIntoCurrent,
  refreshAgentSessionItems,
} from '../workbench/sessionRefresh.ts';

const EXECUTING_REFRESH_INTERVAL_MS = 15_000;
const IDLE_REFRESH_INTERVAL_MS = 60_000;

export interface UseSelectedAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  isActive?: boolean;
  onAgentSessionUnavailable?: (agentSessionId: string, projectId: string) => void;
  projectService: IProjectService;
  selectionRefreshToken: number;
  selectedAgentSession?: AgentSessionView | null;
  selectedAgentSessionId?: string | null;
  selectedProject?: AgentProjectView | null;
}

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function useSelectedAgentSessionItems({
  agentSessionService,
  isActive = true,
  onAgentSessionUnavailable,
  projectService,
  selectionRefreshToken,
  selectedAgentSession,
  selectedAgentSessionId,
  selectedProject,
}: UseSelectedAgentSessionItemsOptions): boolean {
  const { sessionRevision, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  const activeRequestKeyRef = useRef<string | null>(null);
  const selectedAgentSessionRef = useRef(selectedAgentSession);
  const selectedProjectRef = useRef(selectedProject);
  selectedAgentSessionRef.current = selectedAgentSession;
  selectedProjectRef.current = selectedProject;
  const normalizedSessionId = normalize(selectedAgentSessionId);
  const userScope = buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision);
  const resolvedProjectId =
    normalize(selectedProject?.projectId) || normalize(selectedAgentSession?.projectId);
  const isExecuting = isAgentSessionViewExecuting(selectedAgentSession);
  const refreshScopeKey = useMemo(
    () =>
      normalizedSessionId && resolvedProjectId
        ? buildAgentSessionItemsRefreshScopeKey({
            agentSessionId: normalizedSessionId,
            identityScope: userScope,
            projectId: resolvedProjectId,
          })
        : '',
    [normalizedSessionId, resolvedProjectId, userScope],
  );

  const requestKey = useMemo(
    () => [
      refreshScopeKey,
      selectionRefreshToken,
      pollRevision,
    ].join('\u0001'),
    [
      pollRevision,
      refreshScopeKey,
      selectionRefreshToken,
    ],
  );

  useEffect(() => {
    if (!isActive || !normalizedSessionId) {
      return undefined;
    }
    const interval = window.setInterval(
      () => setPollRevision((revision) => revision + 1),
      isExecuting ? EXECUTING_REFRESH_INTERVAL_MS : IDLE_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [isActive, isExecuting, normalizedSessionId]);

  useEffect(() => {
    if (!isActive || !normalizedSessionId || activeRequestKeyRef.current === requestKey) {
      return undefined;
    }
    activeRequestKeyRef.current = requestKey;
    let disposed = false;
    const controller = new AbortController();
    const requestAgentSession = selectedAgentSessionRef.current;
    const requestProject = selectedProjectRef.current;
    setIsLoading(true);

    void refreshAgentSessionItems({
      agentSessionService,
      agentSessionId: normalizedSessionId,
      signal: controller.signal,
      resolvedLocation:
        requestProject
          ? {
              ...(requestAgentSession ? { agentSession: requestAgentSession } : {}),
              project: requestProject,
            }
          : undefined,
    })
      .then(async (result) => {
        if (disposed) {
          return;
        }
        if (result.status === 'not-found') {
          onAgentSessionUnavailable?.(
            normalizedSessionId,
            result.projectId || requestProject?.projectId || '',
          );
          return;
        }
        if (result.status !== 'refreshed' || !result.agentSession) {
          return;
        }
        const latestSelectedProject = selectedProjectRef.current;
        const project =
          latestSelectedProject?.projectId === result.projectId
            ? latestSelectedProject
            : await projectService.getProjectById(result.projectId);
        if (disposed) {
          return;
        }
        if (!project) {
          return;
        }
        const storeScopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
        const currentAgentSession = peekProjectsStore(storeScopeKey)
          ?.snapshot.projects
          .find((candidateProject) => candidateProject.projectId === result.projectId)
          ?.agentSessions
          .find((candidateSession) => candidateSession.id === result.agentSessionId);
        const committedAgentSession = currentAgentSession
          ? mergeRefreshedAgentSessionIntoCurrent(currentAgentSession, result.agentSession)
          : result.agentSession;
        upsertProjectIntoProjectsStore(project, userScope);
        upsertAgentSessionIntoProjectsStore(
          result.projectId,
          committedAgentSession,
          project.workspaceId,
          userScope,
        );
      })
      .catch((error: unknown) => {
        if (!disposed) {
          console.error('Failed to load Agents session items', error);
        }
      })
      .finally(() => {
        if (!disposed) {
          if (activeRequestKeyRef.current === requestKey) {
            activeRequestKeyRef.current = null;
          }
          setIsLoading(false);
        }
      });

    return () => {
      disposed = true;
      if (activeRequestKeyRef.current === requestKey) {
        activeRequestKeyRef.current = null;
      }
      controller.abort(new Error('Selected Agents session item request was superseded.'));
    };
  }, [
    agentSessionService,
    isActive,
    normalizedSessionId,
    onAgentSessionUnavailable,
    projectService,
    requestKey,
    userScope,
  ]);

  return isLoading;
}
