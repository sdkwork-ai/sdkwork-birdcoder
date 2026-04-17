import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  IProjectService,
} from '../services/interfaces/IProjectService.ts';
import {
  listStoredSessionInventory,
  type WorkbenchSessionInventoryRecord,
} from './sessionInventory.ts';
import {
  isAuthorityBackedNativeSessionId,
  readAuthorityBackedNativeSessionRecord,
  type NativeSessionAuthorityCoreReadService,
} from './nativeSessionAuthority.ts';

const CODEX_NATIVE_SESSION_ID_PREFIX = 'codex-native:';
const NATIVE_SESSION_MESSAGE_ID_SEGMENT = ':native-message:';

export const NATIVE_CODEX_MIRROR_PROJECT_NAME = 'Codex Sessions';
export const NATIVE_CODEX_MIRROR_PROJECT_COLLISION_SAFE_NAME = 'Codex Sessions (BirdCoder)';
export const NATIVE_CODEX_MIRROR_PROJECT_DESCRIPTION =
  'Managed BirdCoder mirror for imported local Codex sessions.';
const NATIVE_ENGINE_MIRROR_PROJECT_DESCRIPTION_PREFIX =
  'Managed BirdCoder mirror for imported native engine sessions.';

type NativeSessionInventoryRecord = Extract<
  WorkbenchSessionInventoryRecord,
  {
    kind: 'coding';
  }
>;

type MirroredProjectView = BirdCoderProject | BirdCoderProjectMirrorSnapshot;
type MirroredCodingSessionView = BirdCoderCodingSession | BirdCoderCodingSessionMirrorSnapshot;

interface ExistingMirroredSessionCandidate {
  codingSession: MirroredCodingSessionView;
  project: MirroredProjectView;
}

interface IndexedProjectPathEntry {
  normalizedPath: string;
  pathLength: number;
  project: MirroredProjectView;
}

interface IndexedProjectFolderNameEntry {
  normalizedFolderName: string;
  project: MirroredProjectView;
}

export interface EnsureNativeCodexSessionMirrorOptions {
  coreReadService?: NativeSessionAuthorityCoreReadService;
  inventory: ReadonlyArray<WorkbenchSessionInventoryRecord>;
  projectService: IProjectService;
  workspaceId: string;
}

export interface EnsureNativeCodexSessionMirrorResult {
  mirroredSessionIds: string[];
  projectIds: string[];
  projectId: string;
}

function normalizeNativeEngineId(value: string | null | undefined): string {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : 'codex';
}

function resolveNativeEngineDisplayName(engineId: string): string {
  switch (normalizeNativeEngineId(engineId)) {
    case 'claude-code':
      return 'Claude Code';
    case 'gemini':
      return 'Gemini';
    case 'opencode':
      return 'OpenCode';
    case 'codex':
      return 'Codex';
    default:
      return normalizeNativeEngineId(engineId)
        .split(/[-_\s]+/u)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
  }
}

function createManagedMirrorProjectDescription(engineId: string): string {
  const normalizedEngineId = normalizeNativeEngineId(engineId);
  return normalizedEngineId === 'codex'
    ? NATIVE_CODEX_MIRROR_PROJECT_DESCRIPTION
    : `${NATIVE_ENGINE_MIRROR_PROJECT_DESCRIPTION_PREFIX} engine:${normalizedEngineId}`;
}

function resolveManagedMirrorProjectEngineId(
  project: MirroredProjectView,
): string | null {
  if (project.description === NATIVE_CODEX_MIRROR_PROJECT_DESCRIPTION) {
    return 'codex';
  }

  const description = project.description?.trim() ?? '';
  const managedDescriptionMatch = new RegExp(
    `^${NATIVE_ENGINE_MIRROR_PROJECT_DESCRIPTION_PREFIX.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} engine:([a-z0-9-]+)$`,
    'u',
  ).exec(description);
  return managedDescriptionMatch?.[1] ?? null;
}

function resolveManagedMirrorProjectName(engineId: string): string {
  const normalizedEngineId = normalizeNativeEngineId(engineId);
  if (normalizedEngineId === 'codex') {
    return NATIVE_CODEX_MIRROR_PROJECT_NAME;
  }

  return `${resolveNativeEngineDisplayName(normalizedEngineId)} Sessions`;
}

