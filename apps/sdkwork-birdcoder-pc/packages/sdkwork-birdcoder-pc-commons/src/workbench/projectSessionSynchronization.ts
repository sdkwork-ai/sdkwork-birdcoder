import type {
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import {
  compareBirdCoderSessionSortTimestamp,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestampString,
} from '@sdkwork/birdcoder-pc-types';
import { normalizeBirdCoderCodeEngineNativeSessionId } from '@sdkwork/birdcoder-pc-codeengine';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  listStoredSessionInventory,
  type StoredCodingSessionInventoryRecord,
  type WorkbenchSessionInventoryRecord,
} from './sessionInventory.ts';

type ProjectSessionSynchronizationRuntimeService = NonNullable<
  NonNullable<Parameters<typeof listStoredSessionInventory>[0]>['appRuntimeReadService']
>;

export interface SynchronizeProjectSessionsFromAuthorityOptions {
  appRuntimeReadService?: ProjectSessionSynchronizationRuntimeService;
  project: BirdCoderProject;
  projectService: IProjectService;
}

export interface SynchronizeProjectSessionsFromAuthorityResult {
  project: BirdCoderProject;
  synchronizedSessionIds: string[];
}

export interface SynchronizeProjectsSessionsFromAuthorityOptions {
  appRuntimeReadService?: ProjectSessionSynchronizationRuntimeService;
  projects: readonly BirdCoderProject[];
  projectService: IProjectService;
  workspaceId: string;
}

const PROJECT_SESSION_SYNCHRONIZATION_LIMIT = 200;

function normalizeIdentityPart(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
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
  const session: BirdCoderCodingSession = {
    id: existingSession?.id ?? record.id,
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    title: summarySource.title,
    status: summarySource.status,
    hostMode: summarySource.hostMode,
    engineId: summarySource.engineId,
    modelId: summarySource.modelId,
    nativeSessionId: record.nativeSessionId ?? existingSession?.nativeSessionId,
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
): Promise<SynchronizeProjectSessionsFromAuthorityResult> {
  const workspaceId = options.project.workspaceId.trim();
  const projectId = options.project.id.trim();
  if (
    !options.projectService.upsertCodingSession ||
    !workspaceId ||
    !projectId
  ) {
    return {
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
  ).slice(0, PROJECT_SESSION_SYNCHRONIZATION_LIMIT);
  if (authoritySessions.length === 0) {
    return {
      project: options.project,
      synchronizedSessionIds: [],
    };
  }

  const sessionsByIdentity = indexProjectSessionsByIdentity(
    options.project.codingSessions,
  );
  const sessionsById = new Map(
    options.project.codingSessions.map((session) => [session.id, session]),
  );
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
    sessionsById.set(synchronizedSession.id, synchronizedSession);
    for (const key of buildSessionIdentityKeys(synchronizedSession)) {
      sessionsByIdentity.set(key, synchronizedSession);
    }

    if (areSynchronizedSessionSummariesEqual(existingSession, synchronizedSession)) {
      continue;
    }

    await options.projectService.upsertCodingSession(projectId, synchronizedSession);
    synchronizedSessionIds.push(synchronizedSession.id);
  }

  return {
    project: {
      ...options.project,
      codingSessions: sortProjectSessionsByActivity([...sessionsById.values()]),
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
      project: options.project,
      synchronizedSessionIds: [],
    };
  }

  const inventory = await listStoredSessionInventory({
    appRuntimeReadService: options.appRuntimeReadService,
    includeGlobal: false,
    limit: PROJECT_SESSION_SYNCHRONIZATION_LIMIT,
    offset: 0,
    projectId,
    workspaceId,
  });
  return synchronizeProjectSessionsFromInventory(options, inventory);
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

  const inventory = await listStoredSessionInventory({
    appRuntimeReadService: options.appRuntimeReadService,
    includeGlobal: false,
    limit: PROJECT_SESSION_SYNCHRONIZATION_LIMIT,
    offset: 0,
    workspaceId,
  });
  const synchronizedProjectsById = new Map<string, BirdCoderProject>();
  for (const project of scopedProjects) {
    const synchronized = await synchronizeProjectSessionsFromInventory(
      {
        appRuntimeReadService: options.appRuntimeReadService,
        project,
        projectService: options.projectService,
      },
      inventory,
    );
    synchronizedProjectsById.set(project.id, synchronized.project);
  }

  return options.projects.map(
    (project) => synchronizedProjectsById.get(project.id) ?? project,
  );
}
