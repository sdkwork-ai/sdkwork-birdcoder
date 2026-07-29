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
  toAgentSessionView,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  peekProjectsStore,
  removeAgentSessionFromProjectsStore,
  upsertAgentSessionIntoProjectsStore,
} from '../stores/projectsStore.ts';
import {
  buildAgentSessionItemsRefreshScopeKey,
  mergeRefreshedAgentSessionIntoCurrent,
  refreshAgentSessionItems,
} from '../workbench/sessionRefresh.ts';
import type { HydrateImportedProjectFromAuthorityResult } from '../workbench/importedProjectHydration.ts';

const EXECUTING_REFRESH_INTERVAL_MS = 15_000;
const IDLE_REFRESH_INTERVAL_MS = 60_000;
const SESSION_IDENTITY_RECOVERY_PAGE_SIZE = 200;
const SESSION_IDENTITY_RECOVERY_PAGE_LIMIT = 100;

interface SelectedSessionItemsForegroundLoadingState {
  isLoading: boolean;
  requestKey: string;
}

export interface UseSelectedAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  isActive?: boolean;
  onAgentSessionItemsLoadFailed?: (agentSessionId: string) => void;
  onAgentSessionItemsLoaded?: (agentSessionId: string) => void;
  onAgentSessionUnavailable?: (agentSessionId: string, projectId: string) => void;
  projectService: IProjectService;
  selectionRefreshToken: number;
  selectedAgentSession?: AgentSessionView | null;
  selectedAgentSessionId?: string | null;
  selectedProject?: AgentProjectView | null;
  synchronizeProjectSessions: (
    projectId: string,
    force?: boolean,
  ) => Promise<HydrateImportedProjectFromAuthorityResult | null>;
}

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function canRefreshSelectedSessionInBackground(): boolean {
  return document.visibilityState !== 'hidden' && navigator.onLine !== false;
}

function notifySessionItemsObserver(
  name: string,
  callback: (() => void) | undefined,
): void {
  try {
    callback?.();
  } catch (error) {
    console.error(`Agents session items ${name} observer failed`, error);
  }
}

async function findProjectSessionRecordById(
  agentSessionService: IAgentSessionService,
  projectId: string,
  agentSessionId: string,
  signal: AbortSignal,
): Promise<AgentSessionRecord | null> {
  const seenSessionIds = new Set<string>();
  for (let page = 1; page <= SESSION_IDENTITY_RECOVERY_PAGE_LIMIT; page += 1) {
    signal.throwIfAborted();
    const sessionPage = await agentSessionService.listSessionsByProject({
      includeArchived: true,
      page,
      pageSize: SESSION_IDENTITY_RECOVERY_PAGE_SIZE,
      projectId,
    }, { signal });
    signal.throwIfAborted();
    const returnedPage = sessionPage.pageInfo.page ?? page;
    const returnedPageSize = sessionPage.pageInfo.pageSize
      ?? SESSION_IDENTITY_RECOVERY_PAGE_SIZE;
    if (
      sessionPage.pageInfo.mode !== 'offset'
      || returnedPage !== page
      || returnedPageSize !== SESSION_IDENTITY_RECOVERY_PAGE_SIZE
      || sessionPage.items.length > SESSION_IDENTITY_RECOVERY_PAGE_SIZE
      || (sessionPage.pageInfo.hasMore && sessionPage.items.length === 0)
    ) {
      throw new Error('Agents project Session identity recovery returned invalid pagination.');
    }
    for (const candidate of sessionPage.items) {
      const candidateAgentId = normalize(candidate.agentId);
      const candidateProjectId = normalize(candidate.projectId);
      const candidateSessionId = normalize(candidate.sessionId);
      if (!candidateAgentId || !candidateSessionId || candidateProjectId !== projectId) {
        throw new Error(
          'Agents project Session identity recovery returned an invalid Session identity.',
        );
      }
      if (seenSessionIds.has(candidateSessionId)) {
        throw new Error(
          'Agents project Session identity recovery returned a duplicate Session identity.',
        );
      }
      seenSessionIds.add(candidateSessionId);
      if (candidateSessionId === agentSessionId) {
        return candidate;
      }
    }
    if (!sessionPage.pageInfo.hasMore) {
      return null;
    }
  }
  throw new Error('Agents project Session identity recovery exceeded its page budget.');
}

