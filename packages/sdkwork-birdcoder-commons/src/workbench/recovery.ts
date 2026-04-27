import type {
  AppTab,
  BirdCoderCodingSession,
  BirdCoderProject,
  IWorkspace,
} from '@sdkwork/birdcoder-types';

const WORKBENCH_RECOVERY_TABS = new Set<AppTab>([
  'code',
  'studio',
  'terminal',
  'settings',
  'auth',
  'user',
  'vip',
  'skills',
  'templates',
]);

export interface WorkbenchRecoverySnapshot {
  version: 2;
  userScope: string;
  sessionId: string;
  activeTab: AppTab;
  activeWorkspaceId: string;
  activeProjectId: string;
  activeCodingSessionId: string;
  updatedAt: string;
  cleanExit: boolean;
}

export interface ResolveStartupWorkspaceIdOptions {
  workspaces: ReadonlyArray<Pick<IWorkspace, 'id'>>;
  recoverySnapshot: WorkbenchRecoverySnapshot;
}

export interface ResolveStartupProjectIdOptions {
  workspaceId: string;
  projects: ReadonlyArray<
    Pick<BirdCoderProject, 'id' | 'workspaceId'> & {
      codingSessions?: ReadonlyArray<Pick<BirdCoderCodingSession, 'id'>>;
    }
  >;
  recoverySnapshot: WorkbenchRecoverySnapshot;
}

export interface ResolveStartupCodingSessionIdOptions {
  projectId: string;
  projects: ReadonlyArray<
    Pick<BirdCoderProject, 'id'> & {
      codingSessions: ReadonlyArray<Pick<BirdCoderCodingSession, 'id'>>;
    }
  >;
  recoverySnapshot: WorkbenchRecoverySnapshot;
}

export interface BuildWorkbenchRecoveryAnnouncementOptions {
  recoverySnapshot: WorkbenchRecoverySnapshot;
  activeWorkspaceId: string;
  activeProjectId: string;
  activeCodingSessionId: string;
}

export interface ResolveWorkbenchRecoveryPersistenceSelectionOptions {
  currentWorkspaceId: string | null | undefined;
  currentProjectId: string | null | undefined;
  currentCodingSessionId: string | null | undefined;
  fallbackSnapshot?:
    | Pick<
        WorkbenchRecoverySnapshot,
        'activeWorkspaceId' | 'activeProjectId' | 'activeCodingSessionId'
      >
    | null
    | undefined;
  hasProjectsFetched: boolean;
  hasWorkspacesFetched: boolean;
}

const ZERO_TIMESTAMP = new Date(0).toISOString();
const ANONYMOUS_WORKBENCH_RECOVERY_USER_SCOPE = 'anonymous';

