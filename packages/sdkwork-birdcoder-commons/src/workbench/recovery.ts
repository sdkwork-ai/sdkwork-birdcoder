import type {
  AppTab,
  BirdCoderCodingSession,
  BirdCoderProject,
  IWorkspace,
} from '@sdkwork/birdcoder-types';
import type { WorkbenchSessionInventoryRecord } from './sessionInventory.ts';

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
  version: 1;
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
  inventory: ReadonlyArray<Pick<WorkbenchSessionInventoryRecord, 'workspaceId'>>;
}

export interface ResolveStartupProjectIdOptions {
  workspaceId: string;
  projects: ReadonlyArray<
    Pick<BirdCoderProject, 'id' | 'workspaceId'> & {
      codingSessions?: ReadonlyArray<Pick<BirdCoderCodingSession, 'id'>>;
    }
  >;
  recoverySnapshot: WorkbenchRecoverySnapshot;
  inventory: ReadonlyArray<Pick<WorkbenchSessionInventoryRecord, 'projectId' | 'workspaceId'>>;
}

export interface ResolveStartupCodingSessionIdOptions {
  projectId: string;
  projects: ReadonlyArray<
    Pick<BirdCoderProject, 'id'> & {
      codingSessions: ReadonlyArray<Pick<BirdCoderCodingSession, 'id'>>;
    }
  >;
  recoverySnapshot: WorkbenchRecoverySnapshot;
  inventory: ReadonlyArray<
    Pick<WorkbenchSessionInventoryRecord, 'id' | 'kind' | 'projectId'>
  >;
}

export interface BuildWorkbenchRecoveryAnnouncementOptions {
  recoverySnapshot: WorkbenchRecoverySnapshot;
  activeWorkspaceId: string;
  activeProjectId: string;
  activeCodingSessionId: string;
}

const ZERO_TIMESTAMP = new Date(0).toISOString();

export const DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT: WorkbenchRecoverySnapshot = {
  version: 1,
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
    version: 1,
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

export function resolveStartupWorkspaceId(
  options: ResolveStartupWorkspaceIdOptions,
): string {
  const recoveryWorkspaceId = options.recoverySnapshot.activeWorkspaceId;
  if (recoveryWorkspaceId && hasWorkspaceId(options.workspaces, recoveryWorkspaceId)) {
    return recoveryWorkspaceId;
  }

  const inventoryWorkspaceId = options.inventory
    .map((entry) => normalizeIdentifier(entry.workspaceId))
    .find((workspaceId) => workspaceId && hasWorkspaceId(options.workspaces, workspaceId));
  if (inventoryWorkspaceId) {
    return inventoryWorkspaceId;
  }

  return options.workspaces[0]?.id ?? '';
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

  const inventoryProjectId = options.inventory
    .filter((entry) => entry.workspaceId === options.workspaceId)
    .map((entry) => normalizeIdentifier(entry.projectId))
    .find((projectId) => projectId && hasProjectId(scopedProjects, projectId));
  if (inventoryProjectId) {
    return inventoryProjectId;
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

  const inventoryCodingSessionId = options.inventory
    .filter((entry) => entry.kind === 'coding' && entry.projectId === options.projectId)
    .map((entry) => normalizeIdentifier(entry.id))
    .find(
      (codingSessionId) =>
        codingSessionId && hasCodingSessionId(scopedCodingSessions, codingSessionId),
    );
  if (inventoryCodingSessionId) {
    return inventoryCodingSessionId;
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
    left.sessionId === right.sessionId &&
    left.activeTab === right.activeTab &&
    left.activeWorkspaceId === right.activeWorkspaceId &&
    left.activeProjectId === right.activeProjectId &&
    left.activeCodingSessionId === right.activeCodingSessionId &&
    left.cleanExit === right.cleanExit
  );
}
