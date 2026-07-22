import type {
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  compareBirdCoderSessionSortTimestamp,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestampString,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  normalizeBirdCoderCodeEngineNativeSessionId,
  resolveBirdCoderCodeEngineNativeSessionIdPrefix,
} from '@sdkwork/birdcoder-pc-codeengine';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  listAuthorityBackedCodingSessionInventoryPage,
  type SessionInventoryAppRuntimeReadService,
  type StoredCodingSessionInventoryRecord,
  type WorkbenchSessionInventoryRecord,
} from './sessionInventory.ts';

type ProjectSessionSynchronizationRuntimeService = SessionInventoryAppRuntimeReadService;

export interface SynchronizeProjectSessionsFromAuthorityOptions {
  appRuntimeReadService?: ProjectSessionSynchronizationRuntimeService;
  /** Complete projection snapshot already returned with the project read. */
  authoritativeCodingSessions?: readonly BirdCoderCodingSession[];
  project: BirdCoderProject;
  projectService: IProjectService;
  /**
   * Opaque server-issued location selected by the current runtime boundary.
   * When absent, synchronization intentionally reads persisted projections only.
   */
  runtimeLocationId?: string | null;
  sessionLimit?: number;
}

export interface SynchronizeProjectSessionsFromAuthorityResult {
  hasMoreSessions: boolean;
  loadedSessionCount: number;
  project: BirdCoderProject;
  synchronizedSessionIds: string[];
}

export interface SynchronizeProjectsSessionsFromAuthorityOptions {
  appRuntimeReadService?: ProjectSessionSynchronizationRuntimeService;
  projects: readonly BirdCoderProject[];
  projectService: IProjectService;
  sessionLimit?: number;
  workspaceId: string;
}

const DEFAULT_PROJECT_SESSION_SYNCHRONIZATION_LIMIT = 6;
const MAX_PROJECT_SESSION_SYNCHRONIZATION_LIMIT = 200_000;

function normalizeProjectSessionSynchronizationLimit(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value === undefined || value <= 0) {
    return DEFAULT_PROJECT_SESSION_SYNCHRONIZATION_LIMIT;
  }
  return Math.min(value, MAX_PROJECT_SESSION_SYNCHRONIZATION_LIMIT);
}

