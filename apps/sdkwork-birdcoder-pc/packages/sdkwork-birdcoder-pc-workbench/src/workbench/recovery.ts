import type {
  AppTab,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const WORKBENCH_RECOVERY_TABS = new Set<AppTab>([
  'code',
  'studio',
  'terminal',
  'settings',
  'auth',
  'user',
  'vip',
]);

export interface WorkbenchRecoverySnapshot {
  version: 3;
  userScope: string;
  sessionId: string;
  activeTab: AppTab;
  activeProjectId: string;
  activeAgentSessionId: string;
  updatedAt: string;
  cleanExit: boolean;
}

type RecoveryProject = Pick<AgentProjectView, 'projectId'> & {
  agentSessions?: ReadonlyArray<Pick<AgentSessionView, 'id'>>;
};

export interface ResolveStartupProjectIdOptions {
  projects: ReadonlyArray<RecoveryProject>;
  recoverySnapshot: WorkbenchRecoverySnapshot;
}

export interface ResolveStartupAgentSessionIdOptions {
  projectId: string;
  projects: ReadonlyArray<
    Pick<AgentProjectView, 'projectId'> & {
      agentSessions: ReadonlyArray<Pick<AgentSessionView, 'id'>>;
    }
  >;
  recoverySnapshot: WorkbenchRecoverySnapshot;
}

export interface BuildWorkbenchRecoveryAnnouncementOptions {
  recoverySnapshot: WorkbenchRecoverySnapshot;
  activeProjectId: string;
  activeAgentSessionId: string;
}

export interface ResolveWorkbenchRecoveryPersistenceSelectionOptions {
  currentProjectId: string | null | undefined;
  currentAgentSessionId: string | null | undefined;
  fallbackSnapshot?:
    | Pick<WorkbenchRecoverySnapshot, 'activeProjectId' | 'activeAgentSessionId'>
    | null
    | undefined;
  hasProjectsFetched: boolean;
}

const ZERO_TIMESTAMP = new Date(0).toISOString();
const ANONYMOUS_WORKBENCH_RECOVERY_USER_SCOPE = 'anonymous';

export const DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT: WorkbenchRecoverySnapshot = {
  version: 3,
  userScope: ANONYMOUS_WORKBENCH_RECOVERY_USER_SCOPE,
  sessionId: '',
  activeTab: 'code',
  activeProjectId: '',
  activeAgentSessionId: '',
  updatedAt: ZERO_TIMESTAMP,
  cleanExit: true,
};

function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeWorkbenchRecoveryUserScope(value: unknown): string {
  return normalizeIdentifier(value) || ANONYMOUS_WORKBENCH_RECOVERY_USER_SCOPE;
}

function normalizeActiveTab(value: unknown): AppTab {
  return typeof value === 'string' && WORKBENCH_RECOVERY_TABS.has(value as AppTab)
    ? (value as AppTab)
    : 'code';
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return ZERO_TIMESTAMP;
  }
  return value;
}

function hasProjectId(projects: ReadonlyArray<RecoveryProject>, projectId: string): boolean {
  return projects.some((project) => project.projectId === projectId);
}

function hasAgentSessionId(
  agentSessions: ReadonlyArray<Pick<AgentSessionView, 'id'>>,
  agentSessionId: string,
): boolean {
  return agentSessions.some((agentSession) => agentSession.id === agentSessionId);
}

function findUniqueProjectByAgentSessionId(
  projects: ReadonlyArray<RecoveryProject>,
  agentSessionId: string,
): RecoveryProject | null {
  let matchedProject: RecoveryProject | null = null;
  for (const project of projects) {
    if (!hasAgentSessionId(project.agentSessions ?? [], agentSessionId)) {
      continue;
    }
    if (matchedProject) {
      return null;
    }
    matchedProject = project;
  }
  return matchedProject;
}

export function normalizeWorkbenchRecoverySnapshot(value: unknown): WorkbenchRecoverySnapshot {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT };
  }
  const snapshot = value as Partial<WorkbenchRecoverySnapshot>;
  return {
    version: 3,
    userScope: normalizeWorkbenchRecoveryUserScope(snapshot.userScope),
    sessionId: normalizeIdentifier(snapshot.sessionId),
    activeTab: normalizeActiveTab(snapshot.activeTab),
    activeProjectId: normalizeIdentifier(snapshot.activeProjectId),
    activeAgentSessionId: normalizeIdentifier(snapshot.activeAgentSessionId),
    updatedAt: normalizeTimestamp(snapshot.updatedAt),
    cleanExit: snapshot.cleanExit !== false,
  };
}