function resolveManagedMirrorProjectCollisionSafeName(engineId: string): string {
  const normalizedEngineId = normalizeNativeEngineId(engineId);
  if (normalizedEngineId === 'codex') {
    return NATIVE_CODEX_MIRROR_PROJECT_COLLISION_SAFE_NAME;
  }

  return `${resolveManagedMirrorProjectName(normalizedEngineId)} (BirdCoder)`;
}

function isNativeSessionRecord(
  record: WorkbenchSessionInventoryRecord,
): record is NativeSessionInventoryRecord {
  if (record.kind !== 'coding') {
    return false;
  }

  return (
    'nativeCwd' in record ||
    'transcriptUpdatedAt' in record ||
    isAuthorityBackedNativeSessionId(record.id, record.engineId)
  );
}

function isManagedMirrorProject(
  project: MirroredProjectView,
  engineId?: string,
): boolean {
  const managedProjectEngineId = resolveManagedMirrorProjectEngineId(project);
  if (!managedProjectEngineId) {
    return false;
  }

  return (
    engineId === undefined ||
    managedProjectEngineId === normalizeNativeEngineId(engineId)
  );
}

function isLegacyMirrorProjectCandidate(project: MirroredProjectView): boolean {
  return (
    project.name === NATIVE_CODEX_MIRROR_PROJECT_NAME &&
    project.codingSessions.every((session) =>
      session.id.startsWith(CODEX_NATIVE_SESSION_ID_PREFIX),
    )
  );
}

function isFullMirroredCodingSession(
  session: MirroredCodingSessionView,
): session is BirdCoderCodingSession {
  return 'messages' in session && Array.isArray(session.messages);
}

function getMirroredSessionMessageCount(session: MirroredCodingSessionView): number {
  return isFullMirroredCodingSession(session)
    ? session.messages.length
    : session.messageCount;
}

function getMirroredSessionTranscriptUpdatedAt(
  session: MirroredCodingSessionView,
): string | null {
  if (!isFullMirroredCodingSession(session)) {
    return typeof session.nativeTranscriptUpdatedAt === 'string'
      ? session.nativeTranscriptUpdatedAt
      : null;
  }

  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (
      message.id.includes(NATIVE_SESSION_MESSAGE_ID_SEGMENT) &&
      typeof message.createdAt === 'string' &&
      !Number.isNaN(Date.parse(message.createdAt))
    ) {
      return message.createdAt;
    }
  }

  return null;
}

function cloneExistingMirroredSessionMessages(
  session: MirroredCodingSessionView | null | undefined,
): BirdCoderChatMessage[] {
  if (!session || !isFullMirroredCodingSession(session)) {
    return [];
  }

  return session.messages.map((message) => structuredClone(message));
}

function toMirroredCodingSession(
  workspaceId: string,
  projectId: string,
  record: NativeSessionInventoryRecord,
  options: {
    existingSession?: MirroredCodingSessionView | null;
    refreshedMessages?: readonly BirdCoderChatMessage[] | null;
  } = {},
): BirdCoderCodingSession {
  const refreshedMessages = options.refreshedMessages;
  const existingSession = options.existingSession;
  return {
    id: record.id,
    workspaceId,
    projectId,
    title: record.title,
    status: record.status,
    hostMode: record.hostMode,
    engineId: record.engineId,
    modelId: record.modelId ?? record.engineId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastTurnAt: record.lastTurnAt,
    displayTime: existingSession?.displayTime ?? 'Just now',
    pinned: existingSession?.pinned ?? false,
    archived: existingSession?.archived ?? record.status === 'archived',
    unread: existingSession?.unread ?? false,
    messages:
      refreshedMessages !== undefined && refreshedMessages !== null
        ? refreshedMessages.map((message) => structuredClone(message))
        : cloneExistingMirroredSessionMessages(existingSession),
  };
}

function areMirroredChatMessagesEquivalent(
  left: readonly BirdCoderChatMessage[],
  right: readonly BirdCoderChatMessage[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((message, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      message.id === candidate.id &&
      message.codingSessionId === candidate.codingSessionId &&
      message.role === candidate.role &&
      message.content === candidate.content &&
      message.createdAt === candidate.createdAt &&
      message.turnId === candidate.turnId &&
      message.timestamp === candidate.timestamp
    );
  });
}