function normalizeIdentityPart(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveProjectRuntimeLocationId(
  explicitRuntimeLocationId: string | null | undefined,
  sessions: readonly BirdCoderCodingSession[],
): string | undefined {
  const normalizedExplicitRuntimeLocationId = normalizeIdentityPart(
    explicitRuntimeLocationId,
  );
  if (normalizedExplicitRuntimeLocationId) {
    return normalizedExplicitRuntimeLocationId;
  }

  const runtimeLocationIds = new Set<string>();
  for (const session of sessions) {
    const runtimeLocationId = normalizeIdentityPart(session.runtimeLocationId);
    if (runtimeLocationId) {
      runtimeLocationIds.add(runtimeLocationId);
    }
  }
  return runtimeLocationIds.size === 1
    ? runtimeLocationIds.values().next().value
    : undefined;
}

function buildSessionIdentityKeys(
  session: Pick<BirdCoderCodingSession, 'engineId' | 'id' | 'nativeSessionId'>,
): string[] {
  const engineId = normalizeIdentityPart(session.engineId);
  const keys = new Set<string>();
  const addKey = (value: string | null | undefined) => {
    const normalizedValue = normalizeBirdCoderCodeEngineNativeSessionId(
      value,
      session.engineId,
    );
    if (normalizedValue) {
      keys.add(`${engineId}:${normalizedValue}`);
    }
  };

  addKey(session.id);
  addKey(session.nativeSessionId);
  return [...keys];
}

function indexProjectSessionsByIdentity(
  sessions: readonly BirdCoderCodingSession[],
): Map<string, BirdCoderCodingSession> {
  const sessionsByIdentity = new Map<string, BirdCoderCodingSession>();
  for (const session of sessions) {
    for (const key of buildSessionIdentityKeys(session)) {
      sessionsByIdentity.set(key, session);
    }
  }
  return sessionsByIdentity;
}

function findExistingProjectSession(
  record: StoredCodingSessionInventoryRecord,
  sessionsByIdentity: ReadonlyMap<string, BirdCoderCodingSession>,
): BirdCoderCodingSession | undefined {
  for (const key of buildSessionIdentityKeys(record)) {
    const session = sessionsByIdentity.get(key);
    if (session) {
      return session;
    }
  }
  return undefined;
}

function resolveLatestIsoTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | undefined {
  const leftTimestamp = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightTimestamp = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (Number.isNaN(leftTimestamp)) {
    return Number.isNaN(rightTimestamp) || typeof right !== 'string' ? undefined : right;
  }
  if (Number.isNaN(rightTimestamp)) {
    return typeof left === 'string' ? left : undefined;
  }
  return rightTimestamp > leftTimestamp
    ? (typeof right === 'string' ? right : undefined)
    : (typeof left === 'string' ? left : undefined);
}

function collapseAuthoritySessionSnapshots(
  records: readonly StoredCodingSessionInventoryRecord[],
): StoredCodingSessionInventoryRecord[] {
  const claimedIdentityKeys = new Set<string>();
  const collapsedRecords: StoredCodingSessionInventoryRecord[] = [];
  const newestFirst = [...records].sort(
    (left, right) =>
      compareBirdCoderSessionSortTimestamp(right, left) ||
      left.id.localeCompare(right.id),
  );

  for (const record of newestFirst) {
    const identityKeys = buildSessionIdentityKeys(record);
    if (identityKeys.some((key) => claimedIdentityKeys.has(key))) {
      continue;
    }
    collapsedRecords.push(record);
    for (const key of identityKeys) {
      claimedIdentityKeys.add(key);
    }
  }

  return collapsedRecords;
}

function toSynchronizedProjectSession(
  record: StoredCodingSessionInventoryRecord,
  existingSession?: BirdCoderCodingSession,
): BirdCoderCodingSession {
  const existingSessionIsNewer = !!existingSession &&
    compareBirdCoderSessionSortTimestamp(existingSession, record) > 0;
  const summarySource = existingSessionIsNewer ? existingSession : record;
  const providerPrefix = resolveBirdCoderCodeEngineNativeSessionIdPrefix(record.engineId);
  const recordUsesProviderScopedId = !!providerPrefix && record.id.startsWith(providerPrefix);
  const existingUsesProviderScopedId =
    !!providerPrefix && !!existingSession?.id.startsWith(providerPrefix);
  const session: BirdCoderCodingSession = {
    id:
      recordUsesProviderScopedId && !existingUsesProviderScopedId
        ? record.id
        : existingSession?.id ?? record.id,
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    title: summarySource.title,
    status: summarySource.status,
    hostMode: summarySource.hostMode,
    engineId: summarySource.engineId,
    modelId: summarySource.modelId,
    nativeSessionId: record.nativeSessionId ?? existingSession?.nativeSessionId,
    runtimeLocationId:
      summarySource.runtimeLocationId ??
      record.runtimeLocationId ??
      existingSession?.runtimeLocationId,
    nativeAttributes: summarySource.nativeAttributes
      ?? record.nativeAttributes
      ?? existingSession?.nativeAttributes,
    runtimeStatus: summarySource.runtimeStatus,
    createdAt: existingSession?.createdAt ?? record.createdAt,
    updatedAt:
      resolveLatestIsoTimestamp(existingSession?.updatedAt, record.updatedAt) ??
      record.updatedAt,
    lastTurnAt: resolveLatestIsoTimestamp(
      existingSession?.lastTurnAt,
      record.lastTurnAt,
    ),
    sortTimestamp: resolveBirdCoderSessionSortTimestampString(summarySource),
    transcriptUpdatedAt: resolveLatestIsoTimestamp(
      existingSession?.transcriptUpdatedAt,
      record.transcriptUpdatedAt,
    ) ?? null,
    pinned: existingSession?.pinned,
    archived: existingSession?.archived,
    displayTime: existingSession?.displayTime ?? '',
    unread: existingSession?.unread,
    messages: existingSession?.messages ?? [],
  };

  return {
    ...session,
    displayTime: formatBirdCoderSessionActivityDisplayTime(session),
  };
}

function areSynchronizedSessionSummariesEqual(
  left: BirdCoderCodingSession | undefined,
  right: BirdCoderCodingSession,
): boolean {
  return !!left &&
    left.id === right.id &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    left.title === right.title &&
    left.status === right.status &&
    left.hostMode === right.hostMode &&
    left.engineId === right.engineId &&
    left.modelId === right.modelId &&
    left.nativeSessionId === right.nativeSessionId &&
    left.runtimeLocationId === right.runtimeLocationId &&
    JSON.stringify(left.nativeAttributes ?? null) ===
      JSON.stringify(right.nativeAttributes ?? null) &&
    left.runtimeStatus === right.runtimeStatus &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.lastTurnAt === right.lastTurnAt &&
    resolveBirdCoderSessionSortTimestampString(left) ===
      resolveBirdCoderSessionSortTimestampString(right) &&
    (left.transcriptUpdatedAt ?? null) === (right.transcriptUpdatedAt ?? null);
}

function sortProjectSessionsByActivity(
  sessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  return [...sessions].sort(
    (left, right) =>
      compareBirdCoderSessionSortTimestamp(right, left) ||
      left.id.localeCompare(right.id),
  );
}

async function synchronizeProjectSessionsFromInventory(
  options: SynchronizeProjectSessionsFromAuthorityOptions,
  inventory: readonly WorkbenchSessionInventoryRecord[],
  hasMoreSessions: boolean,
): Promise<SynchronizeProjectSessionsFromAuthorityResult> {
  const workspaceId = options.project.workspaceId.trim();
  const projectId = options.project.id.trim();
  if (
    !options.projectService.upsertCodingSession ||
    !workspaceId ||
    !projectId
  ) {
    return {
      hasMoreSessions: false,
      loadedSessionCount: options.project.codingSessions.length,
      project: options.project,
      synchronizedSessionIds: [],
    };
  }

  const authoritySessions = collapseAuthoritySessionSnapshots(
    inventory.filter(
      (record): record is StoredCodingSessionInventoryRecord =>
        record.kind === 'coding' &&
        record.workspaceId.trim() === workspaceId &&
        record.projectId.trim() === projectId,
    ),
  );
  if (authoritySessions.length === 0) {
    return {
      hasMoreSessions,
      loadedSessionCount: options.project.codingSessions.length,
      project: options.project,
      synchronizedSessionIds: [],
    };
  }

  const sessionsByIdentity = indexProjectSessionsByIdentity(
    options.project.codingSessions,
  );
  const synchronizedSessions: BirdCoderCodingSession[] = [];
  const synchronizedSessionIds: string[] = [];

  for (const authoritySession of authoritySessions) {
    const existingSession = findExistingProjectSession(
      authoritySession,
      sessionsByIdentity,
    );
    const synchronizedSession = toSynchronizedProjectSession(
      authoritySession,
      existingSession,
    );
    synchronizedSessions.push(synchronizedSession);
    for (const key of buildSessionIdentityKeys(synchronizedSession)) {
      sessionsByIdentity.set(key, synchronizedSession);
    }

    if (areSynchronizedSessionSummariesEqual(existingSession, synchronizedSession)) {
      continue;
    }

    await options.projectService.upsertCodingSession(projectId, synchronizedSession);
    synchronizedSessionIds.push(synchronizedSession.id);
  }

  const synchronizedIdentityKeys = new Set(
    synchronizedSessions.flatMap(buildSessionIdentityKeys),
  );
  const retainedAuthoritativeSessions =
    options.authoritativeCodingSessions === undefined
      ? []
      : options.authoritativeCodingSessions.filter((session) => {
          const identityKeys = buildSessionIdentityKeys(session);
          return identityKeys.length === 0 ||
            !identityKeys.some((key) => synchronizedIdentityKeys.has(key));
        });
  const projectedSessions = [
    ...synchronizedSessions,
    ...retainedAuthoritativeSessions,
  ];

  return {
    hasMoreSessions,
    loadedSessionCount: projectedSessions.length,
    project: {
      ...options.project,
      codingSessions: sortProjectSessionsByActivity(projectedSessions),
    },
    synchronizedSessionIds,
  };
}

export async function synchronizeProjectSessionsFromAuthority(
  options: SynchronizeProjectSessionsFromAuthorityOptions,
): Promise<SynchronizeProjectSessionsFromAuthorityResult> {
  const workspaceId = options.project.workspaceId.trim();
  const projectId = options.project.id.trim();
  if (!options.appRuntimeReadService || !workspaceId || !projectId) {
    return {
      hasMoreSessions: false,
      loadedSessionCount: options.project.codingSessions.length,
      project: options.project,
      synchronizedSessionIds: [],
    };
  }

  const inventory = await listAuthorityBackedCodingSessionInventoryPage({
    appRuntimeReadService: options.appRuntimeReadService,
    authoritativeCodingSessions: options.authoritativeCodingSessions,
    includeGlobal: false,
    limit: normalizeProjectSessionSynchronizationLimit(options.sessionLimit),
    offset: 0,
    projectId,
    runtimeLocationId: resolveProjectRuntimeLocationId(
      options.runtimeLocationId,
      options.project.codingSessions,
    ),
    workspaceId,
  });
  return synchronizeProjectSessionsFromInventory(
    options,
    inventory.items,
    inventory.hasMore,
  );
}

export async function synchronizeProjectsSessionsFromAuthority(
  options: SynchronizeProjectsSessionsFromAuthorityOptions,
): Promise<BirdCoderProject[]> {
  const workspaceId = options.workspaceId.trim();
  const scopedProjects = options.projects.filter(
    (project) => project.workspaceId.trim() === workspaceId,
  );
  if (
    !options.appRuntimeReadService ||
    !options.projectService.upsertCodingSession ||
    !workspaceId ||
    scopedProjects.length === 0
  ) {
    return [...options.projects];
  }

  const synchronizedProjectsById = new Map<string, BirdCoderProject>();
  const sessionLimit = normalizeProjectSessionSynchronizationLimit(options.sessionLimit);
  let nextProjectIndex = 0;
  const synchronizeNextProject = async (): Promise<void> => {
    while (nextProjectIndex < scopedProjects.length) {
      const project = scopedProjects[nextProjectIndex++];
      if (!project) {
        continue;
      }
      const inventory = await listAuthorityBackedCodingSessionInventoryPage({
        appRuntimeReadService: options.appRuntimeReadService,
        includeGlobal: false,
        limit: sessionLimit,
        offset: 0,
        projectId: project.id,
        runtimeLocationId: resolveProjectRuntimeLocationId(
          undefined,
          project.codingSessions,
        ),
        workspaceId,
      });
      const synchronized = await synchronizeProjectSessionsFromInventory(
        {
          appRuntimeReadService: options.appRuntimeReadService,
          project,
          projectService: options.projectService,
          sessionLimit,
        },
        inventory.items,
        inventory.hasMore,
      );
      synchronizedProjectsById.set(project.id, synchronized.project);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(4, scopedProjects.length) },
      () => synchronizeNextProject(),
    ),
  );

  return options.projects.map(
    (project) => synchronizedProjectsById.get(project.id) ?? project,
  );
}