export function buildWorkbenchRecoverySnapshot(
  value: Partial<WorkbenchRecoverySnapshot>,
): WorkbenchRecoverySnapshot {
  return normalizeWorkbenchRecoverySnapshot({
    ...DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    ...value,
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  });
}

export function resolveWorkbenchRecoverySnapshotForUser(
  recoverySnapshot: WorkbenchRecoverySnapshot,
  userScope: string | null | undefined,
): WorkbenchRecoverySnapshot {
  const normalizedUserScope = normalizeWorkbenchRecoveryUserScope(userScope);
  const normalizedRecoverySnapshot = normalizeWorkbenchRecoverySnapshot(recoverySnapshot);
  if (normalizedRecoverySnapshot.userScope === normalizedUserScope) {
    return normalizedRecoverySnapshot;
  }
  return {
    ...DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    userScope: normalizedUserScope,
  };
}

export function resolveWorkbenchRecoveryPersistenceSelection(
  options: ResolveWorkbenchRecoveryPersistenceSelectionOptions,
): Pick<WorkbenchRecoverySnapshot, 'activeProjectId' | 'activeAgentSessionId'> {
  const currentProjectId = normalizeIdentifier(options.currentProjectId);
  const currentAgentSessionId = normalizeIdentifier(options.currentAgentSessionId);
  return {
    activeProjectId: options.hasProjectsFetched
      ? currentProjectId
      : normalizeIdentifier(options.fallbackSnapshot?.activeProjectId),
    activeAgentSessionId: options.hasProjectsFetched
      ? currentAgentSessionId
      : normalizeIdentifier(options.fallbackSnapshot?.activeAgentSessionId),
  };
}

export function isWorkbenchRecoverySelectionResolutionReady(
  options: Pick<ResolveWorkbenchRecoveryPersistenceSelectionOptions, 'hasProjectsFetched'>,
): boolean {
  return options.hasProjectsFetched;
}

export function resolveStartupProjectId(options: ResolveStartupProjectIdOptions): string {
  const recoveryProjectId = options.recoverySnapshot.activeProjectId;
  if (recoveryProjectId && hasProjectId(options.projects, recoveryProjectId)) {
    return recoveryProjectId;
  }
  const recoveryAgentSessionId = options.recoverySnapshot.activeAgentSessionId;
  if (recoveryAgentSessionId) {
    const recoveredProject = findUniqueProjectByAgentSessionId(
      options.projects,
      recoveryAgentSessionId,
    );
    if (recoveredProject) {
      return recoveredProject.projectId;
    }
  }
  return options.projects[0]?.projectId ?? '';
}

export function resolveStartupAgentSessionId(
  options: ResolveStartupAgentSessionIdOptions,
): string {
  const scopedAgentSessions = options.projects.find(
    (project) => project.projectId === options.projectId,
  )?.agentSessions ?? [];
  const recoveryAgentSessionId = options.recoverySnapshot.activeAgentSessionId;
  if (recoveryAgentSessionId && hasAgentSessionId(scopedAgentSessions, recoveryAgentSessionId)) {
    return recoveryAgentSessionId;
  }
  return scopedAgentSessions[0]?.id ?? '';
}

export function buildWorkbenchRecoveryAnnouncement(
  options: BuildWorkbenchRecoveryAnnouncementOptions,
): string | null {
  if (options.recoverySnapshot.cleanExit) {
    return null;
  }
  if (normalizeIdentifier(options.activeAgentSessionId)) {
    return 'Recovered previous coding session after the last unexpected shutdown.';
  }
  if (normalizeIdentifier(options.activeProjectId)) {
    return 'Recovered previous project after the last unexpected shutdown.';
  }
  return null;
}

export function recoverySnapshotsEqual(
  left: WorkbenchRecoverySnapshot,
  right: WorkbenchRecoverySnapshot,
): boolean {
  return (
    left.userScope === right.userScope
    && left.sessionId === right.sessionId
    && left.activeTab === right.activeTab
    && left.activeProjectId === right.activeProjectId
    && left.activeAgentSessionId === right.activeAgentSessionId
    && left.cleanExit === right.cleanExit
  );
}
