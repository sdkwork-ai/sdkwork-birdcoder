import {
  resolveAgentSessionViewSortTimestamp,
  type AgentProjectView,
  type AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export const DEFAULT_TASK_SEARCH_RESULT_LIMIT = 9;

export interface TaskSearchEntry {
  projectId: string;
  projectName: string;
  session: AgentSessionView;
}

interface RankedTaskSearchEntry extends TaskSearchEntry {
  matchRank: number;
}

function normalizeTaskSearchValue(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function resolveTaskSearchMatchRank(
  session: AgentSessionView,
  projectName: string,
  normalizedQuery: string,
): number | null {
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedTitle = normalizeTaskSearchValue(session.title);
  const normalizedProjectName = normalizeTaskSearchValue(projectName);
  const searchableText = [
    normalizedTitle,
    normalizedProjectName,
    normalizeTaskSearchValue(session.agentId),
    normalizeTaskSearchValue(session.engineId),
    normalizeTaskSearchValue(session.providerId),
    normalizeTaskSearchValue(session.providerBindingId),
    normalizeTaskSearchValue(session.modelId),
    normalizeTaskSearchValue(session.providerSessionId),
    normalizeTaskSearchValue(session.id),
  ].join('\u0000');
  const queryTokens = normalizedQuery.split(/\s+/u).filter(Boolean);

  if (!queryTokens.every((token) => searchableText.includes(token))) {
    return null;
  }
  if (normalizedTitle === normalizedQuery) {
    return 0;
  }
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 1;
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    return 2;
  }
  if (normalizedProjectName.startsWith(normalizedQuery)) {
    return 3;
  }
  if (normalizedProjectName.includes(normalizedQuery)) {
    return 4;
  }
  return 5;
}

export function buildTaskSearchEntries(
  projects: readonly AgentProjectView[],
  query: string,
  limit = DEFAULT_TASK_SEARCH_RESULT_LIMIT,
): TaskSearchEntry[] {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (normalizedLimit === 0) {
    return [];
  }

  const normalizedQuery = normalizeTaskSearchValue(query);
  const seenSessionKeys = new Set<string>();
  const entries: RankedTaskSearchEntry[] = [];

  for (const project of projects) {
    for (const session of project.agentSessions) {
      const sessionKey = `${project.projectId}\u0001${session.id}`;
      if (seenSessionKeys.has(sessionKey)) {
        continue;
      }
      seenSessionKeys.add(sessionKey);

      const matchRank = resolveTaskSearchMatchRank(
        session,
        project.name,
        normalizedQuery,
      );
      if (matchRank === null) {
        continue;
      }

      entries.push({
        matchRank,
        projectId: project.projectId,
        projectName: project.name,
        session,
      });
    }
  }

  entries.sort((left, right) => {
    if (left.matchRank !== right.matchRank) {
      return left.matchRank - right.matchRank;
    }

    const activityDifference =
      resolveAgentSessionViewSortTimestamp(right.session) -
      resolveAgentSessionViewSortTimestamp(left.session);
    if (activityDifference !== 0) {
      return activityDifference;
    }

    return left.session.title.localeCompare(right.session.title);
  });

  return entries.slice(0, normalizedLimit).map(({ matchRank: _matchRank, ...entry }) => entry);
}
