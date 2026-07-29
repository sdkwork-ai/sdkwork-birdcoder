import {
  compareAgentSessionViewSortTimestamps,
  isAgentSessionViewExecuting,
  type AgentProjectView,
  type AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const RUNNING_SESSION_LIMIT = 3;
const PINNED_SESSION_LIMIT = 5;
const RECENT_SESSION_LIMIT = 3;
const MORE_SESSION_LIMIT = 50;

export interface DesktopTraySessionMenuLabels {
  exit: string;
  more: string;
  newChat: string;
  openApplication: string;
  pinned: string;
  recent: string;
  running: string;
  untitledSession: string;
}

export interface DesktopTraySessionMenuEntry {
  projectId: string;
  projectName: string;
  sessionId: string;
  title: string;
}

export interface DesktopTraySessionMenuSnapshot {
  labels: DesktopTraySessionMenuLabels;
  more: DesktopTraySessionMenuEntry[];
  newChatEnabled: boolean;
  pinned: DesktopTraySessionMenuEntry[];
  recent: DesktopTraySessionMenuEntry[];
  running: DesktopTraySessionMenuEntry[];
}

export type DesktopTrayAction =
  | { type: 'newChat' }
  | { type: 'openSession'; projectId: string; sessionId: string };

interface SessionLocation {
  project: AgentProjectView;
  session: AgentSessionView;
}

function sessionLocationKey(location: SessionLocation): string {
  return `${location.project.projectId}\u0001${location.session.id}`;
}

function compareSessionLocationsByActivity(
  left: SessionLocation,
  right: SessionLocation,
): number {
  return (
    compareAgentSessionViewSortTimestamps(right.session, left.session)
    || left.project.name.localeCompare(right.project.name)
    || left.session.title.localeCompare(right.session.title)
    || left.session.id.localeCompare(right.session.id)
  );
}

function toMenuEntry(
  location: SessionLocation,
  labels: DesktopTraySessionMenuLabels,
): DesktopTraySessionMenuEntry {
  return {
    projectId: location.project.projectId,
    projectName: location.project.name,
    sessionId: location.session.id,
    title: location.session.title.trim() || labels.untitledSession,
  };
}

export function buildDesktopTraySessionMenuSnapshot({
  labels,
  newChatEnabled,
  projects,
}: {
  labels: DesktopTraySessionMenuLabels;
  newChatEnabled: boolean;
  projects: readonly AgentProjectView[];
}): DesktopTraySessionMenuSnapshot {
  const locations = projects
    .flatMap((project) => project.agentSessions.map((session) => ({ project, session })))
    .filter(({ project, session }) => (
      project.status === 'active'
      && project.projectId.trim().length > 0
      && session.id.trim().length > 0
      && session.status !== 'archived'
      && session.archived !== true
    ))
    .sort(compareSessionLocationsByActivity);

  const runningLocations = locations
    .filter(({ session }) => isAgentSessionViewExecuting(session))
    .slice(0, RUNNING_SESSION_LIMIT);
  const pinnedLocations = locations
    .filter(({ session }) => session.pinned === true)
    .slice(0, PINNED_SESSION_LIMIT);
  const recentLocations = locations.slice(0, RECENT_SESSION_LIMIT);
  const highlightedLocationKeys = new Set(
    [...runningLocations, ...pinnedLocations, ...recentLocations].map(sessionLocationKey),
  );
  const moreLocations = locations
    .filter((location) => !highlightedLocationKeys.has(sessionLocationKey(location)))
    .slice(0, MORE_SESSION_LIMIT);

  return {
    labels,
    more: moreLocations.map((location) => toMenuEntry(location, labels)),
    newChatEnabled,
    pinned: pinnedLocations.map((location) => toMenuEntry(location, labels)),
    recent: recentLocations.map((location) => toMenuEntry(location, labels)),
    running: runningLocations.map((location) => toMenuEntry(location, labels)),
  };
}

export function parseDesktopTrayAction(value: unknown): DesktopTrayAction | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'newChat') {
    return { type: 'newChat' };
  }
  if (
    candidate.type === 'openSession'
    && typeof candidate.projectId === 'string'
    && candidate.projectId.trim()
    && typeof candidate.sessionId === 'string'
    && candidate.sessionId.trim()
  ) {
    return {
      projectId: candidate.projectId.trim(),
      sessionId: candidate.sessionId.trim(),
      type: 'openSession',
    };
  }
  return null;
}
