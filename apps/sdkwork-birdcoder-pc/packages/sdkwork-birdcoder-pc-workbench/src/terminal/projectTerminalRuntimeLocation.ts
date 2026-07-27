import { useCallback } from 'react';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { useIDEServices } from '../context/IDEContext.ts';

const PROJECT_TERMINAL_SESSION_PAGE_SIZE = 20;

type ProjectAgentSessionRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionsByProject']>
>['items'][number];

export interface ProjectTerminalRuntimeLocationRequest {
  agentSessionId?: string | null;
  projectId: string;
  signal?: AbortSignal;
}

function resolveAgentSessionActivityTimestamp(session: ProjectAgentSessionRecord): number {
  const timestamp = Date.parse(session.lastItemAt ?? session.updatedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveLatestProjectAgentSession(
  sessions: readonly ProjectAgentSessionRecord[],
  projectId: string,
): ProjectAgentSessionRecord | null {
  let latestSession: ProjectAgentSessionRecord | null = null;
  for (const session of sessions) {
    if (session.projectId?.trim() !== projectId || session.status !== 'active') {
      continue;
    }
    if (!latestSession) {
      latestSession = session;
      continue;
    }
    const timestampDifference =
      resolveAgentSessionActivityTimestamp(session)
      - resolveAgentSessionActivityTimestamp(latestSession);
    if (
      timestampDifference > 0
      || (timestampDifference === 0 && session.sessionId.localeCompare(latestSession.sessionId) < 0)
    ) {
      latestSession = session;
    }
  }
  return latestSession;
}

export async function resolveProjectTerminalRuntimeLocationId(
  agentSessionService: IAgentSessionService,
  request: ProjectTerminalRuntimeLocationRequest,
): Promise<string | null> {
  const projectId = request.projectId.trim();
  if (!projectId) {
    return null;
  }

  let agentSessionId = request.agentSessionId?.trim() ?? '';
  if (!agentSessionId) {
    const sessionPage = await agentSessionService.listSessionsByProject({
      page: 1,
      pageSize: PROJECT_TERMINAL_SESSION_PAGE_SIZE,
      projectId,
      status: 'active',
    }, { signal: request.signal });
    agentSessionId = resolveLatestProjectAgentSession(
      sessionPage.items,
      projectId,
    )?.sessionId ?? '';
  }
  if (!agentSessionId) {
    return null;
  }

  const runtimeBindingPage = await agentSessionService.listRuntimeBindings(
    agentSessionId,
    { page: 1, pageSize: 20 },
    { signal: request.signal },
  );
  const currentBinding = runtimeBindingPage.items.find((binding) =>
    binding.isCurrent
    && binding.status === 'active'
    && Boolean(binding.runtimeLocationId?.trim()));
  return currentBinding?.runtimeLocationId?.trim() || null;
}

export function useProjectTerminalRuntimeLocationIdResolver(): (
  request: ProjectTerminalRuntimeLocationRequest,
) => Promise<string | null> {
  const { agentSessionService } = useIDEServices();
  return useCallback(
    (request) => resolveProjectTerminalRuntimeLocationId(agentSessionService, request),
    [agentSessionService],
  );
}
