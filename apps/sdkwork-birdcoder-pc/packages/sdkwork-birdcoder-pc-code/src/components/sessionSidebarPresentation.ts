import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { sortAgentSessionInboxEntries } from '@sdkwork/birdcoder-pc-workbench/workbench/sessionInbox';
import { deduplicateAgentSessionsForRender } from '@sdkwork/birdcoder-pc-workbench/workbench/projectInventoryRender';
import type { ProjectExplorerSortBy } from './ProjectExplorer.shared';

export interface BuildSidebarGlobalSessionsOptions {
  matches: (session: AgentSessionView, project: AgentProjectView) => boolean;
  projects: readonly AgentProjectView[];
  showArchived: boolean;
  sortBy: ProjectExplorerSortBy;
}

export function buildSidebarGlobalSessions({
  matches,
  projects,
  showArchived,
  sortBy,
}: BuildSidebarGlobalSessionsOptions): AgentSessionView[] {
  const candidates: AgentSessionView[] = [];
  for (const project of projects) {
    if (!showArchived && project.status === 'archived') {
      continue;
    }
    for (const session of project.agentSessions) {
      if (session.projectId !== project.projectId) {
        throw new Error(
          `Agent session ${session.id} does not belong to BirdCoder project ${project.projectId}.`,
        );
      }
      if (!showArchived && session.archived) {
        continue;
      }
      if (matches(session, project)) {
        candidates.push(session);
      }
    }
  }
  return sortAgentSessionInboxEntries(
    deduplicateAgentSessionsForRender(candidates),
    sortBy,
  );
}

export function canRequestMoreSidebarProjectSessions(project: AgentProjectView): boolean {
  return project.agentSessionPageInfo?.hasMore ?? true;
}
