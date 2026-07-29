import { useCallback } from 'react';
import type {
  AgentSessionIdentity,
  IAgentSessionService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { useIDEServices } from '../context/IDEContext.ts';

const PROJECT_TERMINAL_SESSION_PAGE_SIZE = 20;

type ProjectAgentSessionRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionsByProject']>
>['items'][number];

export interface ProjectTerminalRuntimeLocationRequest {
  agentId?: string | null;
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

  const requestedAgentId = request.agentId?.trim() ?? '';
  const requestedSessionId = request.agentSessionId?.trim() ?? '';
  let identity: AgentSessionIdentity | null = null;
  if (requestedSessionId) {
    if (!requestedAgentId) {
      throw new Error('Agent ID is required to resolve a selected Session runtime location.');
    }
    identity = {
      agentId: requestedAgentId,
      sessionId: requestedSessionId,
    };
  } else {
    const sessionPage = await agentSessionService.listSessionsByProject({
      page: 1,
      pageSize: PROJECT_TERMINAL_SESSION_PAGE_SIZE,
      projectId,
      status: 'active',
    }, { signal: request.signal });
    const latestSession = resolveLatestProjectAgentSession(
      sessionPage.items,
      projectId,
    );
    if (latestSession) {
      identity = {
        agentId: latestSession.agentId,
        sessionId: latestSession.sessionId,
      };
    }
  }
  if (!identity) {
    return null;
  }

  const runtimeBindingPage = await agentSessionService.listRuntimeBindings(
    identity,
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
