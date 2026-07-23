import type {
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { mergeProjectsForStore } from '../stores/projectsStore.ts';

function hasDuplicateIdentity<TValue>(
  values: readonly TValue[],
  getIdentity: (value: TValue) => string,
): boolean {
  if (values.length < 2) {
    return false;
  }

  const seenIdentities = new Set<string>();
  for (const value of values) {
    const identity = getIdentity(value);
    if (seenIdentities.has(identity)) {
      return true;
    }
    seenIdentities.add(identity);
  }

  return false;
}

function hasDuplicateProjectRenderIdentity(
  projects: readonly AgentProjectView[],
): boolean {
  if (hasDuplicateIdentity(projects, (project) => project.projectId)) {
    return true;
  }

  return projects.some((project) =>
    hasDuplicateIdentity(project.agentSessions, (agentSession) => agentSession.id),
  );
}

function buildAgentSessionRenderIdentity(agentSession: AgentSessionView): string {
  return agentSession.id;
}

export function deduplicateAgentProjectsForRender(
  projects: readonly AgentProjectView[],
): AgentProjectView[] {
  if (!hasDuplicateProjectRenderIdentity(projects)) {
    return projects as AgentProjectView[];
  }

  return mergeProjectsForStore(projects, projects);
}

export function deduplicateAgentSessionsForRender(
  agentSessions: readonly AgentSessionView[],
): AgentSessionView[] {
  if (!hasDuplicateIdentity(agentSessions, buildAgentSessionRenderIdentity)) {
    return agentSessions as AgentSessionView[];
  }

  const agentSessionsById = new Map<string, AgentSessionView>();
  for (const agentSession of agentSessions) {
    const identity = buildAgentSessionRenderIdentity(agentSession);
    const previousAgentSession = agentSessionsById.get(identity);
    if (!previousAgentSession) {
      agentSessionsById.set(identity, agentSession);
      continue;
    }

    agentSessionsById.set(
      identity,
      agentSession.items.length === 0 && previousAgentSession.items.length > 0
        ? { ...agentSession, items: previousAgentSession.items }
        : agentSession,
    );
  }
  return Array.from(agentSessionsById.values());
}
