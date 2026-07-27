import type { AgentProjectView, AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  loadAgentSessionView,
  mergeAgentSessionRecordIntoView,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';
import {
  updateAgentSessionInCollection,
  upsertAgentSessionIntoCollection,
} from '../stores/projectsStore.ts';

const WORKSPACE_SESSION_INBOX_PAGE_SIZE = 20;
const NEW_SESSION_HYDRATION_CONCURRENCY = 4;
export const WORKSPACE_SESSION_INBOX_REFRESH_INTERVAL_MS = 15_000;
export const WORKSPACE_SESSION_INBOX_MAX_RETRY_INTERVAL_MS = 120_000;

export function resolveWorkspaceSessionInboxRefreshDelay(
  consecutiveFailures: number,
): number {
  const normalizedFailures = Math.max(0, Math.trunc(consecutiveFailures));
  return Math.min(
    WORKSPACE_SESSION_INBOX_MAX_RETRY_INTERVAL_MS,
    WORKSPACE_SESSION_INBOX_REFRESH_INTERVAL_MS * (2 ** normalizedFailures),
  );
}

export function canSynchronizeWorkspaceSessionInbox(
  visibilityState: DocumentVisibilityState,
  isOnline: boolean,
): boolean {
  return visibilityState !== 'hidden' && isOnline;
}

export interface WorkspaceSessionInboxUpdate {
  hydratedSessions: ReadonlyMap<string, AgentSessionView>;
  records: readonly AgentSessionRecord[];
}

function buildScopedSessionKey(projectId: string, sessionId: string): string {
  return `${projectId}\u0001${sessionId}`;
}

function normalizeWorkspaceSessionRecords(
  records: readonly AgentSessionRecord[],
): AgentSessionRecord[] {
  const recordsByKey = new Map<string, AgentSessionRecord>();
  for (const record of records) {
    recordsByKey.set(
      buildScopedSessionKey(record.projectId?.trim() ?? '', record.sessionId),
      record,
    );
  }
  return [...recordsByKey.values()];
}

function findSession(
  projects: readonly AgentProjectView[],
  projectId: string,
  sessionId: string,
): AgentSessionView | null {
  return projects
    .find((project) => project.projectId === projectId)
    ?.agentSessions.find((session) => session.id === sessionId) ?? null;
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  worker: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output = new Array<TOutput>(inputs.length);
  let cursor = 0;
  await Promise.all(Array.from(
    { length: Math.min(inputs.length, concurrency) },
    async () => {
      while (cursor < inputs.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(inputs[index]!);
      }
    },
  ));
  return output;
}

export async function loadWorkspaceSessionInboxUpdate(
  agentSessionService: IAgentSessionService,
  workspaceId: string,
  projects: readonly AgentProjectView[],
  signal?: AbortSignal,
): Promise<WorkspaceSessionInboxUpdate> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return { hydratedSessions: new Map(), records: [] };
  }
  const page = await agentSessionService.listSessionsByWorkspace({
    workspaceId: normalizedWorkspaceId,
    page: 1,
    pageSize: WORKSPACE_SESSION_INBOX_PAGE_SIZE,
  }, { signal });
  signal?.throwIfAborted();
  const returnedPage = page.pageInfo.page ?? 1;
  const returnedPageSize = page.pageInfo.pageSize ?? WORKSPACE_SESSION_INBOX_PAGE_SIZE;
  if (
    page.pageInfo.mode !== 'offset'
    || returnedPage !== 1
    || !Number.isSafeInteger(returnedPageSize)
    || returnedPageSize < 1
    || returnedPageSize > 200
    || page.items.length > returnedPageSize
  ) {
    throw new Error('Agents Workspace Session Inbox returned invalid pagination metadata.');
  }
  if (page.items.length === 0 && page.pageInfo.hasMore) {
    throw new Error('Agents Workspace Session Inbox returned an empty page with hasMore=true.');
  }

  const records = normalizeWorkspaceSessionRecords(page.items);
  const loadedProjectIds = new Set(projects.map((project) => project.projectId));
  const newRecords = records.filter((record) => {
    const projectId = record.projectId?.trim() ?? '';
    return projectId
      && loadedProjectIds.has(projectId)
      && !findSession(projects, projectId, record.sessionId);
  });
  const hydrated = await mapWithConcurrency(
    newRecords,
    NEW_SESSION_HYDRATION_CONCURRENCY,
    async (record) => {
      signal?.throwIfAborted();
      return loadAgentSessionView(
        agentSessionService,
        record,
        record.projectId!.trim(),
        [],
        undefined,
        signal,
      );
    },
  );

  return {
    hydratedSessions: new Map(hydrated.map((session) => [
      buildScopedSessionKey(session.projectId, session.id),
      session,
    ])),
    records,
  };
}

export function applyWorkspaceSessionInboxUpdate(
  projects: readonly AgentProjectView[],
  update: WorkspaceSessionInboxUpdate,
): AgentProjectView[] {
  let nextProjects = projects as AgentProjectView[];
  for (const record of update.records) {
    const projectId = record.projectId?.trim() ?? '';
    if (!projectId || !nextProjects.some((project) => project.projectId === projectId)) {
      continue;
    }
    const existing = findSession(nextProjects, projectId, record.sessionId);
    if (!existing) {
      const hydrated = update.hydratedSessions.get(
        buildScopedSessionKey(projectId, record.sessionId),
      );
      if (hydrated) {
        nextProjects = upsertAgentSessionIntoCollection(nextProjects, projectId, hydrated);
      }
      continue;
    }
    if (existing.serverVersion === record.version) {
      continue;
    }
    nextProjects = updateAgentSessionInCollection(
      nextProjects,
      projectId,
      record.sessionId,
      (session) => mergeAgentSessionRecordIntoView(session, record),
    );
  }
  return nextProjects;
}
