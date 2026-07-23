import { useEffect, useMemo, useRef, useState } from 'react';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  isAgentSessionViewExecuting,
  type AgentSessionView,
  type AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import { useAuth } from '../context/AuthContext.ts';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import {
  buildAgentSessionItemsRefreshScopeKey,
  refreshAgentSessionItems,
} from '../workbench/sessionRefresh.ts';

const EXECUTING_REFRESH_INTERVAL_MS = 15_000;
const IDLE_REFRESH_INTERVAL_MS = 60_000;

export interface UseSelectedAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  isActive?: boolean;
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
  projectService,
  selectionRefreshToken,
  selectedAgentSession,
  selectedAgentSessionId,
  selectedProject,
}: UseSelectedAgentSessionItemsOptions): boolean {
  const { sessionRevision, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  const activeRequestKeyRef = useRef('');
  const normalizedSessionId = normalize(selectedAgentSessionId);
  const userScope = `${normalize(user?.id) || 'anonymous'}:${sessionRevision}`;
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
      selectedAgentSession?.updatedAt ?? '',
      selectedAgentSession?.transcriptUpdatedAt ?? '',
      selectedAgentSession?.items.length ?? 0,
      pollRevision,
    ].join('\u0001'),
    [
      pollRevision,
      refreshScopeKey,
      selectedAgentSession?.items.length,
      selectedAgentSession?.transcriptUpdatedAt,
      selectedAgentSession?.updatedAt,
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
    setIsLoading(true);

    void refreshAgentSessionItems({
      agentSessionService,
      agentSessionId: normalizedSessionId,
      resolvedLocation:
        selectedProject && selectedAgentSession
          ? { agentSession: selectedAgentSession, project: selectedProject }
          : undefined,
    })
      .then(async (result) => {
        if (disposed || result.status !== 'refreshed' || !result.agentSession) {
          return;
        }
        const project =
          selectedProject?.projectId === result.projectId
            ? selectedProject
            : await projectService.getProjectById(result.projectId);
        if (disposed) {
          return;
        }
        if (project) {
          upsertProjectIntoProjectsStore(project, userScope);
        }
        upsertAgentSessionIntoProjectsStore(
          result.projectId,
          result.agentSession,
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
          setIsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [
    agentSessionService,
    isActive,
    normalizedSessionId,
    projectService,
    requestKey,
    selectedAgentSession,
    selectedProject,
    userScope,
  ]);

  return isLoading;
}
