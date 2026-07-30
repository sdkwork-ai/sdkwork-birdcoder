import type { CSSProperties } from 'react';
import type { AgentSessionView, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentSessionInboxFilter,
  AgentSessionInboxGroupMode,
  AgentSessionInboxSortMode,
} from '@sdkwork/birdcoder-pc-workbench/workbench/sessionInbox';

export interface ProjectExplorerProjectEntry {
  canShowMoreSessions: boolean;
  canShowNewerSessions: boolean;
  filteredSessions: AgentSessionView[];
  isLoadingMoreSessions: boolean;
  nextVisibleSessionCount: number;
  project: AgentProjectView;
  visibleSessions: AgentSessionView[];
}

export function canLoadNewerProjectSessions(project: AgentProjectView): boolean {
  return project.agentSessionPageInfo?.hasNewer === true;
}

export function canLoadMoreProjectSessions(
  project: AgentProjectView,
  visibleSessionCount: number,
): boolean {
  return project.agentSessionPageInfo === undefined
    || visibleSessionCount < project.agentSessions.length
    || project.agentSessionPageInfo?.hasMore === true;
}

export type ProjectExplorerOrganizeBy = AgentSessionInboxGroupMode;
export type ProjectExplorerSessionFilter = AgentSessionInboxFilter;
export type ProjectExplorerSortBy = AgentSessionInboxSortMode;

export interface ProjectExplorerEngineOption {
  id: string;
  label: string;
  modelId?: string | null;
  terminalProfileId?: string | null;
}

export interface ProjectExplorerMenuPosition {
  x: number;
  y: number;
}

export function buildProjectExplorerSurfaceStyle(containIntrinsicSize: string): CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}