function areMirroredCodingSessionsEquivalent(
  left: MirroredCodingSessionView | null,
  right: BirdCoderCodingSession,
): boolean {
  if (!left) {
    return false;
  }

  if (!isFullMirroredCodingSession(left)) {
    return false;
  }

  return (
    left.id === right.id &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    left.title === right.title &&
    left.status === right.status &&
    left.hostMode === right.hostMode &&
    left.engineId === right.engineId &&
    left.modelId === right.modelId &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.lastTurnAt === right.lastTurnAt &&
    left.displayTime === right.displayTime &&
    (left.pinned ?? false) === (right.pinned ?? false) &&
    (left.archived ?? false) === (right.archived ?? false) &&
    (left.unread ?? false) === (right.unread ?? false) &&
    areMirroredChatMessagesEquivalent(left.messages, right.messages)
  );
}

async function resolveManagedMirrorProject(
  workspaceId: string,
  projects: MirroredProjectView[],
  projectService: IProjectService,
  engineId: string,
): Promise<MirroredProjectView> {
  const normalizedEngineId = normalizeNativeEngineId(engineId);
  const managedProject =
    projects.find((project) => isManagedMirrorProject(project, normalizedEngineId)) ??
    (normalizedEngineId === 'codex'
      ? projects.find(isLegacyMirrorProjectCandidate)
      : undefined);
  const desiredDescription = createManagedMirrorProjectDescription(normalizedEngineId);
  const hasUnsafeNameCollision = projects.some(
    (project) =>
      project.name === resolveManagedMirrorProjectName(normalizedEngineId) &&
      !isManagedMirrorProject(project, normalizedEngineId) &&
      !(normalizedEngineId === 'codex' && isLegacyMirrorProjectCandidate(project)),
  );
  const desiredName = hasUnsafeNameCollision
    ? resolveManagedMirrorProjectCollisionSafeName(normalizedEngineId)
    : resolveManagedMirrorProjectName(normalizedEngineId);

  if (managedProject) {
    if (
      managedProject.description !== desiredDescription ||
      managedProject.name !== desiredName
    ) {
      await projectService.updateProject(managedProject.id, {
        description: desiredDescription,
        name: desiredName,
      });
      managedProject.description = desiredDescription;
      managedProject.name = desiredName;
    }

    return managedProject;
  }

  const createdProject = await projectService.createProject(workspaceId, desiredName);
  await projectService.updateProject(createdProject.id, {
    description: desiredDescription,
  });

  const managedMirrorProject = {
    ...createdProject,
    description: desiredDescription,
  };
  projects.push(managedMirrorProject);
  return managedMirrorProject;
}

function collectNativeSessionRecords(
  inventory: ReadonlyArray<WorkbenchSessionInventoryRecord>,
): NativeSessionInventoryRecord[] {
  const nativeSessionsById = new Map<string, NativeSessionInventoryRecord>();

  for (const record of inventory) {
    if (isNativeSessionRecord(record)) {
      nativeSessionsById.set(record.id, record);
    }
  }

  return [...nativeSessionsById.values()].sort(
    (left, right) =>
      right.sortTimestamp - left.sortTimestamp || left.id.localeCompare(right.id),
  );
}

function normalizePathForComparison(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const isWindowsStylePath =
    /^[a-zA-Z]:/u.test(trimmedValue) ||
    trimmedValue.includes('\\') ||
    trimmedValue.startsWith('\\\\');
  const normalizedSeparators = trimmedValue.replace(/\\/gu, '/');
  const collapsedPath = normalizedSeparators.startsWith('//')
    ? `//${normalizedSeparators.slice(2).replace(/\/+/gu, '/')}`
    : normalizedSeparators.replace(/\/+/gu, '/');
  const withoutTrailingSeparator =
    collapsedPath === '/'
      ? collapsedPath
      : collapsedPath.replace(/\/+$/u, '') || collapsedPath;

  return isWindowsStylePath
    ? withoutTrailingSeparator.toLowerCase()
    : withoutTrailingSeparator;
}

function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(value);
}

function isWindowsUncPath(value: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/u.test(value);
}

function isPosixNativePath(value: string): boolean {
  if (!value.startsWith('/')) {
    return false;
  }

  return value.split('/').filter(Boolean).length >= 2;
}

function isNativeAbsoluteProjectPath(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  return (
    isWindowsDrivePath(trimmedValue) ||
    isWindowsUncPath(trimmedValue) ||
    isPosixNativePath(trimmedValue)
  );
}

function extractNormalizedPathBaseName(value: string | null | undefined): string | null {
  const normalizedPath = normalizePathForComparison(value);
  if (!normalizedPath) {
    return null;
  }

  const pathSegments = normalizedPath.split('/').filter(Boolean);
  return pathSegments[pathSegments.length - 1] ?? null;
}