export function useSelectedAgentSessionItems({
  agentSessionService,
  isActive = true,
  onAgentSessionItemsLoadFailed,
  onAgentSessionItemsLoaded,
  onAgentSessionUnavailable,
  projectService,
  selectionRefreshToken,
  selectedAgentSession,
  selectedAgentSessionId,
  selectedProject,
  synchronizeProjectSessions,
}: UseSelectedAgentSessionItemsOptions): boolean {
  const { sessionRevision, user } = useAuth();
  const [foregroundLoadingState, setForegroundLoadingState] =
    useState<SelectedSessionItemsForegroundLoadingState>({
      isLoading: false,
      requestKey: '',
    });
  const foregroundLoadingStateRef = useRef(foregroundLoadingState);
  const [pollRevision, setPollRevision] = useState(0);
  const activeRequestKeyRef = useRef<string | null>(null);
  const onAgentSessionItemsLoadFailedRef = useRef(onAgentSessionItemsLoadFailed);
  const onAgentSessionItemsLoadedRef = useRef(onAgentSessionItemsLoaded);
  const onAgentSessionUnavailableRef = useRef(onAgentSessionUnavailable);
  const selectedAgentSessionRef = useRef(selectedAgentSession);
  const selectedProjectRef = useRef(selectedProject);
  const synchronizeProjectSessionsRef = useRef(synchronizeProjectSessions);
  foregroundLoadingStateRef.current = foregroundLoadingState;
  onAgentSessionItemsLoadFailedRef.current = onAgentSessionItemsLoadFailed;
  onAgentSessionItemsLoadedRef.current = onAgentSessionItemsLoaded;
  onAgentSessionUnavailableRef.current = onAgentSessionUnavailable;
  selectedAgentSessionRef.current = selectedAgentSession;
  selectedProjectRef.current = selectedProject;
  synchronizeProjectSessionsRef.current = synchronizeProjectSessions;
  const normalizedSessionId = normalize(selectedAgentSessionId);
  const normalizedAgentId = normalize(selectedAgentSession?.agentId);
  const userScope = buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision);
  const resolvedProjectId =
    normalize(selectedProject?.projectId) || normalize(selectedAgentSession?.projectId);
  const isExecuting = isAgentSessionViewExecuting(selectedAgentSession);
  const refreshScopeKey = useMemo(
    () =>
      normalizedSessionId && resolvedProjectId
        ? buildAgentSessionItemsRefreshScopeKey({
            agentId: normalizedAgentId || 'unresolved-agent',
            agentSessionId: normalizedSessionId,
            identityScope: userScope,
            projectId: resolvedProjectId,
          })
        : '',
    [normalizedAgentId, normalizedSessionId, resolvedProjectId, userScope],
  );

  const foregroundRequestKey = useMemo(
    () => [
      refreshScopeKey,
      selectionRefreshToken,
    ].join('\u0001'),
    [
      refreshScopeKey,
      selectionRefreshToken,
    ],
  );
  const requestKey = useMemo(
    () => [foregroundRequestKey, pollRevision].join('\u0001'),
    [foregroundRequestKey, pollRevision],
  );
  const isLoading = Boolean(
    isActive
    && normalizedSessionId
    && (
      foregroundLoadingState.requestKey !== foregroundRequestKey
      || foregroundLoadingState.isLoading
    )
  );

  useEffect(() => {
    if (!isActive || !normalizedSessionId) {
      return undefined;
    }
    const interval = window.setInterval(
      () => {
        if (
          activeRequestKeyRef.current === null
          && canRefreshSelectedSessionInBackground()
        ) {
          setPollRevision((revision) => revision + 1);
        }
      },
      isExecuting ? EXECUTING_REFRESH_INTERVAL_MS : IDLE_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [isActive, isExecuting, normalizedSessionId]);

  useEffect(() => {
    if (!isActive || !normalizedSessionId) {
      return undefined;
    }
    const refreshOnResume = () => {
      if (
        activeRequestKeyRef.current === null
        && canRefreshSelectedSessionInBackground()
      ) {
        setPollRevision((revision) => revision + 1);
      }
    };
    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);
    return () => {
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
    };
  }, [isActive, normalizedSessionId]);

  useEffect(() => {
    if (!isActive || !normalizedSessionId || activeRequestKeyRef.current === requestKey) {
      return undefined;
    }
    activeRequestKeyRef.current = requestKey;
    let disposed = false;
    const controller = new AbortController();
    const requestForegroundLoadingState = foregroundLoadingStateRef.current;
    const isForegroundRequest =
      requestForegroundLoadingState.requestKey !== foregroundRequestKey
      || requestForegroundLoadingState.isLoading;
    if (requestForegroundLoadingState.requestKey !== foregroundRequestKey) {
      const nextForegroundLoadingState = {
        isLoading: true,
        requestKey: foregroundRequestKey,
      };
      foregroundLoadingStateRef.current = nextForegroundLoadingState;
      setForegroundLoadingState(nextForegroundLoadingState);
    }
    const requestAgentSession = selectedAgentSessionRef.current;
    const requestProject = selectedProjectRef.current;
    const notifyLoadFailed = () => {
      if (!disposed) {
        notifySessionItemsObserver('load-failed', () => {
          onAgentSessionItemsLoadFailedRef.current?.(normalizedSessionId);
        });
      }
    };
    const notifyUnavailable = (projectId: string) => {
      if (!disposed) {
        notifySessionItemsObserver('unavailable', () => {
          onAgentSessionUnavailableRef.current?.(normalizedSessionId, projectId);
        });
      }
    };
    void (async () => {
      let authoritativeProject: AgentProjectView | undefined;
      let result = await refreshAgentSessionItems({
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
      });
      if (disposed) {
        return;
      }
      if (result.status === 'not-found') {
        const projectId = normalize(result.projectId) || normalize(requestProject?.projectId);
        if (!projectId) {
          notifyLoadFailed();
          return;
        }
        let synchronized: HydrateImportedProjectFromAuthorityResult | null;
        try {
          synchronized = await synchronizeProjectSessionsRef.current(projectId, true);
        } catch (error) {
          if (!disposed) {
            console.error('Failed to recover Agents session inventory', error);
            notifyLoadFailed();
          }
          return;
        }
        if (disposed || !synchronized) {
          notifyLoadFailed();
          return;
        }
        authoritativeProject = synchronized.project;
        if (authoritativeProject.projectId !== projectId) {
          notifyLoadFailed();
          return;
        }
        if (synchronized.deletedSessionIds.includes(normalizedSessionId)) {
          const removalResult = removeAgentSessionFromProjectsStore(
            buildProjectsStoreScopeKey(userScope, authoritativeProject.workspaceId),
            projectId,
            normalizedSessionId,
            normalize(requestAgentSession?.agentId) || undefined,
          );
          if (removalResult === 'removed' || removalResult === 'not-found') {
            notifyUnavailable(projectId);
          }
          return;
        }
        let authoritativeSession = authoritativeProject.agentSessions.find((candidate) => (
          normalize(candidate.id) === normalizedSessionId
          && normalize(candidate.projectId) === projectId
          && normalize(candidate.agentId) !== ''
        ));
        if (!authoritativeSession) {
          const recoveredSession = await findProjectSessionRecordById(
            agentSessionService,
            projectId,
            normalizedSessionId,
            controller.signal,
          );
          if (disposed) {
            return;
          }
          if (!recoveredSession) {
            const removalResult = removeAgentSessionFromProjectsStore(
              buildProjectsStoreScopeKey(userScope, authoritativeProject.workspaceId),
              projectId,
              normalizedSessionId,
              normalize(requestAgentSession?.agentId) || undefined,
            );
            if (removalResult === 'removed' || removalResult === 'not-found') {
              notifyUnavailable(projectId);
            }
            return;
          }
          authoritativeSession = requestAgentSession
            ? {
              ...requestAgentSession,
              agentId: recoveredSession.agentId,
              id: recoveredSession.sessionId,
              projectId,
            }
            : toAgentSessionView(recoveredSession, { projectId });
        }
        result = await refreshAgentSessionItems({
          agentSessionService,
          agentSessionId: normalizedSessionId,
          signal: controller.signal,
          resolvedLocation: {
            agentSession: authoritativeSession,
            project: authoritativeProject,
          },
        });
        if (!disposed && result.status === 'not-found') {
          const removalResult = removeAgentSessionFromProjectsStore(
            buildProjectsStoreScopeKey(userScope, authoritativeProject.workspaceId),
            projectId,
            normalizedSessionId,
            normalize(authoritativeSession.agentId) || undefined,
          );
          if (removalResult === 'removed' || removalResult === 'not-found') {
            notifyUnavailable(projectId);
          }
          return;
        }
      }
      if (disposed || result.status !== 'refreshed' || !result.agentSession) {
        if (!disposed && result.status === 'failed') {
          notifyLoadFailed();
        }
        return;
      }
      const latestSelectedProject = selectedProjectRef.current;
      const project =
        authoritativeProject?.projectId === result.projectId
          ? authoritativeProject
          : latestSelectedProject?.projectId === result.projectId
            ? latestSelectedProject
            : await projectService.getProjectById(result.projectId);
      if (disposed || !project) {
        notifyLoadFailed();
        return;
      }
      const storeScopeKey = buildProjectsStoreScopeKey(userScope, project.workspaceId);
      const currentAgentSession = peekProjectsStore(storeScopeKey)
        ?.snapshot.projects
        .find((candidateProject) => candidateProject.projectId === result.projectId)
        ?.agentSessions
        .find((candidateSession) => candidateSession.id === result.agentSessionId);
      const committedAgentSession = currentAgentSession
        ? mergeRefreshedAgentSessionIntoCurrent(
            currentAgentSession,
            result.agentSession,
            {
              replaceLoadedAuthorityWindow: result.replaceLoadedAuthorityWindow,
            },
          )
        : result.agentSession;
      upsertAgentSessionIntoProjectsStore(
        result.projectId,
        committedAgentSession,
        project.workspaceId,
        userScope,
        {
          itemMergeMode: result.replaceLoadedAuthorityWindow
            ? 'authority-window-reset'
            : 'latest',
          ...(authoritativeProject ? { projectMetadata: authoritativeProject } : {}),
        },
      );
      notifySessionItemsObserver('loaded', () => {
        onAgentSessionItemsLoadedRef.current?.(normalizedSessionId);
      });
    })()
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        console.error('Failed to load Agents session items', error);
        notifyLoadFailed();
      })
      .finally(() => {
        if (!disposed) {
          if (activeRequestKeyRef.current === requestKey) {
            activeRequestKeyRef.current = null;
          }
          if (isForegroundRequest) {
            const nextForegroundLoadingState = {
              isLoading: false,
              requestKey: foregroundRequestKey,
            };
            foregroundLoadingStateRef.current = nextForegroundLoadingState;
            setForegroundLoadingState(nextForegroundLoadingState);
          }
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
    foregroundRequestKey,
    isActive,
    normalizedSessionId,
    projectService,
    requestKey,
    userScope,
  ]);

  return isLoading;
}