export const DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT: WorkbenchRecoverySnapshot = {
  version: 2,
  userScope: ANONYMOUS_WORKBENCH_RECOVERY_USER_SCOPE,
  sessionId: '',
  activeTab: 'code',
  activeWorkspaceId: '',
  activeProjectId: '',
  activeCodingSessionId: '',
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

function hasWorkspaceId(
  workspaces: ReadonlyArray<Pick<IWorkspace, 'id'>>,
  workspaceId: string,
): boolean {
  return workspaces.some((workspace) => workspace.id === workspaceId);
}

function hasProjectId(
  projects: ReadonlyArray<Pick<BirdCoderProject, 'id'>>,
  projectId: string,
): boolean {
  return projects.some((project) => project.id === projectId);
}

function hasCodingSessionId(
  codingSessions: ReadonlyArray<Pick<BirdCoderCodingSession, 'id'>>,
  codingSessionId: string,
): boolean {
  return codingSessions.some((codingSession) => codingSession.id === codingSessionId);
}

export function normalizeWorkbenchRecoverySnapshot(value: unknown): WorkbenchRecoverySnapshot {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT };
  }

  const snapshot = value as Partial<WorkbenchRecoverySnapshot>;
  return {
    version: 2,
    userScope: normalizeWorkbenchRecoveryUserScope(snapshot.userScope),
    sessionId: normalizeIdentifier(snapshot.sessionId),
    activeTab: normalizeActiveTab(snapshot.activeTab),
    activeWorkspaceId: normalizeIdentifier(snapshot.activeWorkspaceId),
    activeProjectId: normalizeIdentifier(snapshot.activeProjectId),
    activeCodingSessionId: normalizeIdentifier(snapshot.activeCodingSessionId),
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

export function resolveStartupWorkspaceId(
  options: ResolveStartupWorkspaceIdOptions,
): string {
  const recoveryWorkspaceId = options.recoverySnapshot.activeWorkspaceId;
  if (recoveryWorkspaceId && hasWorkspaceId(options.workspaces, recoveryWorkspaceId)) {
    return recoveryWorkspaceId;
  }

  return options.workspaces[0]?.id ?? '';
}

export function resolveWorkbenchRecoveryPersistenceSelection(
  options: ResolveWorkbenchRecoveryPersistenceSelectionOptions,
): Pick<
  WorkbenchRecoverySnapshot,
  'activeWorkspaceId' | 'activeProjectId' | 'activeCodingSessionId'
> {
  const currentWorkspaceId = normalizeIdentifier(options.currentWorkspaceId);
  const currentProjectId = normalizeIdentifier(options.currentProjectId);
  const currentCodingSessionId = normalizeIdentifier(options.currentCodingSessionId);
  const fallbackWorkspaceId = normalizeIdentifier(options.fallbackSnapshot?.activeWorkspaceId);
  const fallbackProjectId = normalizeIdentifier(options.fallbackSnapshot?.activeProjectId);
  const fallbackCodingSessionId = normalizeIdentifier(
    options.fallbackSnapshot?.activeCodingSessionId,
  );
  const workspacesReady = options.hasWorkspacesFetched;
  const projectsReady = workspacesReady && (!currentWorkspaceId || options.hasProjectsFetched);

  return {
    activeWorkspaceId: workspacesReady ? currentWorkspaceId : fallbackWorkspaceId,
    activeProjectId: projectsReady ? currentProjectId : fallbackProjectId,
    activeCodingSessionId: projectsReady
      ? currentCodingSessionId
      : fallbackCodingSessionId,
  };
}

export function isWorkbenchRecoverySelectionResolutionReady(
  options: Pick<
    ResolveWorkbenchRecoveryPersistenceSelectionOptions,
    'currentWorkspaceId' | 'hasProjectsFetched' | 'hasWorkspacesFetched'
  >,
): boolean {
  const currentWorkspaceId = normalizeIdentifier(options.currentWorkspaceId);
  return (
    options.hasWorkspacesFetched &&
    (!currentWorkspaceId || options.hasProjectsFetched)
  );
}

export function resolveStartupProjectId(
  options: ResolveStartupProjectIdOptions,
): string {
  const scopedProjects = options.projects.filter(
    (project) => project.workspaceId === options.workspaceId,
  );
  const recoveryProjectId = options.recoverySnapshot.activeProjectId;
  if (recoveryProjectId && hasProjectId(scopedProjects, recoveryProjectId)) {
    return recoveryProjectId;
  }

  const recoveryCodingSessionId = options.recoverySnapshot.activeCodingSessionId;
  if (recoveryCodingSessionId) {
    const recoveryProjectByCodingSession = scopedProjects.find((project) =>
      hasCodingSessionId(project.codingSessions ?? [], recoveryCodingSessionId),
    );
    if (recoveryProjectByCodingSession) {
      return recoveryProjectByCodingSession.id;
    }
  }

  return scopedProjects[0]?.id ?? '';
}

export function resolveStartupCodingSessionId(
  options: ResolveStartupCodingSessionIdOptions,
): string {
  const scopedCodingSessions =
    options.projects.find((project) => project.id === options.projectId)?.codingSessions ?? [];
  const recoveryCodingSessionId = options.recoverySnapshot.activeCodingSessionId;
  if (
    recoveryCodingSessionId &&
    hasCodingSessionId(scopedCodingSessions, recoveryCodingSessionId)
  ) {
    return recoveryCodingSessionId;
  }

  return scopedCodingSessions[0]?.id ?? '';
}

export function buildWorkbenchRecoveryAnnouncement(
  options: BuildWorkbenchRecoveryAnnouncementOptions,
): string | null {
  if (options.recoverySnapshot.cleanExit) {
    return null;
  }

  if (normalizeIdentifier(options.activeCodingSessionId)) {
    return 'Recovered previous coding session after the last unexpected shutdown.';
  }

  if (normalizeIdentifier(options.activeProjectId)) {
    return 'Recovered previous project after the last unexpected shutdown.';
  }

  if (normalizeIdentifier(options.activeWorkspaceId)) {
    return 'Recovered previous workspace after the last unexpected shutdown.';
  }

  return null;
}

export function recoverySnapshotsEqual(
  left: WorkbenchRecoverySnapshot,
  right: WorkbenchRecoverySnapshot,
): boolean {
  return (
    left.userScope === right.userScope &&
    left.sessionId === right.sessionId &&
    left.activeTab === right.activeTab &&
    left.activeWorkspaceId === right.activeWorkspaceId &&
    left.activeProjectId === right.activeProjectId &&
    left.activeCodingSessionId === right.activeCodingSessionId &&
    left.cleanExit === right.cleanExit
  );
}