function createIndexedProjectPathEntries(
  projects: readonly MirroredProjectView[],
): IndexedProjectPathEntry[] {
  return projects
    .map((project) => {
      const normalizedPath = normalizePathForComparison(project.path);
      return normalizedPath
        ? {
            normalizedPath,
            pathLength: normalizedPath.length,
            project,
          }
        : null;
    })
    .filter((entry): entry is IndexedProjectPathEntry => entry !== null)
    .sort(
      (left, right) =>
        right.pathLength - left.pathLength || left.project.id.localeCompare(right.project.id),
    );
}

function createIndexedProjectFolderNameEntries(
  projects: readonly MirroredProjectView[],
): IndexedProjectFolderNameEntry[] {
  const projectsByFolderName = new Map<string, MirroredProjectView[]>();

  for (const project of projects) {
    if (isManagedMirrorProject(project)) {
      continue;
    }

    const candidateFolderNames = new Set<string>();
    if (!isNativeAbsoluteProjectPath(project.path)) {
      const pathBaseName = extractNormalizedPathBaseName(project.path);
      if (pathBaseName) {
        candidateFolderNames.add(pathBaseName);
      }
    }

    const normalizedProjectName = project.name.trim().toLowerCase();
    if (normalizedProjectName) {
      candidateFolderNames.add(normalizedProjectName);
    }

    for (const normalizedFolderName of candidateFolderNames) {
      const folderProjects = projectsByFolderName.get(normalizedFolderName) ?? [];
      folderProjects.push(project);
      projectsByFolderName.set(normalizedFolderName, folderProjects);
    }
  }

  return [...projectsByFolderName.entries()]
    .filter(([, candidateProjects]) => candidateProjects.length === 1)
    .map(([normalizedFolderName, [project]]) => ({
      normalizedFolderName,
      project,
    }))
    .sort((left, right) => left.project.id.localeCompare(right.project.id));
}

function resolveTargetProjectForNativeSession(
  indexedProjectPaths: readonly IndexedProjectPathEntry[],
  indexedProjectFolderNames: readonly IndexedProjectFolderNameEntry[],
  record: NativeSessionInventoryRecord,
): MirroredProjectView | null {
  const normalizedNativeWorkingDirectory = normalizePathForComparison(record.nativeCwd);
  if (!normalizedNativeWorkingDirectory) {
    return null;
  }

  const pathMatchedProject =
    indexedProjectPaths.find(({ normalizedPath }) =>
      normalizedNativeWorkingDirectory === normalizedPath ||
      normalizedNativeWorkingDirectory.startsWith(`${normalizedPath}/`),
    )?.project ?? null;
  if (pathMatchedProject) {
    return pathMatchedProject;
  }

  const nativeWorkingDirectoryBaseName = extractNormalizedPathBaseName(
    normalizedNativeWorkingDirectory,
  );
  if (!nativeWorkingDirectoryBaseName) {
    return null;
  }

  return (
    indexedProjectFolderNames.find(
      ({ normalizedFolderName }) => normalizedFolderName === nativeWorkingDirectoryBaseName,
    )?.project ?? null
  );
}

function createExistingMirroredSessionsById(
  projects: readonly MirroredProjectView[],
): Map<string, ExistingMirroredSessionCandidate[]> {
  const existingMirroredSessionsById = new Map<string, ExistingMirroredSessionCandidate[]>();

  for (const project of projects) {
    for (const codingSession of project.codingSessions) {
      const sessionCandidates = existingMirroredSessionsById.get(codingSession.id) ?? [];
      sessionCandidates.push({
        project,
        codingSession,
      });
      existingMirroredSessionsById.set(codingSession.id, sessionCandidates);
    }
  }

  return existingMirroredSessionsById;
}

function collectExistingMirroredSessions(
  existingMirroredSessionsById: ReadonlyMap<string, ExistingMirroredSessionCandidate[]>,
  codingSessionId: string,
): ExistingMirroredSessionCandidate[] {
  return existingMirroredSessionsById.get(codingSessionId)?.map((candidate) => ({
    project: candidate.project,
    codingSession: candidate.codingSession,
  })) ?? [];
}

