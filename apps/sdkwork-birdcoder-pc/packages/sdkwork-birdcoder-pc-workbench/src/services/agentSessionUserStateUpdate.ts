import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentSessionIdentity,
  IAgentSessionService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export interface AgentSessionUserStateUpdate {
  archived?: boolean;
  pinned?: boolean;
  status?: AgentSessionView['status'];
  unread?: boolean;
}

type AgentSessionUserStateUpdateRequest = Parameters<
  IAgentSessionService['updateSessionUserState']
>[1];

function buildAgentSessionUserStateUpdateRequest(
  session: Pick<AgentSessionView, 'lastItemSequence'>,
  updates: AgentSessionUserStateUpdate,
  expectedVersion?: string,
): AgentSessionUserStateUpdateRequest {
  const request: AgentSessionUserStateUpdateRequest = {};

  if (expectedVersion !== undefined) {
    request.expectedVersion = expectedVersion;
  }
  if (updates.archived !== undefined) {
    request.hidden = updates.archived;
  } else if (updates.status === 'archived') {
    request.hidden = true;
  }
  if (updates.pinned !== undefined) {
    request.pinned = updates.pinned;
  }
  if (updates.unread !== undefined) {
    request.markOpened = updates.unread === false ? true : undefined;
    request.lastReadItemSequence = updates.unread ? '0' : session.lastItemSequence;
  }

  return request;
}

export async function updateAgentSessionUserState(
  agentSessionService: IAgentSessionService,
  identity: AgentSessionIdentity,
  session: Pick<AgentSessionView, 'lastItemSequence'>,
  updates: AgentSessionUserStateUpdate,
) {
  const userStates = await agentSessionService.getSessionUserStates([identity]);
  const currentUserState = userStates.get(identity.sessionId.trim());
  return agentSessionService.updateSessionUserState(
    identity,
    buildAgentSessionUserStateUpdateRequest(
      session,
      updates,
      currentUserState?.version,
    ),
  );
}
