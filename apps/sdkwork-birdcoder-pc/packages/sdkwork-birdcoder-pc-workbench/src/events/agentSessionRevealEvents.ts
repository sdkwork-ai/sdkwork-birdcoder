import { globalEventBus } from '../utils/EventBus.ts';

export const REVEAL_AGENT_SESSION_EVENT = 'revealAgentSession';

export interface AgentSessionRevealTarget {
  projectId: string;
  sessionId: string;
}

function normalizeAgentSessionRevealTarget(
  target: AgentSessionRevealTarget,
): AgentSessionRevealTarget | null {
  const projectId = target.projectId.trim();
  const sessionId = target.sessionId.trim();
  return projectId && sessionId ? { projectId, sessionId } : null;
}

export function emitRevealAgentSession(target: AgentSessionRevealTarget): boolean {
  const normalizedTarget = normalizeAgentSessionRevealTarget(target);
  if (!normalizedTarget) {
    return false;
  }

  globalEventBus.emit(REVEAL_AGENT_SESSION_EVENT, normalizedTarget);
  return true;
}

export function subscribeRevealAgentSession(
  callback: (target: AgentSessionRevealTarget) => void,
): () => void {
  return globalEventBus.on(REVEAL_AGENT_SESSION_EVENT, callback);
}