function selectExistingMirroredSession(
  candidates: ReadonlyArray<ExistingMirroredSessionCandidate>,
  preferredProjectId: string,
): MirroredCodingSessionView | null {
  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidate =
    candidates.find((candidate) => candidate.project.id === preferredProjectId) ??
    [...candidates].sort((left, right) => {
      const leftMessageCount = getMirroredSessionMessageCount(left.codingSession);
      const rightMessageCount = getMirroredSessionMessageCount(right.codingSession);
      return (
        rightMessageCount - leftMessageCount ||
        right.codingSession.updatedAt.localeCompare(left.codingSession.updatedAt) ||
        left.project.id.localeCompare(right.project.id)
      );
    })[0];

  return preferredCandidate?.codingSession ?? null;
}

function shouldRefreshMirroredNativeSessionTranscript(
  record: NativeSessionInventoryRecord,
  existingSession: MirroredCodingSessionView | null,
  targetProjectId: string,
): boolean {
  if (!existingSession) {
    return true;
  }

  if (getMirroredSessionMessageCount(existingSession) === 0) {
    return true;
  }

  if (
    existingSession.projectId !== targetProjectId &&
    !isFullMirroredCodingSession(existingSession)
  ) {
    return true;
  }

  const desiredTranscriptUpdatedAt =
    'transcriptUpdatedAt' in record && typeof record.transcriptUpdatedAt === 'string'
      ? record.transcriptUpdatedAt
      : record.updatedAt;
  const existingTranscriptUpdatedAt = getMirroredSessionTranscriptUpdatedAt(existingSession);

  return existingTranscriptUpdatedAt !== desiredTranscriptUpdatedAt;
}

function isMirroredNativeSessionSummaryEquivalent(
  workspaceId: string,
  projectId: string,
  record: NativeSessionInventoryRecord,
  existingSession: MirroredCodingSessionView | null,
): boolean {
  if (!existingSession) {
    return false;
  }

  return (
    existingSession.id === record.id &&
    existingSession.workspaceId === workspaceId &&
    existingSession.projectId === projectId &&
    existingSession.title === record.title &&
    existingSession.status === record.status &&
    existingSession.hostMode === record.hostMode &&
    existingSession.engineId === record.engineId &&
    (existingSession.modelId ?? existingSession.engineId) ===
      (record.modelId ?? record.engineId) &&
    existingSession.createdAt === record.createdAt &&
    existingSession.updatedAt === record.updatedAt &&
    (existingSession.lastTurnAt ?? '') === (record.lastTurnAt ?? '')
  );
}

async function removeMirroredSessionDuplicates(
  projectService: IProjectService,
  candidates: ReadonlyArray<ExistingMirroredSessionCandidate>,
  retainedProjectId: string,
): Promise<void> {
  for (const candidate of candidates) {
    if (candidate.project.id === retainedProjectId) {
      continue;
    }

    await projectService.deleteCodingSession(candidate.project.id, candidate.codingSession.id);
  }
}

export interface EnsureStoredNativeCodexSessionMirrorOptions {
  coreReadService?: NativeSessionAuthorityCoreReadService;
  limit?: number;
  projectService: IProjectService;
  workspaceId: string;
}

export async function ensureStoredNativeCodexSessionMirror(
  options: EnsureStoredNativeCodexSessionMirrorOptions,
): Promise<EnsureNativeCodexSessionMirrorResult | null> {
  const inventory = await listStoredSessionInventory({
    coreReadService: options.coreReadService,
    includeGlobal: true,
    limit: options.limit,
    workspaceId: options.workspaceId,
  });

  return ensureNativeCodexSessionMirror({
    inventory,
    projectService: options.projectService,
    workspaceId: options.workspaceId,
  });
}

export async function ensureNativeCodexSessionMirror(
  options: EnsureNativeCodexSessionMirrorOptions,
): Promise<EnsureNativeCodexSessionMirrorResult | null> {
  const workspaceId = options.workspaceId.trim();
  if (!workspaceId) {
    return null;
  }

  const nativeSessions = collectNativeSessionRecords(options.inventory);
  if (nativeSessions.length === 0) {
    return null;
  }

  const projects =
    typeof options.projectService.getProjectMirrorSnapshots === 'function'
      ? await options.projectService.getProjectMirrorSnapshots(workspaceId)
      : await options.projectService.getProjects(workspaceId);
  const indexedProjectPaths = createIndexedProjectPathEntries(projects);
  const indexedProjectFolderNames = createIndexedProjectFolderNameEntries(projects);
  const existingMirroredSessionsById = createExistingMirroredSessionsById(projects);
  const managedProjectsByEngineId = new Map<string, MirroredProjectView>();
  const mirroredProjectIds = new Set<string>();
  let fullProjectsForMessageMigration: BirdCoderProject[] | null | undefined;

  for (const record of nativeSessions) {
    const resolvedEngineId = normalizeNativeEngineId(record.engineId);
    const resolvedProject =
      resolveTargetProjectForNativeSession(
        indexedProjectPaths,
        indexedProjectFolderNames,
        record,
      ) ??
      (
        managedProjectsByEngineId.get(resolvedEngineId) ??
        await resolveManagedMirrorProject(
          workspaceId,
          projects,
          options.projectService,
          resolvedEngineId,
        )
      );
    if (isManagedMirrorProject(resolvedProject, resolvedEngineId)) {
      managedProjectsByEngineId.set(resolvedEngineId, resolvedProject);
    }

    const existingMirroredSessions = collectExistingMirroredSessions(
      existingMirroredSessionsById,
      record.id,
    );
    const retainedSession = selectExistingMirroredSession(
      existingMirroredSessions,
      resolvedProject.id,
    );
    const nativeSessionRecord = shouldRefreshMirroredNativeSessionTranscript(
      record,
      retainedSession,
      resolvedProject.id,
    )
      ? await readAuthorityBackedNativeSessionRecord(record.id, {
        coreReadService: options.coreReadService,
        engineId: resolvedEngineId,
        projectId: resolvedProject.id,
        workspaceId,
      })
      : null;
    let retainedSessionForUpsert = retainedSession;
    if (
      nativeSessionRecord === null &&
      retainedSession &&
      retainedSession.projectId !== resolvedProject.id &&
      !isFullMirroredCodingSession(retainedSession) &&
      getMirroredSessionMessageCount(retainedSession) > 0
    ) {
      if (fullProjectsForMessageMigration === undefined) {
        fullProjectsForMessageMigration = await options.projectService.getProjects(workspaceId);
      }

      retainedSessionForUpsert =
        fullProjectsForMessageMigration
          ?.find((project) => project.id === retainedSession.projectId)
          ?.codingSessions.find((codingSession) => codingSession.id === retainedSession.id) ??
        retainedSession;
    }
    const hasDuplicateMirrors = existingMirroredSessions.some(
      (candidate) => candidate.project.id !== resolvedProject.id,
    );

    if (
      nativeSessionRecord === null &&
      !hasDuplicateMirrors &&
      isMirroredNativeSessionSummaryEquivalent(
        workspaceId,
        resolvedProject.id,
        record,
        retainedSessionForUpsert,
      )
    ) {
      mirroredProjectIds.add(resolvedProject.id);
      continue;
    }

    const nextMirroredSession = toMirroredCodingSession(
      workspaceId,
      resolvedProject.id,
      record,
      {
        existingSession: retainedSessionForUpsert,
        refreshedMessages: nativeSessionRecord?.messages,
      },
    );

    if (!areMirroredCodingSessionsEquivalent(retainedSessionForUpsert, nextMirroredSession)) {
      await options.projectService.upsertCodingSession?.(
        resolvedProject.id,
        nextMirroredSession,
      );
    }
    await removeMirroredSessionDuplicates(
      options.projectService,
      existingMirroredSessions,
      resolvedProject.id,
    );
    mirroredProjectIds.add(resolvedProject.id);
  }

  const mirroredProjectIdCollection = [...mirroredProjectIds];
  return {
    mirroredSessionIds: nativeSessions.map((record) => record.id),
    projectIds: mirroredProjectIdCollection,
    projectId: mirroredProjectIdCollection[0] ?? '',
  };
}

export type EnsureNativeSessionMirrorOptions = EnsureNativeCodexSessionMirrorOptions;
export type EnsureStoredNativeSessionMirrorOptions = EnsureStoredNativeCodexSessionMirrorOptions;
export type EnsureNativeSessionMirrorResult = EnsureNativeCodexSessionMirrorResult;

export async function ensureStoredNativeSessionMirror(
  options: EnsureStoredNativeSessionMirrorOptions,
): Promise<EnsureNativeSessionMirrorResult | null> {
  return ensureStoredNativeCodexSessionMirror(options);
}

export async function ensureNativeSessionMirror(
  options: EnsureNativeSessionMirrorOptions,
): Promise<EnsureNativeSessionMirrorResult | null> {
  return ensureNativeCodexSessionMirror(options);
}
