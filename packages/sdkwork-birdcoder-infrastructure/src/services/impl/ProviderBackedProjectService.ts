import type {
  BirdCoderProjectSummary,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  buildBirdCoderChatMessageLogicalMatchKey,
  buildBirdCoderChatMessageSynchronizationSignature,
  buildBirdCoderProjectBusinessCode,
  buildBirdCoderProjectBusinessName,
  compareBirdCoderProjectsByActivity,
  compareBirdCoderSessionSortTimestamp,
  deduplicateBirdCoderComparableChatMessages,
  formatBirdCoderSessionActivityDisplayTime,
  mergeBirdCoderComparableChatMessages,
  resolveBirdCoderSessionSortTimestampString,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-types';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  CreateCodingSessionOptions,
  CreateCodingSessionMessageInput,
  CreateProjectOptions,
  GetCodingSessionTranscriptOptions,
  IProjectService,
  UpdateCodingSessionOptions,
} from '../interfaces/IProjectService.ts';
import type {
  BirdCoderProjectContentRepository,
  BirdCoderProjectContentRecord,
  BirdCoderProjectRepository,
  BirdCoderRepresentativeProjectRecord,
} from '../../storage/appConsoleRepository.ts';
import type { BirdCoderPromptSkillTemplateEvidenceRepositories } from '../../storage/promptSkillTemplateEvidenceRepository.ts';
import type {
  BirdCoderCodingSessionRepositories,
  BirdCoderPersistedCodingSessionMessageMetadata,
  BirdCoderPersistedCodingSessionRecord,
} from '../../storage/codingSessionRepository.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
  BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
  BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
} from '../../storage/bootstrapConsoleCatalog.ts';
import { resolveRequiredCodingSessionSelection } from '../codingSessionSelection.ts';
import {
  buildBirdCoderProjectContentConfigData,
  readBirdCoderProjectRootPathFromConfigData,
} from '../projectContentConfigData.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

const CODEX_NATIVE_MESSAGE_ID_SEGMENT = ':native-message:';
const EMPTY_PERSISTED_CODING_SESSION_MESSAGES_BY_ID = new Map<
  string,
  BirdCoderChatMessage[]
>();
const PUBLIC_TRANSCRIPT_SNAPSHOT_CACHE_MAX_ENTRIES = 256;
const CACHED_CODING_SESSION_MESSAGE_INDEX_MAX_ENTRIES = 128;

function createIdentifier(prefix: string): string {
  void prefix;
  const timestampPart = BigInt(Date.now()) * 1_000_000n;
  const randomPart = BigInt(Math.floor(Math.random() * 1_000_000));
  return (timestampPart + randomPart).toString();
}

function createUuid(): string {
  return crypto.randomUUID();
}

function normalizeProjectPathForComparison(path: string | null | undefined): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const isWindowsStylePath =
    /^[a-zA-Z]:/u.test(trimmedPath) ||
    trimmedPath.includes('\\') ||
    trimmedPath.startsWith('\\\\');
  const normalizedSeparators = trimmedPath.replace(/\\/gu, '/');
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

function findMatchingProjectRecordByPath(
  records: readonly BirdCoderRepresentativeProjectRecord[],
  workspaceId: string,
  path: string,
): BirdCoderRepresentativeProjectRecord | null {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedPath = normalizeProjectPathForComparison(path);
  if (!normalizedWorkspaceId || !normalizedPath) {
    return null;
  }

  return (
    records.find((record) => {
      if (record.workspaceId !== normalizedWorkspaceId) {
        return false;
      }

      return normalizeProjectPathForComparison(record.rootPath) === normalizedPath;
    }) ?? null
  );
}

function isAbsoluteProjectPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function normalizeRequiredProjectPath(
  path: string | null | undefined,
  action: 'create' | 'update',
): string {
  if (typeof path !== 'string') {
    throw new Error(`Project root path is required to ${action} a project.`);
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    throw new Error(`Project root path is required to ${action} a project.`);
  }

  if (!isAbsoluteProjectPath(normalizedPath)) {
    throw new Error('Project root path must be an absolute path.');
  }

  return normalizedPath;
}

function normalizeRequiredProjectPathForCreate(path: string | null | undefined): string {
  return normalizeRequiredProjectPath(path, 'create');
}

function normalizeProjectPathForUpdate(path: string | null | undefined): string | undefined {
  return path === undefined ? undefined : normalizeRequiredProjectPath(path, 'update');
}

function resolveProjectSummaryRootPath(
  rootPath: string | null | undefined,
  fallbackRootPath: string | undefined,
): string | undefined {
  const normalizedRootPath = rootPath?.trim();
  if (!normalizedRootPath) {
    return fallbackRootPath;
  }

  if (!isAbsoluteProjectPath(normalizedRootPath)) {
    throw new Error('Project root path must be an absolute path.');
  }

  return normalizedRootPath;
}

function omitProjectRootPathShadow(
  projectRecord: BirdCoderRepresentativeProjectRecord,
): BirdCoderRepresentativeProjectRecord {
  const { rootPath, ...projectRecordWithoutRootPath } = projectRecord;
  void rootPath;
  return projectRecordWithoutRootPath;
}

function cloneCodingSession(value: BirdCoderCodingSession): BirdCoderCodingSession {
  return structuredClone(value);
}

function cloneCodingSessionForProjectRecord(
  value: BirdCoderCodingSession,
): BirdCoderCodingSession {
  if (value.messages.length === 0) {
    return {
      ...value,
      messages: [],
    };
  }

  return cloneCodingSession(value);
}

function cloneChatMessage(value: BirdCoderChatMessage): BirdCoderChatMessage {
  return structuredClone(value);
}

function buildCodingSessionScopedCacheKey(projectId: string, codingSessionId: string): string {
  return `${projectId}\u0001${codingSessionId}`;
}

function appendCodingSessionMessageByCopy(
  messages: readonly BirdCoderChatMessage[],
  message: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const nextMessages = messages.slice();
  nextMessages.push(message);
  return nextMessages;
}

function replaceCodingSessionMessageAtIndex(
  messages: readonly BirdCoderChatMessage[],
  index: number,
  message: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const nextMessages = messages.slice();
  nextMessages[index] = message;
  return nextMessages;
}

function removeCodingSessionMessageAtIndex(
  messages: readonly BirdCoderChatMessage[],
  index: number,
): BirdCoderChatMessage[] {
  const nextMessages = messages.slice();
  nextMessages.splice(index, 1);
  return nextMessages;
}

interface CachedCodingSessionMessageIndex {
  messages: readonly BirdCoderChatMessage[];
  messageIndexesById: Map<string, number>;
  messageIndexesByLogicalKey: Map<string, number>;
  messageIndexesBySynchronizationSignature: Map<string, number>;
}

function normalizeCodingSessionMessageId(messageId: string | null | undefined): string | null {
  const normalizedMessageId = messageId?.trim() ?? '';
  return normalizedMessageId || null;
}

function rememberCodingSessionMessageIndexEntry(
  index: CachedCodingSessionMessageIndex,
  message: BirdCoderChatMessage,
  messageIndex: number,
): void {
  const normalizedMessageId = normalizeCodingSessionMessageId(message.id);
  if (normalizedMessageId) {
    index.messageIndexesById.set(normalizedMessageId, messageIndex);
  }
  index.messageIndexesByLogicalKey.set(
    buildBirdCoderChatMessageLogicalMatchKey(message),
    messageIndex,
  );
  index.messageIndexesBySynchronizationSignature.set(
    buildBirdCoderChatMessageSynchronizationSignature(message),
    messageIndex,
  );
}

function forgetCodingSessionMessageIndexEntry(
  index: CachedCodingSessionMessageIndex,
  message: BirdCoderChatMessage,
  messageIndex: number,
): void {
  const normalizedMessageId = normalizeCodingSessionMessageId(message.id);
  if (normalizedMessageId && index.messageIndexesById.get(normalizedMessageId) === messageIndex) {
    index.messageIndexesById.delete(normalizedMessageId);
  }

  const logicalMatchKey = buildBirdCoderChatMessageLogicalMatchKey(message);
  if (index.messageIndexesByLogicalKey.get(logicalMatchKey) === messageIndex) {
    index.messageIndexesByLogicalKey.delete(logicalMatchKey);
  }

  const synchronizationSignature = buildBirdCoderChatMessageSynchronizationSignature(message);
  if (
    index.messageIndexesBySynchronizationSignature.get(synchronizationSignature) === messageIndex
  ) {
    index.messageIndexesBySynchronizationSignature.delete(synchronizationSignature);
  }
}

function indexCodingSessionMessages(
  messages: readonly BirdCoderChatMessage[],
): CachedCodingSessionMessageIndex {
  const index: CachedCodingSessionMessageIndex = {
    messages,
    messageIndexesById: new Map<string, number>(),
    messageIndexesByLogicalKey: new Map<string, number>(),
    messageIndexesBySynchronizationSignature: new Map<string, number>(),
  };

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex]!;
    rememberCodingSessionMessageIndexEntry(index, message, messageIndex);
  }

  return index;
}

function findCachedCodingSessionMessageIndexById(
  index: CachedCodingSessionMessageIndex,
  messageId: string | null | undefined,
): number | undefined {
  const normalizedMessageId = normalizeCodingSessionMessageId(messageId);
  return normalizedMessageId
    ? index.messageIndexesById.get(normalizedMessageId)
    : undefined;
}

function findMatchingCachedCodingSessionMessageIndex(
  index: CachedCodingSessionMessageIndex,
  incomingMessage: BirdCoderChatMessage,
): number | undefined {
  const exactMessageIndex = findCachedCodingSessionMessageIndexById(
    index,
    incomingMessage.id,
  );
  if (exactMessageIndex !== undefined) {
    return exactMessageIndex;
  }

  const synchronizationSignature = buildBirdCoderChatMessageSynchronizationSignature(
    incomingMessage,
  );
  const synchronizationMessageIndex =
    index.messageIndexesBySynchronizationSignature.get(synchronizationSignature);
  if (synchronizationMessageIndex !== undefined) {
    return synchronizationMessageIndex;
  }

  return index.messageIndexesByLogicalKey.get(
    buildBirdCoderChatMessageLogicalMatchKey(incomingMessage),
  );
}

function appendCachedCodingSessionMessageIndex(
  index: CachedCodingSessionMessageIndex,
  nextMessages: readonly BirdCoderChatMessage[],
  message: BirdCoderChatMessage,
): CachedCodingSessionMessageIndex {
  index.messages = nextMessages;
  rememberCodingSessionMessageIndexEntry(index, message, nextMessages.length - 1);
  return index;
}

function replaceCachedCodingSessionMessageIndexEntry(
  index: CachedCodingSessionMessageIndex,
  nextMessages: readonly BirdCoderChatMessage[],
  previousMessage: BirdCoderChatMessage,
  nextMessage: BirdCoderChatMessage,
  messageIndex: number,
): CachedCodingSessionMessageIndex {
  forgetCodingSessionMessageIndexEntry(index, previousMessage, messageIndex);
  index.messages = nextMessages;
  rememberCodingSessionMessageIndexEntry(index, nextMessage, messageIndex);
  return index;
}

function removeCachedCodingSessionMessageIndexEntry(
  index: CachedCodingSessionMessageIndex,
  nextMessages: readonly BirdCoderChatMessage[],
  removedMessage: BirdCoderChatMessage,
  removedMessageIndex: number,
): CachedCodingSessionMessageIndex {
  forgetCodingSessionMessageIndexEntry(index, removedMessage, removedMessageIndex);
  index.messages = nextMessages;

  for (let messageIndex = removedMessageIndex; messageIndex < nextMessages.length; messageIndex += 1) {
    const message = nextMessages[messageIndex]!;
    rememberCodingSessionMessageIndexEntry(index, message, messageIndex);
  }

  return index;
}

function buildCachedCodingSessionTranscript(
  codingSession: BirdCoderCodingSession,
): BirdCoderCodingSession {
  return {
    ...codingSession,
    messages: codingSession.messages.map((message) => cloneChatMessage(message)),
  };
}

function parseOptionalTranscriptTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return Number.NaN;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

function resolveLatestTranscriptTimestampCandidate(
  ...candidates: Array<string | null | undefined>
): string | null {
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let latestCandidate: string | null = null;

  for (const candidate of candidates) {
    const normalizedCandidate = candidate?.trim() ?? '';
    if (!normalizedCandidate) {
      continue;
    }

    const parsedTimestamp = parseOptionalTranscriptTimestamp(normalizedCandidate);
    if (Number.isNaN(parsedTimestamp)) {
      if (!latestCandidate) {
        latestCandidate = normalizedCandidate;
      }
      continue;
    }

    if (parsedTimestamp >= latestTimestamp) {
      latestTimestamp = parsedTimestamp;
      latestCandidate = normalizedCandidate;
    }
  }

  return latestCandidate;
}

function isCachedCodingSessionTranscriptFresh(
  codingSession: BirdCoderCodingSession,
  options?: GetCodingSessionTranscriptOptions,
): boolean {
  const expectedTranscriptUpdatedAt = options?.expectedTranscriptUpdatedAt?.trim() ?? '';
  if (!expectedTranscriptUpdatedAt) {
    return true;
  }

  const cachedTranscriptUpdatedAt = codingSession.transcriptUpdatedAt?.trim() ?? '';
  if (!cachedTranscriptUpdatedAt) {
    return false;
  }

  const expectedTimestamp = parseOptionalTranscriptTimestamp(expectedTranscriptUpdatedAt);
  const cachedTimestamp = parseOptionalTranscriptTimestamp(cachedTranscriptUpdatedAt);
  if (Number.isNaN(expectedTimestamp) || Number.isNaN(cachedTimestamp)) {
    return cachedTranscriptUpdatedAt === expectedTranscriptUpdatedAt;
  }

  return cachedTimestamp >= expectedTimestamp;
}

function freezeReadonlySnapshot<TValue>(value: TValue, seenObjects = new WeakSet<object>()): TValue {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (seenObjects.has(value)) {
    return value;
  }
  seenObjects.add(value);

  for (const key of Reflect.ownKeys(value)) {
    freezeReadonlySnapshot((value as Record<PropertyKey, unknown>)[key], seenObjects);
  }

  return Object.freeze(value);
}

function buildReadonlyCodingSessionTranscriptSnapshot(
  codingSession: BirdCoderCodingSession,
  options: {
    cloneMessages?: boolean;
  } = {},
): BirdCoderCodingSession {
  const messages =
    options.cloneMessages === false
      ? codingSession.messages
      : codingSession.messages.map((message) => cloneChatMessage(message));
  return freezeReadonlySnapshot({
    ...codingSession,
    messages,
  });
}

function buildPublicCodingSessionTranscriptVersionKey(
  codingSession: BirdCoderCodingSession,
): string {
  return [
    codingSession.workspaceId,
    codingSession.projectId,
    codingSession.id,
    codingSession.title,
    codingSession.status,
    codingSession.hostMode,
    codingSession.engineId,
    codingSession.modelId,
    codingSession.nativeSessionId ?? '',
    codingSession.createdAt,
    codingSession.updatedAt,
    codingSession.lastTurnAt ?? '',
    codingSession.sortTimestamp ?? '',
    codingSession.transcriptUpdatedAt ?? '',
    codingSession.displayTime ?? '',
    codingSession.pinned === true ? '1' : '0',
    codingSession.archived === true ? '1' : '0',
    codingSession.unread === true ? '1' : '0',
    String(codingSession.messages.length),
    codingSession.messages[0]?.id ?? '',
    codingSession.messages[codingSession.messages.length - 1]?.id ?? '',
  ].join('\u0002');
}

function sanitizeCodingSessionMessageUpdates(
  updates: Partial<BirdCoderChatMessage>,
): Partial<BirdCoderChatMessage> {
  const {
    codingSessionId: _codingSessionId,
    createdAt: _createdAt,
    id: _id,
    role: _role,
    turnId: _turnId,
    ...editableUpdates
  } = updates;
  void _codingSessionId;
  void _createdAt;
  void _id;
  void _role;
  void _turnId;
  return editableUpdates;
}

interface SortableCodingSessionLike {
  id: string;
  updatedAt: string;
  createdAt?: string;
  lastTurnAt?: string;
  sortTimestamp?: string;
  transcriptUpdatedAt?: string | null;
}

function compareCodingSessionsByActivity<TSession extends SortableCodingSessionLike>(
  left: TSession,
  right: TSession,
): number {
  return (
    compareBirdCoderSessionSortTimestamp(right, left) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function sortCodingSessionsByActivity<TSession extends SortableCodingSessionLike>(
  sessions: readonly TSession[],
): TSession[] {
  return [...sessions].sort(compareCodingSessionsByActivity);
}

function indexCodingSessionsById(
  sessions: readonly BirdCoderCodingSession[],
): Map<string, BirdCoderCodingSession> {
  const sessionsById = new Map<string, BirdCoderCodingSession>();
  for (const session of sessions) {
    sessionsById.set(session.id, session);
  }
  return sessionsById;
}

function indexCodingSessionPositionsById(
  sessions: readonly BirdCoderCodingSession[],
): Map<string, number> {
  const sessionPositionsById = new Map<string, number>();
  for (let index = 0; index < sessions.length; index += 1) {
    sessionPositionsById.set(sessions[index]!.id, index);
  }
  return sessionPositionsById;
}

function findCodingSessionActivityInsertionIndex<TSession extends SortableCodingSessionLike>(
  sessions: readonly TSession[],
  nextSession: TSession,
): number {
  let lowerBound = 0;
  let upperBound = sessions.length;

  while (lowerBound < upperBound) {
    const middleIndex = Math.floor((lowerBound + upperBound) / 2);
    const middleSession = sessions[middleIndex]!;
    if (compareCodingSessionsByActivity(nextSession, middleSession) <= 0) {
      upperBound = middleIndex;
    } else {
      lowerBound = middleIndex + 1;
    }
  }

  return lowerBound;
}

function canReplaceCodingSessionAtActivityIndex<TSession extends SortableCodingSessionLike>(
  sessions: readonly TSession[],
  nextSession: TSession,
  existingIndex?: number,
): existingIndex is number {
  if (
    typeof existingIndex !== 'number' ||
    existingIndex < 0 ||
    existingIndex >= sessions.length ||
    sessions[existingIndex]?.id !== nextSession.id
  ) {
    return false;
  }

  const previousSession = existingIndex > 0 ? sessions[existingIndex - 1] : undefined;
  const nextNeighborSession =
    existingIndex + 1 < sessions.length ? sessions[existingIndex + 1] : undefined;

  return (
    (!previousSession || compareCodingSessionsByActivity(previousSession, nextSession) <= 0) &&
    (!nextNeighborSession || compareCodingSessionsByActivity(nextSession, nextNeighborSession) <= 0)
  );
}

function upsertCodingSessionByActivity<TSession extends SortableCodingSessionLike>(
  sessions: readonly TSession[],
  nextSession: TSession,
  existingIndex?: number,
): TSession[] {
  if (canReplaceCodingSessionAtActivityIndex(sessions, nextSession, existingIndex)) {
    const nextSessions = sessions.slice();
    nextSessions[existingIndex] = nextSession;
    return nextSessions;
  }

  const nextSessions = sessions.slice();
  if (
    typeof existingIndex === 'number' &&
    existingIndex >= 0 &&
    existingIndex < nextSessions.length &&
    nextSessions[existingIndex]?.id === nextSession.id
  ) {
    nextSessions.splice(existingIndex, 1);
  }
  const insertionIndex = findCodingSessionActivityInsertionIndex(
    nextSessions,
    nextSession,
  );
  nextSessions.splice(insertionIndex, 0, nextSession);
  return nextSessions;
}

function findLatestTranscriptTimestamp(
  messages: readonly Pick<BirdCoderChatMessage, 'createdAt'>[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (typeof message.createdAt === 'string' && !Number.isNaN(Date.parse(message.createdAt))) {
      return message.createdAt;
    }
  }

  return null;
}

function findLatestNativeTranscriptTimestamp(
  messages: readonly Pick<BirdCoderChatMessage, 'createdAt' | 'id'>[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.id.includes(CODEX_NATIVE_MESSAGE_ID_SEGMENT) &&
      typeof message.createdAt === 'string' &&
      !Number.isNaN(Date.parse(message.createdAt))
    ) {
      return message.createdAt;
    }
  }

  return null;
}

function createCodingSession(
  projectRecord: BirdCoderRepresentativeProjectRecord,
  title: string,
  options: CreateCodingSessionOptions,
): BirdCoderCodingSession {
  const createdAt = createTimestamp();
  const sortTimestamp = stringifyBirdCoderLongInteger(Date.parse(createdAt));
  const selection = resolveRequiredCodingSessionSelection(options);

  return {
    id: createIdentifier('coding-session'),
    workspaceId: projectRecord.workspaceId,
    projectId: projectRecord.id,
    title: title.trim() || 'New Session',
    status: 'active',
    hostMode: options.hostMode ?? 'desktop',
    engineId: selection.engineId,
    modelId: selection.modelId,
    createdAt,
    updatedAt: createdAt,
    lastTurnAt: createdAt,
    sortTimestamp,
    transcriptUpdatedAt: null,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      createdAt,
      lastTurnAt: createdAt,
      sortTimestamp,
      updatedAt: createdAt,
    }),
    pinned: false,
    archived: false,
    unread: false,
    messages: [],
  };
}

function createChatMessage(
  codingSessionId: string,
  message: CreateCodingSessionMessageInput,
): BirdCoderChatMessage {
  const normalizedMessageId = message.id?.trim();
  const normalizedCreatedAt =
    typeof message.createdAt === 'string' &&
    message.createdAt.trim().length > 0 &&
    !Number.isNaN(Date.parse(message.createdAt))
      ? message.createdAt
      : createTimestamp();
  return {
    id: normalizedMessageId || createIdentifier('message'),
    codingSessionId,
    turnId: message.turnId,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: normalizedCreatedAt,
    timestamp: message.timestamp ?? Date.parse(normalizedCreatedAt),
    name: message.name,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
    fileChanges: message.fileChanges,
    commands: message.commands,
    taskProgress: message.taskProgress,
  };
}

function deduplicateCodingSessionMessages(
  messages: readonly BirdCoderChatMessage[],
  options: {
    cloneMessages?: boolean;
  } = {},
): BirdCoderChatMessage[] {
  const deduplicatedMessages = deduplicateBirdCoderComparableChatMessages(messages);
  if (options.cloneMessages === false) {
    return [...deduplicatedMessages];
  }

  return deduplicatedMessages.map((message) => cloneChatMessage(message));
}

export interface ProviderBackedProjectServiceOptions {
  codingSessionRepositories?: BirdCoderCodingSessionRepositories;
  defaultOwnerUserId?: string;
  evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  projectContentRepository: BirdCoderProjectContentRepository;
  repository: BirdCoderProjectRepository;
}

export class ProviderBackedProjectService implements IProjectService, IProjectSessionMirror {
  private readonly codingSessionRepositories?: BirdCoderCodingSessionRepositories;
  private readonly defaultOwnerUserId: string;
  private readonly evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  private readonly projectContentRepository: BirdCoderProjectContentRepository;
  private readonly publicTranscriptSnapshotsBySessionKey = new Map<
    string,
    {
      snapshot: BirdCoderCodingSession;
      versionKey: string;
    }
  >();
  private readonly repository: BirdCoderProjectRepository;
  private readonly sessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();
  private readonly sessionIndexesByProjectId = new Map<string, Map<string, BirdCoderCodingSession>>();
  private readonly sessionPositionsByProjectId = new Map<string, Map<string, number>>();
  private readonly messageIndexesBySessionKey = new Map<string, CachedCodingSessionMessageIndex>();
  private readonly locallyMutatedTranscriptSessionKeys = new Set<string>();

  constructor({
    codingSessionRepositories,
    defaultOwnerUserId = BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
    evidenceRepositories,
    projectContentRepository,
    repository,
  }: ProviderBackedProjectServiceOptions) {
    this.codingSessionRepositories = codingSessionRepositories;
    this.defaultOwnerUserId = defaultOwnerUserId;
    this.evidenceRepositories = evidenceRepositories;
    this.projectContentRepository = projectContentRepository;
    this.repository = repository;
  }

  invalidateProjectReadCache(): void {
    // Provider-backed project reads are already served from the local authority.
  }

  private async listProjectRecordsByWorkspaceId(
    workspaceId: string,
  ): Promise<BirdCoderRepresentativeProjectRecord[]> {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return [];
    }

    if (this.repository.listProjectsByWorkspaceIds) {
      return this.repository.listProjectsByWorkspaceIds([normalizedWorkspaceId]);
    }

    return (await this.repository.list()).filter(
      (record) => record.workspaceId === normalizedWorkspaceId,
    );
  }

  private async findProjectContentByProjectId(
    projectId: string,
  ): Promise<BirdCoderProjectContentRecord | null> {
    const directProjectContent = await this.projectContentRepository.findById(projectId);
    if (directProjectContent?.projectId === projectId) {
      return directProjectContent;
    }

    return (
      (await this.projectContentRepository.list()).find(
        (content) => content.projectId === projectId,
      ) ?? null
    );
  }

  private async resolveProjectRootPathsById(
    projectIds: readonly string[],
  ): Promise<Map<string, string>> {
    const rootPathsByProjectId = new Map<string, string>();
    if (projectIds.length === 0) {
      return rootPathsByProjectId;
    }

    if (projectIds.length === 1) {
      const projectContent = await this.projectContentRepository.findById(projectIds[0]!);
      if (projectContent?.projectId === projectIds[0]) {
        const rootPath = readBirdCoderProjectRootPathFromConfigData(projectContent.configData);
        if (rootPath) {
          rootPathsByProjectId.set(projectContent.projectId, rootPath);
          return rootPathsByProjectId;
        }
      }
    }

    const projectContents = this.projectContentRepository.listProjectContentsByProjectIds
      ? await this.projectContentRepository.listProjectContentsByProjectIds(projectIds)
      : await this.projectContentRepository.list();
    const projectIdSet = new Set(projectIds);
    for (const projectContent of projectContents) {
      if (!projectIdSet.has(projectContent.projectId)) {
        continue;
      }

      const rootPath = readBirdCoderProjectRootPathFromConfigData(projectContent.configData);
      if (rootPath && !rootPathsByProjectId.has(projectContent.projectId)) {
        rootPathsByProjectId.set(projectContent.projectId, rootPath);
      }
    }

    return rootPathsByProjectId;
  }

  private async hydrateProjectRecords(
    records: readonly BirdCoderRepresentativeProjectRecord[],
  ): Promise<BirdCoderRepresentativeProjectRecord[]> {
    const rootPathsByProjectId = await this.resolveProjectRootPathsById(
      records.map((record) => record.id),
    );
    return records.map((record) => {
      const projectRecord = omitProjectRootPathShadow(record);
      const rootPath = rootPathsByProjectId.get(record.id);
      return rootPath
        ? {
            ...projectRecord,
            rootPath,
          }
        : projectRecord;
    });
  }

  private async hydrateProjectRecord(
    record: BirdCoderRepresentativeProjectRecord,
  ): Promise<BirdCoderRepresentativeProjectRecord> {
    return (await this.hydrateProjectRecords([record]))[0] ?? record;
  }

  private async upsertProjectRootPathContent(
    record: BirdCoderRepresentativeProjectRecord,
    rootPath: string | undefined,
  ): Promise<void> {
    const normalizedRootPath = rootPath?.trim();
    if (!normalizedRootPath) {
      return;
    }

    const existingContent = await this.findProjectContentByProjectId(record.id);
    await this.projectContentRepository.save({
      id: existingContent?.id ?? record.id,
      uuid: existingContent?.uuid ?? createUuid(),
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      dataScope: record.dataScope,
      userId: record.userId ?? record.createdByUserId ?? record.ownerId,
      parentId: record.parentId ?? '0',
      projectId: record.id,
      projectUuid: record.uuid ?? existingContent?.projectUuid ?? `project-${record.id}`,
      configData: buildBirdCoderProjectContentConfigData(normalizedRootPath, {
        existingConfigData: existingContent?.configData,
      }),
      contentData: existingContent?.contentData,
      metadata: existingContent?.metadata,
      contentVersion: existingContent?.contentVersion ?? '1.0',
      contentHash: existingContent?.contentHash,
      createdAt: existingContent?.createdAt ?? record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private async deleteProjectRootPathContent(projectId: string): Promise<void> {
    const projectContent = await this.findProjectContentByProjectId(projectId);
    if (projectContent) {
      await this.projectContentRepository.delete(projectContent.id);
    }
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const filteredRecords = workspaceId
      ? await this.listProjectRecordsByWorkspaceId(workspaceId)
      : await this.repository.list();
    const hydratedRecords = await this.hydrateProjectRecords(filteredRecords);

    const persistedSessionsByProjectId = this.codingSessionRepositories
      ? await this.loadPersistedCodingSessionInventorySnapshot(hydratedRecords.map((record) => record.id))
      : undefined;
    const projects = hydratedRecords.map((record) => {
      const sessions = this.mergeLocallyMutatedTranscriptSessions(
        record.id,
        persistedSessionsByProjectId?.get(record.id) ??
          this.sessionsByProjectId.get(record.id) ??
          [],
      );
      return this.mapProjectRecord(record, sessions, {
        sessionsSortedByActivity: true,
      });
    });
    return projects.sort(compareBirdCoderProjectsByActivity);
  }

  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    const storedRecord = await this.repository.findById(projectId);
    if (!storedRecord) {
      return null;
    }

    const record = await this.hydrateProjectRecord(storedRecord);
    let sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionInventorySnapshot([record.id])).get(record.id) ??
        this.sessionsByProjectId.get(record.id) ??
        []
      : this.sessionsByProjectId.get(record.id) ?? [];
    sessions = this.mergeLocallyMutatedTranscriptSessions(record.id, sessions);
    return this.mapProjectRecord(record, sessions, {
      sessionsSortedByActivity: true,
    });
  }

  async getProjectByPath(workspaceId: string, path: string): Promise<BirdCoderProject | null> {
    const records = await this.hydrateProjectRecords(
      await this.listProjectRecordsByWorkspaceId(workspaceId),
    );
    const record = findMatchingProjectRecordByPath(records, workspaceId, path);
    if (!record) {
      return null;
    }

    let sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionInventorySnapshot([record.id])).get(record.id) ??
        this.sessionsByProjectId.get(record.id) ??
        []
      : this.sessionsByProjectId.get(record.id) ?? [];
    sessions = this.mergeLocallyMutatedTranscriptSessions(record.id, sessions);
    return this.mapProjectRecord(record, sessions, {
      sessionsSortedByActivity: true,
    });
  }

  async getProjectMirrorSnapshots(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]> {
    const filteredRecords = workspaceId
      ? await this.listProjectRecordsByWorkspaceId(workspaceId)
      : await this.repository.list();
    const hydratedRecords = await this.hydrateProjectRecords(filteredRecords);

    const persistedSessionSnapshotsByProjectId = this.codingSessionRepositories
      ? await this.loadPersistedCodingSessionMirrorSnapshot(hydratedRecords.map((record) => record.id))
      : undefined;
    return hydratedRecords
      .map((record) =>
        this.mapProjectRecordToMirrorSnapshot(
          record,
          persistedSessionSnapshotsByProjectId?.get(record.id) ??
            this.mapCodingSessionsToMirrorSnapshots(
              this.sessionsByProjectId.get(record.id) ?? [],
            ),
        ),
      )
      .sort(compareBirdCoderProjectsByActivity);
  }

  async getCodingSessionTranscript(
    projectId: string,
    codingSessionId: string,
    options?: GetCodingSessionTranscriptOptions,
  ): Promise<BirdCoderCodingSession | null> {
    const normalizedProjectId = projectId.trim();
    const normalizedCodingSessionId = codingSessionId.trim();
    if (!normalizedProjectId || !normalizedCodingSessionId) {
      return null;
    }

    const cachedSession = this.getCachedCodingSession(
      normalizedProjectId,
      normalizedCodingSessionId,
    );
    if (
      cachedSession &&
      cachedSession.messages.length > 0 &&
      isCachedCodingSessionTranscriptFresh(cachedSession, options)
    ) {
      return this.resolvePublicCodingSessionTranscriptSnapshot(cachedSession);
    }

    if (this.codingSessionRepositories) {
      const persistedSession = await this.codingSessionRepositories.sessions.findById(
        normalizedCodingSessionId,
      );
      if (persistedSession?.projectId !== normalizedProjectId) {
        return null;
      }
      if (!persistedSession) {
        return null;
      }

      const persistedMessages =
        await this.codingSessionRepositories.listMessagesByCodingSessionIds([
          normalizedCodingSessionId,
        ]);
      const messagesByCodingSessionId = new Map<string, BirdCoderChatMessage[]>();
      messagesByCodingSessionId.set(normalizedCodingSessionId, persistedMessages);

      const hydratedSession = this.mapPersistedCodingSessionRecord(
        persistedSession,
        messagesByCodingSessionId,
        {
          cloneMessages: false,
        },
      );
      this.replaceCachedCodingSession(
        normalizedProjectId,
        buildCachedCodingSessionTranscript(hydratedSession),
        this.sessionsByProjectId.get(normalizedProjectId),
      );
      return this.resolvePublicCodingSessionTranscriptSnapshot(hydratedSession, {
        cloneMessages: false,
      });
    }

    return cachedSession
      ? this.resolvePublicCodingSessionTranscriptSnapshot(cachedSession)
      : null;
  }

  async createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject> {
    const normalizedName = name.trim();
    if (!workspaceId.trim()) {
      throw new Error('Workspace ID is required to create a project');
    }
    if (!normalizedName) {
      throw new Error('Project name is required');
    }
    const normalizedPath = normalizeRequiredProjectPathForCreate(options?.path);

    const existingProjectByPath = await this.findProjectByWorkspaceAndPath(workspaceId, normalizedPath);
    if (existingProjectByPath) {
      const sessions = await this.readProjectSessions(existingProjectByPath.id, {
        refresh: true,
      });
      return this.mapProjectRecord(existingProjectByPath, sessions, {
        sessionsSortedByActivity: true,
      });
    }

    const now = createTimestamp();
    const projectId = createIdentifier('project');
    const projectBusinessName = buildBirdCoderProjectBusinessName({
      name: normalizedName,
      projectId,
    });
    const record = await this.repository.save(omitProjectRootPathShadow({
      id: projectId,
      uuid: createUuid(),
      tenantId: BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
      organizationId: BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
      workspaceId,
      dataScope: 'PRIVATE',
      userId: this.defaultOwnerUserId,
      parentId: '0',
      parentUuid: '0',
      parentMetadata: {},
      code: buildBirdCoderProjectBusinessCode({
        name: normalizedName,
        projectId,
        rootPath: normalizedPath,
      }),
      title: normalizedName,
      name: projectBusinessName,
      description: options?.description?.trim() || undefined,
      rootPath: normalizedPath,
      ownerId: this.defaultOwnerUserId,
      leaderId: this.defaultOwnerUserId,
      createdByUserId: this.defaultOwnerUserId,
      author: this.defaultOwnerUserId,
      type: 'CODE',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }));

    await this.recordTemplateInstantiationEvidence(
      {
        ...record,
        rootPath: normalizedPath,
      },
      options,
    );
    await this.upsertProjectRootPathContent(record, normalizedPath);
    this.setProjectSessionsCache(record.id, []);
    return this.mapProjectRecord(
      {
        ...record,
        rootPath: normalizedPath,
      },
      [],
    );
  }

  async recordProjectCreationEvidence(
    projectId: string,
    options?: CreateProjectOptions,
    projectSnapshot?: Pick<
      BirdCoderProject,
      'createdAt' | 'id' | 'path' | 'updatedAt'
    >,
  ): Promise<void> {
    const record: Pick<
      BirdCoderRepresentativeProjectRecord,
      'createdAt' | 'id' | 'rootPath' | 'updatedAt'
    > = projectSnapshot
      ? {
          id: projectSnapshot.id,
          createdAt: projectSnapshot.createdAt,
          updatedAt: projectSnapshot.updatedAt,
          rootPath: projectSnapshot.path,
        }
      : await this.readProjectRecord(projectId);
    await this.recordTemplateInstantiationEvidence(record, options);
  }

  async syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject> {
    const storedExistingRecord = await this.repository.findById(summary.id);
    const existingRecord = storedExistingRecord
      ? await this.hydrateProjectRecord(storedExistingRecord)
      : null;
    const nextRootPath = resolveProjectSummaryRootPath(
      summary.rootPath,
      existingRecord?.rootPath,
    );
    const record = await this.repository.save(omitProjectRootPathShadow({
      id: summary.id,
      uuid: summary.uuid ?? existingRecord?.uuid ?? createUuid(),
      tenantId: summary.tenantId ?? existingRecord?.tenantId,
      organizationId: summary.organizationId ?? existingRecord?.organizationId,
      dataScope: summary.dataScope ?? existingRecord?.dataScope ?? 'PRIVATE',
      workspaceId: summary.workspaceId,
      workspaceUuid: summary.workspaceUuid ?? existingRecord?.workspaceUuid,
      userId: summary.userId ?? existingRecord?.userId ?? summary.createdByUserId,
      parentId: summary.parentId ?? existingRecord?.parentId ?? '0',
      parentUuid: summary.parentUuid ?? existingRecord?.parentUuid ?? '0',
      parentMetadata: summary.parentMetadata ?? existingRecord?.parentMetadata,
      name: summary.name.trim() || existingRecord?.name || summary.id,
      code: summary.code?.trim() || existingRecord?.code,
      title: summary.title?.trim() || existingRecord?.title || summary.name,
      description: summary.description?.trim() || existingRecord?.description,
      sitePath: summary.sitePath?.trim() || existingRecord?.sitePath,
      domainPrefix: summary.domainPrefix?.trim() || existingRecord?.domainPrefix,
      rootPath: nextRootPath,
      ownerId: summary.ownerId?.trim() || existingRecord?.ownerId,
      leaderId: summary.leaderId?.trim() || existingRecord?.leaderId,
      createdByUserId:
        summary.createdByUserId?.trim() || existingRecord?.createdByUserId,
      author: summary.author?.trim() || existingRecord?.author,
      fileId: summary.fileId ?? existingRecord?.fileId,
      conversationId: summary.conversationId ?? existingRecord?.conversationId,
      type: summary.type?.trim() || existingRecord?.type,
      coverImage: summary.coverImage ?? existingRecord?.coverImage,
      startTime: summary.startTime ?? existingRecord?.startTime,
      endTime: summary.endTime ?? existingRecord?.endTime,
      budgetAmount: summary.budgetAmount ?? existingRecord?.budgetAmount,
      isTemplate: summary.isTemplate ?? existingRecord?.isTemplate,
      status: summary.status,
      createdAt: existingRecord?.createdAt || summary.createdAt || createTimestamp(),
      updatedAt: summary.updatedAt || createTimestamp(),
    }));
    await this.upsertProjectRootPathContent(record, nextRootPath);
    const sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionInventorySnapshot([summary.id])).get(summary.id) ??
        this.sessionsByProjectId.get(summary.id) ??
        []
      : this.sessionsByProjectId.get(summary.id) ?? [];
    return this.mapProjectRecord(
      {
        ...record,
        rootPath: nextRootPath,
      },
      sessions,
      {
        sessionsSortedByActivity: true,
      },
    );
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const record = await this.readProjectRecord(projectId);
    const normalizedName = name.trim();
    await this.repository.save(omitProjectRootPathShadow({
      ...record,
      name: normalizedName
        ? buildBirdCoderProjectBusinessName({
            name: normalizedName,
            projectId: record.id,
          })
        : record.name,
      title: normalizedName || record.title,
      updatedAt: createTimestamp(),
    }));
  }

  async updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void> {
    const record = await this.readProjectRecord(projectId);
    const nextRootPath = normalizeProjectPathForUpdate(updates.path) ?? record.rootPath;
    const conflictingProject = await this.findProjectByWorkspaceAndPath(
      record.workspaceId,
      nextRootPath,
      projectId,
    );
    if (conflictingProject) {
      throw new Error(
        `Workspace already contains project "${conflictingProject.name}" for path "${nextRootPath}".`,
      );
    }

    const updatedRecord = await this.repository.save(omitProjectRootPathShadow({
      ...record,
      name: updates.name?.trim()
        ? buildBirdCoderProjectBusinessName({
            name: updates.name.trim(),
            projectId: record.id,
          })
        : record.name,
      code: updates.code?.trim() || record.code,
      title: updates.title?.trim() || updates.name?.trim() || record.title,
      description: updates.description ?? record.description,
      dataScope: updates.dataScope ?? record.dataScope,
      userId: updates.userId ?? record.userId,
      parentId: updates.parentId ?? record.parentId,
      parentUuid: updates.parentUuid ?? record.parentUuid,
      parentMetadata: updates.parentMetadata ?? record.parentMetadata,
      sitePath: updates.sitePath?.trim() || record.sitePath,
      domainPrefix: updates.domainPrefix?.trim() || record.domainPrefix,
      rootPath: nextRootPath,
      ownerId: updates.ownerId ?? record.ownerId,
      leaderId: updates.leaderId ?? record.leaderId,
      createdByUserId: updates.createdByUserId ?? record.createdByUserId,
      author: updates.author ?? record.author,
      fileId: updates.fileId ?? record.fileId,
      conversationId: updates.conversationId ?? record.conversationId,
      type: updates.type ?? record.type,
      coverImage: updates.coverImage ?? record.coverImage,
      startTime: updates.startTime ?? record.startTime,
      endTime: updates.endTime ?? record.endTime,
      budgetAmount: updates.budgetAmount ?? record.budgetAmount,
      isTemplate: updates.isTemplate ?? record.isTemplate,
      status: updates.archived === true ? 'archived' : updates.archived === false ? 'active' : record.status,
      updatedAt: createTimestamp(),
    }));
    await this.upsertProjectRootPathContent(updatedRecord, nextRootPath);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.repository.delete(projectId);
    await this.deleteProjectRootPathContent(projectId);
    await this.deletePersistedProjectSessions(projectId);
    this.clearProjectSessionsCache(projectId);
    this.clearLocallyMutatedTranscriptSessionsForProject(projectId);
    this.deletePublicTranscriptSnapshotsForProject(projectId);
  }

  private async findProjectByWorkspaceAndPath(
    workspaceId: string,
    path: string | null | undefined,
    excludedProjectId?: string,
  ): Promise<BirdCoderRepresentativeProjectRecord | null> {
    const normalizedPath = normalizeProjectPathForComparison(path);
    if (!normalizedPath) {
      return null;
    }

    const records = await this.hydrateProjectRecords(
      await this.listProjectRecordsByWorkspaceId(workspaceId),
    );
    return (
      records.find((candidate) => {
        if (candidate.workspaceId !== workspaceId || candidate.id === excludedProjectId) {
          return false;
        }

        return normalizeProjectPathForComparison(candidate.rootPath) === normalizedPath;
      }) ?? null
    );
  }

  async createCodingSession(
    projectId: string,
    title: string,
    options: CreateCodingSessionOptions,
  ): Promise<BirdCoderCodingSession> {
    const projectRecord = await this.readProjectRecord(projectId);
    const codingSession = createCodingSession(projectRecord, title, options);
    const sessions = await this.readProjectSessionInventoryCache(projectId, {
      refresh: true,
    });
    this.insertCachedCodingSession(projectId, codingSession, sessions);
    await this.persistCodingSessionSummary(codingSession);
    return cloneCodingSession(codingSession);
  }

  async upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void> {
    await this.readProjectRecord(projectId);
    const sessions = await this.readProjectSessionInventoryCache(projectId, {
      refresh: true,
    });
    let nextCodingSession = cloneCodingSession(codingSession);
    const shouldPreservePersistedTranscript = nextCodingSession.messages.length === 0;
    const existingCodingSession = this.getCachedCodingSession(
      projectId,
      nextCodingSession.id,
    );

    if (shouldPreservePersistedTranscript && existingCodingSession?.messages.length) {
      nextCodingSession.messages = existingCodingSession.messages;
    }
    if (!shouldPreservePersistedTranscript) {
      nextCodingSession.messages = deduplicateCodingSessionMessages(
        nextCodingSession.messages,
      );
      nextCodingSession = this.touchCodingSessionTranscript(nextCodingSession);
    }

    this.replaceCachedCodingSession(projectId, nextCodingSession, sessions);
    if (!shouldPreservePersistedTranscript) {
      this.markLocallyMutatedTranscriptSession(projectId, nextCodingSession.id);
    }
    await this.persistCodingSessionSummary(nextCodingSession);
    if (!shouldPreservePersistedTranscript) {
      await this.replacePersistedCodingSessionMessages(
        nextCodingSession.id,
        nextCodingSession.messages,
      );
    }
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId);
    const nextCodingSession = this.touchCodingSessionMetadata({
      ...codingSession,
      title: title.trim() || codingSession.title,
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    await this.persistCodingSessionSummary(nextCodingSession);
  }

  async updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: UpdateCodingSessionOptions,
  ): Promise<void> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId);
    const nextCodingSession = this.touchCodingSessionMetadata({
      ...codingSession,
      title: updates.title?.trim() || codingSession.title,
      status: updates.archived === true ? 'archived' : updates.status ?? codingSession.status,
      hostMode: updates.hostMode ?? codingSession.hostMode,
      pinned: updates.pinned ?? codingSession.pinned,
      archived: updates.archived ?? codingSession.archived,
      unread: updates.unread ?? codingSession.unread,
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    await this.persistCodingSessionSummary(nextCodingSession);
  }

  async forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession> {
    const sourceSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const forkedSession = cloneCodingSession(sourceSession);
    forkedSession.id = createIdentifier('coding-session');
    forkedSession.title = newTitle?.trim() || `${sourceSession.title} (Fork)`;
    forkedSession.archived = false;
    forkedSession.unread = false;
    forkedSession.pinned = sourceSession.pinned;
    forkedSession.messages = sourceSession.messages.map((message) => ({
      ...cloneChatMessage(message),
      id: createIdentifier('message'),
      codingSessionId: '',
    }));
    const nextForkedSession = this.touchCodingSessionTranscript({
      ...forkedSession,
      messages: forkedSession.messages.map((message) => ({
        ...message,
        codingSessionId: forkedSession.id,
      })),
    });
    const sessions = await this.readProjectSessions(projectId);
    this.insertCachedCodingSession(projectId, nextForkedSession, sessions);
    if (nextForkedSession.messages.length > 0) {
      this.markLocallyMutatedTranscriptSession(projectId, nextForkedSession.id);
    }
    await this.persistCodingSessionSummary(nextForkedSession);
    await this.persistCodingSessionMessages(nextForkedSession.messages);
    return cloneCodingSession(nextForkedSession);
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    const sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionInventorySnapshot([projectId])).get(projectId) ??
        this.sessionsByProjectId.get(projectId) ??
        []
      : await this.readProjectSessions(projectId);
    this.removeCachedCodingSession(projectId, codingSessionId, sessions);
    this.unmarkLocallyMutatedTranscriptSession(projectId, codingSessionId);
    this.publicTranscriptSnapshotsBySessionKey.delete(
      buildCodingSessionScopedCacheKey(projectId, codingSessionId),
    );
    await this.deletePersistedCodingSession(codingSessionId);
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: CreateCodingSessionMessageInput,
  ): Promise<BirdCoderChatMessage> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId);
    const cachedMessageIndex = this.resolveCachedCodingSessionMessageIndex(projectId, codingSession);
    const normalizedMessageId = message.id?.trim();
    if (normalizedMessageId) {
      const existingMessageIndex = findCachedCodingSessionMessageIndexById(
        cachedMessageIndex,
        normalizedMessageId,
      );
      if (existingMessageIndex !== undefined) {
        const existingMessage = codingSession.messages[existingMessageIndex]!;
        return cloneChatMessage(existingMessage);
      }
    }

    const newMessage = createChatMessage(codingSessionId, message);
    const existingLogicalMessageIndex = findMatchingCachedCodingSessionMessageIndex(
      cachedMessageIndex,
      newMessage,
    );
    if (existingLogicalMessageIndex !== undefined) {
      const existingLogicalMessage = codingSession.messages[existingLogicalMessageIndex]!;
      const mergedMessage = mergeBirdCoderComparableChatMessages(
        existingLogicalMessage,
        newMessage,
      );
      if (mergedMessage === existingLogicalMessage) {
        return cloneChatMessage(existingLogicalMessage);
      }

      const nextMessages = replaceCodingSessionMessageAtIndex(
        codingSession.messages,
        existingLogicalMessageIndex,
        mergedMessage,
      );
      const nextMessageIndex = replaceCachedCodingSessionMessageIndexEntry(
        cachedMessageIndex,
        nextMessages,
        existingLogicalMessage,
        mergedMessage,
        existingLogicalMessageIndex,
      );
      const nextCodingSession = this.touchCodingSessionTranscript({
        ...codingSession,
        messages: nextMessages,
      });
      this.replaceCachedCodingSession(projectId, nextCodingSession);
      this.markLocallyMutatedTranscriptSession(projectId, codingSessionId);
      this.setCachedCodingSessionMessageIndex(projectId, codingSessionId, nextMessageIndex);
      await this.persistCodingSessionSummary(nextCodingSession);
      await this.persistCodingSessionMessage(mergedMessage);
      return cloneChatMessage(mergedMessage);
    }

    const nextMessages = appendCodingSessionMessageByCopy(codingSession.messages, newMessage);
    const nextMessageIndex = appendCachedCodingSessionMessageIndex(
      cachedMessageIndex,
      nextMessages,
      newMessage,
    );
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...codingSession,
      messages: nextMessages,
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    this.markLocallyMutatedTranscriptSession(projectId, codingSessionId);
    this.setCachedCodingSessionMessageIndex(projectId, codingSessionId, nextMessageIndex);
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.persistCodingSessionMessage(newMessage);
    await this.recordPromptMessageEvidence(projectId, codingSessionId, newMessage);
    return cloneChatMessage(newMessage);
  }

  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void> {
    const codingSession = await this.findCodingSessionWithTranscript(
      projectId,
      codingSessionId,
    );
    const cachedMessageIndex = this.resolveCachedCodingSessionMessageIndex(projectId, codingSession);
    const messageIndex = findCachedCodingSessionMessageIndexById(
      cachedMessageIndex,
      messageId,
    );
    if (messageIndex === undefined) {
      throw new Error(`Message ${messageId} not found`);
    }

    const message = codingSession.messages[messageIndex]!;
    const editableUpdates = sanitizeCodingSessionMessageUpdates(updates);
    const nextMessage = {
      ...cloneChatMessage(message),
      ...editableUpdates,
    };
    const nextMessages = replaceCodingSessionMessageAtIndex(
      codingSession.messages,
      messageIndex,
      nextMessage,
    );
    const nextMessageIndex = replaceCachedCodingSessionMessageIndexEntry(
      cachedMessageIndex,
      nextMessages,
      message,
      nextMessage,
      messageIndex,
    );
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...codingSession,
      messages: nextMessages,
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    this.markLocallyMutatedTranscriptSession(projectId, codingSessionId);
    this.setCachedCodingSessionMessageIndex(projectId, codingSessionId, nextMessageIndex);
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.persistCodingSessionMessage(nextMessage);
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    const codingSession = await this.findCodingSessionWithTranscript(
      projectId,
      codingSessionId,
    );
    const cachedMessageIndex = this.resolveCachedCodingSessionMessageIndex(projectId, codingSession);
    const messageIndex = findCachedCodingSessionMessageIndexById(
      cachedMessageIndex,
      messageId,
    );
    if (messageIndex === undefined) {
      throw new Error(`Message ${messageId} not found`);
    }

    const message = codingSession.messages[messageIndex]!;
    const nextMessages = removeCodingSessionMessageAtIndex(codingSession.messages, messageIndex);
    const nextMessageIndex = removeCachedCodingSessionMessageIndexEntry(
      cachedMessageIndex,
      nextMessages,
      message,
      messageIndex,
    );
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...codingSession,
      messages: nextMessages,
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    this.markLocallyMutatedTranscriptSession(projectId, codingSessionId);
    this.setCachedCodingSessionMessageIndex(projectId, codingSessionId, nextMessageIndex);
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.deletePersistedCodingSessionMessage(codingSessionId, messageId);
  }

  private mapProjectRecord(
    record: BirdCoderRepresentativeProjectRecord,
    sessions: readonly BirdCoderCodingSession[],
    options: {
      sessionsSortedByActivity?: boolean;
    } = {},
  ): BirdCoderProject {
    const displayName = record.title?.trim() || record.name;
    const normalizedSessions = sessions.map((session) => ({
      ...cloneCodingSessionForProjectRecord(session),
      displayTime: formatBirdCoderSessionActivityDisplayTime(session),
    }));
    if (!options.sessionsSortedByActivity) {
      normalizedSessions.sort(compareCodingSessionsByActivity);
    }

    return {
      id: record.id,
      uuid: record.uuid,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      dataScope: record.dataScope,
      workspaceId: record.workspaceId,
      workspaceUuid: record.workspaceUuid,
      userId: record.userId,
      parentId: record.parentId,
      parentUuid: record.parentUuid,
      parentMetadata: record.parentMetadata,
      code: record.code,
      title: record.title,
      name: displayName,
      description: record.description,
      path: record.rootPath,
      sitePath: record.sitePath,
      domainPrefix: record.domainPrefix,
      ownerId: record.ownerId,
      leaderId: record.leaderId,
      createdByUserId: record.createdByUserId,
      author: record.author,
      fileId: record.fileId,
      conversationId: record.conversationId,
      type: record.type,
      coverImage: record.coverImage,
      startTime: record.startTime,
      endTime: record.endTime,
      budgetAmount: record.budgetAmount,
      isTemplate: record.isTemplate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archived: record.status === 'archived',
      codingSessions: normalizedSessions,
    };
  }

  private markLocallyMutatedTranscriptSession(
    projectId: string,
    codingSessionId: string,
  ): void {
    this.locallyMutatedTranscriptSessionKeys.add(
      buildCodingSessionScopedCacheKey(projectId, codingSessionId),
    );
  }

  private unmarkLocallyMutatedTranscriptSession(
    projectId: string,
    codingSessionId: string,
  ): void {
    this.locallyMutatedTranscriptSessionKeys.delete(
      buildCodingSessionScopedCacheKey(projectId, codingSessionId),
    );
  }

  private clearLocallyMutatedTranscriptSessionsForProject(projectId: string): void {
    const projectSessionKeyPrefix = `${projectId}\u0001`;
    for (const sessionKey of this.locallyMutatedTranscriptSessionKeys) {
      if (sessionKey.startsWith(projectSessionKeyPrefix)) {
        this.locallyMutatedTranscriptSessionKeys.delete(sessionKey);
      }
    }
  }

  private mergeLocallyMutatedTranscriptSessions(
    projectId: string,
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession[] {
    let nextSessions: BirdCoderCodingSession[] | null = null;
    for (let index = 0; index < sessions.length; index += 1) {
      const session = sessions[index]!;
      const sessionKey = buildCodingSessionScopedCacheKey(projectId, session.id);
      if (!this.locallyMutatedTranscriptSessionKeys.has(sessionKey)) {
        continue;
      }

      const cachedSession = this.getCachedCodingSession(projectId, session.id);
      if (!cachedSession) {
        this.locallyMutatedTranscriptSessionKeys.delete(sessionKey);
        continue;
      }

      if (
        (cachedSession.transcriptUpdatedAt ?? null) !==
        (session.transcriptUpdatedAt ?? null)
      ) {
        continue;
      }

      if (!nextSessions) {
        nextSessions = sessions.slice() as BirdCoderCodingSession[];
      }
      nextSessions[index] = {
        ...session,
        messages: cachedSession.messages,
      };
    }

    return nextSessions ?? (sessions as BirdCoderCodingSession[]);
  }

  private mapCodingSessionsToMirrorSnapshots(
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSessionMirrorSnapshot[] {
    const snapshots = sessions.map((session) => {
      const transcriptUpdatedAt =
        session.transcriptUpdatedAt ?? findLatestTranscriptTimestamp(session.messages);
      return {
        id: session.id,
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        title: session.title,
        status: session.status,
        hostMode: session.hostMode,
        engineId: session.engineId,
        modelId: session.modelId,
        nativeSessionId: session.nativeSessionId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastTurnAt: session.lastTurnAt,
        sortTimestamp: resolveBirdCoderSessionSortTimestampString(session),
        transcriptUpdatedAt,
        displayTime: formatBirdCoderSessionActivityDisplayTime({
          ...session,
          transcriptUpdatedAt,
        }),
        pinned: session.pinned,
        archived: session.archived,
        unread: session.unread,
        messageCount: session.messages.length,
        nativeTranscriptUpdatedAt: findLatestNativeTranscriptTimestamp(session.messages),
      };
    });
    snapshots.sort(compareCodingSessionsByActivity);
    return snapshots;
  }

  private mapProjectRecordToMirrorSnapshot(
    record: BirdCoderRepresentativeProjectRecord,
    sessions: readonly BirdCoderCodingSessionMirrorSnapshot[],
  ): BirdCoderProjectMirrorSnapshot {
    const displayName = record.title?.trim() || record.name;
    return {
      id: record.id,
      uuid: record.uuid,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      dataScope: record.dataScope,
      workspaceId: record.workspaceId,
      workspaceUuid: record.workspaceUuid,
      userId: record.userId,
      parentId: record.parentId,
      parentUuid: record.parentUuid,
      parentMetadata: record.parentMetadata,
      code: record.code,
      title: record.title,
      name: displayName,
      description: record.description,
      path: record.rootPath,
      sitePath: record.sitePath,
      domainPrefix: record.domainPrefix,
      ownerId: record.ownerId,
      leaderId: record.leaderId,
      createdByUserId: record.createdByUserId,
      author: record.author,
      fileId: record.fileId,
      conversationId: record.conversationId,
      type: record.type,
      coverImage: record.coverImage,
      startTime: record.startTime,
      endTime: record.endTime,
      budgetAmount: record.budgetAmount,
      isTemplate: record.isTemplate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archived: record.status === 'archived',
      codingSessions: sortCodingSessionsByActivity(sessions),
    };
  }

  private async readProjectSessions(
    projectId: string,
    options: {
      refresh?: boolean;
    } = {},
  ): Promise<BirdCoderCodingSession[]> {
    if (this.codingSessionRepositories && options.refresh === true) {
      const refreshedSessions = (await this.loadPersistedCodingSessionsSnapshot([projectId])).get(projectId) ?? [];
      return this.setProjectSessionsCache(projectId, refreshedSessions);
    }

    const sessions = this.sessionsByProjectId.get(projectId);
    if (sessions) {
      return sessions;
    }

    const nextSessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionsSnapshot([projectId])).get(projectId) ?? []
      : [];
    return this.setProjectSessionsCache(projectId, nextSessions);
  }

  private async readProjectSessionInventoryCache(
    projectId: string,
    options: {
      refresh?: boolean;
    } = {},
  ): Promise<BirdCoderCodingSession[]> {
    if (this.codingSessionRepositories && options.refresh === true) {
      const inventorySessionsByProjectId =
        await this.loadPersistedCodingSessionInventorySnapshot([projectId]);
      const cachedSessions = this.sessionsByProjectId.get(projectId);
      if (cachedSessions) {
        return cachedSessions;
      }

      return this.setProjectSessionsCache(
        projectId,
        inventorySessionsByProjectId.get(projectId) ?? [],
      );
    }

    const cachedSessions = this.sessionsByProjectId.get(projectId);
    if (cachedSessions) {
      return cachedSessions;
    }

    if (!this.codingSessionRepositories) {
      return this.setProjectSessionsCache(projectId, []);
    }

    const inventorySessionsByProjectId =
      await this.loadPersistedCodingSessionInventorySnapshot([projectId]);
    return (
      this.sessionsByProjectId.get(projectId) ??
      this.setProjectSessionsCache(
        projectId,
        inventorySessionsByProjectId.get(projectId) ?? [],
      )
    );
  }

  private async findCodingSession(
    projectId: string,
    codingSessionId: string,
    options: {
      refresh?: boolean;
    } = {},
  ): Promise<BirdCoderCodingSession> {
    await this.readProjectSessions(projectId, options);
    const codingSession = this.getCachedCodingSession(projectId, codingSessionId);
    if (!codingSession) {
      throw new Error(`Coding session ${codingSessionId} not found`);
    }

    return codingSession;
  }

  private async findCodingSessionWithTranscript(
    projectId: string,
    codingSessionId: string,
  ): Promise<BirdCoderCodingSession> {
    const cachedSession = this.getCachedCodingSession(projectId, codingSessionId);
    if (cachedSession && cachedSession.messages.length > 0) {
      return cachedSession;
    }

    const hydratedSession = await this.getCodingSessionTranscript(projectId, codingSessionId);
    if (hydratedSession) {
      return hydratedSession;
    }

    if (cachedSession) {
      return cachedSession;
    }

    return this.findCodingSession(projectId, codingSessionId);
  }

  private async readProjectRecord(projectId: string): Promise<BirdCoderRepresentativeProjectRecord> {
    const storedRecord = await this.repository.findById(projectId);
    if (!storedRecord) {
      throw new Error(`Project ${projectId} not found`);
    }

    return this.hydrateProjectRecord(storedRecord);
  }

  private applyCodingSessionActivityState(
    codingSession: BirdCoderCodingSession,
    nextState: {
      lastTurnAt?: string;
      transcriptUpdatedAt?: string | null;
      updatedAt: string;
    },
  ): BirdCoderCodingSession {
    const updatedAt = nextState.updatedAt;
    const lastTurnAt = nextState.lastTurnAt ?? codingSession.lastTurnAt;
    const transcriptUpdatedAt =
      nextState.transcriptUpdatedAt ?? codingSession.transcriptUpdatedAt ?? null;
    const sortTimestamp = resolveBirdCoderSessionSortTimestampString({
      ...codingSession,
      updatedAt,
      lastTurnAt,
      transcriptUpdatedAt,
    });
    const displayTime = formatBirdCoderSessionActivityDisplayTime({
      ...codingSession,
      updatedAt,
      lastTurnAt,
      transcriptUpdatedAt,
    });

    return {
      ...codingSession,
      updatedAt,
      lastTurnAt,
      transcriptUpdatedAt,
      sortTimestamp,
      displayTime,
    };
  }

  private touchCodingSessionMetadata(codingSession: BirdCoderCodingSession): BirdCoderCodingSession {
    return this.applyCodingSessionActivityState(codingSession, {
      updatedAt: createTimestamp(),
    });
  }

  private touchCodingSessionTranscript(codingSession: BirdCoderCodingSession): BirdCoderCodingSession {
    const updatedAt = createTimestamp();
    return this.applyCodingSessionActivityState(codingSession, {
      updatedAt,
      lastTurnAt: updatedAt,
      transcriptUpdatedAt: updatedAt,
    });
  }

  private insertCachedCodingSession(
    projectId: string,
    nextCodingSession: BirdCoderCodingSession,
    existingSessions?: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession {
    const currentSessions = existingSessions ?? this.sessionsByProjectId.get(projectId) ?? [];
    const insertionIndex = findCodingSessionActivityInsertionIndex(currentSessions, nextCodingSession);
    const nextSessions = currentSessions.slice();
    nextSessions.splice(insertionIndex, 0, nextCodingSession);
    const currentSessionIndex = this.sessionIndexesByProjectId.get(projectId);
    const currentPositionIndex = this.sessionPositionsByProjectId.get(projectId);
    if (currentSessionIndex && currentPositionIndex) {
      currentSessionIndex.set(nextCodingSession.id, nextCodingSession);
      for (let index = insertionIndex; index < nextSessions.length; index += 1) {
        currentPositionIndex.set(nextSessions[index]!.id, index);
      }
      this.setProjectSessionsCache(projectId, nextSessions, {
        sessionIndexById: currentSessionIndex,
        sessionPositionsById: currentPositionIndex,
      });
    } else {
      this.setProjectSessionsCache(projectId, nextSessions);
    }
    return nextCodingSession;
  }

  private replaceCachedCodingSession(
    projectId: string,
    nextCodingSession: BirdCoderCodingSession,
    existingSessions?: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession {
    const currentSessions = existingSessions ?? this.sessionsByProjectId.get(projectId) ?? [];
    const existingIndex = this.sessionPositionsByProjectId.get(projectId)?.get(nextCodingSession.id);
    const previousCodingSession =
      typeof existingIndex === 'number' &&
      existingIndex >= 0 &&
      existingIndex < currentSessions.length &&
      currentSessions[existingIndex]?.id === nextCodingSession.id
        ? currentSessions[existingIndex]
        : this.sessionIndexesByProjectId.get(projectId)?.get(nextCodingSession.id);
    const canReplaceAtExistingIndex = canReplaceCodingSessionAtActivityIndex(
      currentSessions,
      nextCodingSession,
      existingIndex,
    );
    const nextSessions = upsertCodingSessionByActivity(currentSessions, nextCodingSession, existingIndex);
    const currentSessionIndex = this.sessionIndexesByProjectId.get(projectId);
    const currentPositionIndex = this.sessionPositionsByProjectId.get(projectId);
    if (canReplaceAtExistingIndex && currentSessionIndex && currentPositionIndex) {
      currentSessionIndex.set(nextCodingSession.id, nextCodingSession);
      this.setProjectSessionsCache(projectId, nextSessions, {
        sessionIndexById: currentSessionIndex,
        sessionPositionsById: currentPositionIndex,
      });
    } else {
      this.setProjectSessionsCache(projectId, nextSessions);
    }
    if (previousCodingSession?.messages !== nextCodingSession.messages) {
      this.deleteCachedCodingSessionMessageIndex(projectId, nextCodingSession.id);
    }
    return nextCodingSession;
  }

  private removeCachedCodingSession(
    projectId: string,
    codingSessionId: string,
    existingSessions?: readonly BirdCoderCodingSession[],
  ): void {
    const currentSessions = existingSessions ?? this.sessionsByProjectId.get(projectId) ?? [];
    const existingIndex = this.sessionPositionsByProjectId.get(projectId)?.get(codingSessionId);
    if (
      typeof existingIndex !== 'number' ||
      existingIndex < 0 ||
      existingIndex >= currentSessions.length ||
      currentSessions[existingIndex]?.id !== codingSessionId
    ) {
      return;
    }

    const nextSessions = currentSessions.slice();
    nextSessions.splice(existingIndex, 1);
    const currentSessionIndex = this.sessionIndexesByProjectId.get(projectId);
    const currentPositionIndex = this.sessionPositionsByProjectId.get(projectId);
    if (currentSessionIndex && currentPositionIndex) {
      currentSessionIndex.delete(codingSessionId);
      currentPositionIndex.delete(codingSessionId);
      for (let index = existingIndex; index < nextSessions.length; index += 1) {
        currentPositionIndex.set(nextSessions[index]!.id, index);
      }
      this.setProjectSessionsCache(projectId, nextSessions, {
        sessionIndexById: currentSessionIndex,
        sessionPositionsById: currentPositionIndex,
      });
    } else {
      this.setProjectSessionsCache(projectId, nextSessions);
    }
    this.deleteCachedCodingSessionMessageIndex(projectId, codingSessionId);
  }

  private resolvePublicCodingSessionTranscriptSnapshot(
    codingSession: BirdCoderCodingSession,
    options: {
      cloneMessages?: boolean;
    } = {},
  ): BirdCoderCodingSession {
    const sessionKey = buildCodingSessionScopedCacheKey(
      codingSession.projectId,
      codingSession.id,
    );
    const versionKey = buildPublicCodingSessionTranscriptVersionKey(codingSession);
    const cachedSnapshot = this.publicTranscriptSnapshotsBySessionKey.get(sessionKey);
    if (cachedSnapshot?.versionKey === versionKey) {
      this.publicTranscriptSnapshotsBySessionKey.delete(sessionKey);
      this.publicTranscriptSnapshotsBySessionKey.set(sessionKey, cachedSnapshot);
      return cachedSnapshot.snapshot;
    }

    const snapshot = buildReadonlyCodingSessionTranscriptSnapshot(
      codingSession,
      options,
    );
    this.publicTranscriptSnapshotsBySessionKey.delete(sessionKey);
    this.publicTranscriptSnapshotsBySessionKey.set(sessionKey, {
      snapshot,
      versionKey,
    });

    while (
      this.publicTranscriptSnapshotsBySessionKey.size >
      PUBLIC_TRANSCRIPT_SNAPSHOT_CACHE_MAX_ENTRIES
    ) {
      const oldestSessionKey =
        this.publicTranscriptSnapshotsBySessionKey.keys().next().value;
      if (typeof oldestSessionKey !== 'string') {
        break;
      }
      this.publicTranscriptSnapshotsBySessionKey.delete(oldestSessionKey);
    }

    return snapshot;
  }

  private deletePublicTranscriptSnapshotsForProject(projectId: string): void {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    const projectSessionKeyPrefix = `${normalizedProjectId}\u0001`;
    for (const sessionKey of this.publicTranscriptSnapshotsBySessionKey.keys()) {
      if (sessionKey.startsWith(projectSessionKeyPrefix)) {
        this.publicTranscriptSnapshotsBySessionKey.delete(sessionKey);
      }
    }
  }

  private setProjectSessionsCache(
    projectId: string,
    sessions: readonly BirdCoderCodingSession[],
    options: {
      sessionIndexById?: Map<string, BirdCoderCodingSession>;
      sessionPositionsById?: Map<string, number>;
    } = {},
  ): BirdCoderCodingSession[] {
    const cachedSessions = sessions as BirdCoderCodingSession[];
    this.sessionsByProjectId.set(projectId, cachedSessions);
    this.sessionIndexesByProjectId.set(
      projectId,
      options.sessionIndexById ?? indexCodingSessionsById(cachedSessions),
    );
    this.sessionPositionsByProjectId.set(
      projectId,
      options.sessionPositionsById ?? indexCodingSessionPositionsById(cachedSessions),
    );
    return cachedSessions;
  }

  private clearProjectSessionsCache(projectId: string): void {
    this.sessionsByProjectId.delete(projectId);
    this.sessionIndexesByProjectId.delete(projectId);
    this.sessionPositionsByProjectId.delete(projectId);
    this.deleteCachedCodingSessionMessageIndexesForProject(projectId);
  }

  private getCachedCodingSession(
    projectId: string,
    codingSessionId: string,
  ): BirdCoderCodingSession | null {
    return this.sessionIndexesByProjectId.get(projectId)?.get(codingSessionId) ?? null;
  }

  private setCachedCodingSessionMessageIndex(
    projectId: string,
    codingSessionId: string,
    index: CachedCodingSessionMessageIndex,
  ): void {
    const sessionKey = buildCodingSessionScopedCacheKey(projectId, codingSessionId);
    this.messageIndexesBySessionKey.delete(sessionKey);
    this.messageIndexesBySessionKey.set(sessionKey, index);

    while (
      this.messageIndexesBySessionKey.size > CACHED_CODING_SESSION_MESSAGE_INDEX_MAX_ENTRIES
    ) {
      const oldestSessionKey = this.messageIndexesBySessionKey.keys().next().value;
      if (typeof oldestSessionKey !== 'string') {
        break;
      }
      this.messageIndexesBySessionKey.delete(oldestSessionKey);
    }
  }

  private deleteCachedCodingSessionMessageIndex(
    projectId: string,
    codingSessionId: string,
  ): void {
    this.messageIndexesBySessionKey.delete(
      buildCodingSessionScopedCacheKey(projectId, codingSessionId),
    );
  }

  private deleteCachedCodingSessionMessageIndexesForProject(projectId: string): void {
    const projectSessionKeyPrefix = `${projectId}\u0001`;
    for (const sessionKey of this.messageIndexesBySessionKey.keys()) {
      if (sessionKey.startsWith(projectSessionKeyPrefix)) {
        this.messageIndexesBySessionKey.delete(sessionKey);
      }
    }
  }

  private resolveCachedCodingSessionMessageIndex(
    projectId: string,
    codingSession: BirdCoderCodingSession,
  ): CachedCodingSessionMessageIndex {
    const sessionKey = buildCodingSessionScopedCacheKey(projectId, codingSession.id);
    const cachedIndex = this.messageIndexesBySessionKey.get(sessionKey);
    if (cachedIndex?.messages === codingSession.messages) {
      this.setCachedCodingSessionMessageIndex(projectId, codingSession.id, cachedIndex);
      return cachedIndex;
    }

    const nextIndex = indexCodingSessionMessages(codingSession.messages);
    this.setCachedCodingSessionMessageIndex(projectId, codingSession.id, nextIndex);
    return nextIndex;
  }

  private storeProjectSessions(
    projectId: string,
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession[] {
    const nextSessions = sortCodingSessionsByActivity(sessions);
    return this.setProjectSessionsCache(projectId, nextSessions);
  }

  private async loadPersistedCodingSessionsSnapshot(
    projectIds: readonly string[],
  ): Promise<Map<string, BirdCoderCodingSession[]>> {
    if (!this.codingSessionRepositories) {
      return new Map();
    }

    const projectIdSet = new Set(projectIds);
    const persistedSessions = await this.codingSessionRepositories.listSessionsByProjectIds(
      projectIds,
    );
    const relevantSessions = persistedSessions.filter((session) =>
      projectIdSet.has(session.projectId),
    );
    const codingSessionIdSet = new Set(relevantSessions.map((session) => session.id));
    const persistedMessages =
      await this.codingSessionRepositories.listMessagesByCodingSessionIds(
        [...codingSessionIdSet],
      );
    const messagesByCodingSessionId = new Map<string, BirdCoderChatMessage[]>();
    const sessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();

    for (const message of persistedMessages) {
      const collection = messagesByCodingSessionId.get(message.codingSessionId);
      if (collection) {
        collection.push(cloneChatMessage(message));
      } else {
        messagesByCodingSessionId.set(message.codingSessionId, [cloneChatMessage(message)]);
      }
    }

    for (const session of relevantSessions) {
      if (!projectIdSet.has(session.projectId)) {
        continue;
      }

      const projectSessions = sessionsByProjectId.get(session.projectId);
      const mappedSession = this.mapPersistedCodingSessionRecord(session, messagesByCodingSessionId);
      if (projectSessions) {
        projectSessions.push(mappedSession);
      } else {
        sessionsByProjectId.set(session.projectId, [mappedSession]);
      }
    }

    for (const [projectId, sessions] of sessionsByProjectId) {
      sessions.sort(
        (left, right) =>
          compareBirdCoderSessionSortTimestamp(right, left) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );
      this.setProjectSessionsCache(projectId, sessions);
    }

    return sessionsByProjectId;
  }

  private async loadPersistedCodingSessionInventorySnapshot(
    projectIds: readonly string[],
  ): Promise<Map<string, BirdCoderCodingSession[]>> {
    if (!this.codingSessionRepositories) {
      return new Map();
    }

    const projectIdSet = new Set(projectIds);
    const persistedSessions = await this.codingSessionRepositories.listSessionsByProjectIds(
      projectIds,
    );
    const messageMetadataByCodingSessionId =
      persistedSessions.length > 0
        ? await this.codingSessionRepositories.readMessageMetadataByCodingSessionIds(
            persistedSessions.map((session) => session.id),
          )
        : new Map<string, BirdCoderPersistedCodingSessionMessageMetadata>();
    const cachedSessionsByProjectId = new Map<string, Map<string, BirdCoderCodingSession>>();
    for (const projectId of projectIdSet) {
      const cachedSessionIndex = this.sessionIndexesByProjectId.get(projectId);
      if (!cachedSessionIndex || cachedSessionIndex.size === 0) {
        continue;
      }

      cachedSessionsByProjectId.set(projectId, cachedSessionIndex);
    }

    const inventorySessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();
    const cachedInventorySessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();
    const hasCachedTranscriptReuseByProjectId = new Map<string, boolean>();

    for (const session of persistedSessions) {
      if (!projectIdSet.has(session.projectId)) {
        continue;
      }

      const metadata = messageMetadataByCodingSessionId.get(session.id);
      const latestTranscriptUpdatedAt = resolveLatestTranscriptTimestampCandidate(
        session.transcriptUpdatedAt,
        metadata?.latestTranscriptUpdatedAt,
      );
      const inventorySession = this.mapPersistedCodingSessionRecord(
        {
          ...session,
          transcriptUpdatedAt: latestTranscriptUpdatedAt,
        },
        EMPTY_PERSISTED_CODING_SESSION_MESSAGES_BY_ID,
      );
      const cachedSession = cachedSessionsByProjectId
        .get(session.projectId)
        ?.get(session.id);
      const canReuseCachedTranscript =
        Boolean(cachedSession && cachedSession.messages.length > 0) &&
        (cachedSession?.transcriptUpdatedAt ?? null) ===
          (inventorySession.transcriptUpdatedAt ?? null);
      if (canReuseCachedTranscript) {
        hasCachedTranscriptReuseByProjectId.set(session.projectId, true);
      }
      const cacheSession =
        canReuseCachedTranscript && cachedSession
          ? {
              ...inventorySession,
              messages: cachedSession.messages,
            }
          : inventorySession;

      const projectInventorySessions =
        inventorySessionsByProjectId.get(session.projectId) ?? [];
      projectInventorySessions.push(inventorySession);
      inventorySessionsByProjectId.set(session.projectId, projectInventorySessions);

      const projectCachedInventorySessions =
        cachedInventorySessionsByProjectId.get(session.projectId) ?? [];
      projectCachedInventorySessions.push(cacheSession);
      cachedInventorySessionsByProjectId.set(
        session.projectId,
        projectCachedInventorySessions,
      );
    }

    for (const [projectId, sessions] of inventorySessionsByProjectId) {
      sessions.sort(compareCodingSessionsByActivity);
      if (hasCachedTranscriptReuseByProjectId.get(projectId) === true) {
        const cacheSessions =
          cachedInventorySessionsByProjectId.get(projectId) ?? sessions;
        cacheSessions.sort(compareCodingSessionsByActivity);
        this.setProjectSessionsCache(projectId, cacheSessions);
      } else {
        this.setProjectSessionsCache(projectId, sessions);
      }
    }

    return inventorySessionsByProjectId;
  }

  private async loadPersistedCodingSessionMirrorSnapshot(
    projectIds: readonly string[],
  ): Promise<Map<string, BirdCoderCodingSessionMirrorSnapshot[]>> {
    if (!this.codingSessionRepositories) {
      return new Map();
    }

    const relevantSessions =
      await this.codingSessionRepositories.listSessionsByProjectIds(projectIds);
    const messageMetadataByCodingSessionId =
      await this.codingSessionRepositories.readMessageMetadataByCodingSessionIds(
        relevantSessions.map((session) => session.id),
      );

    const sessionsByProjectId = new Map<string, BirdCoderCodingSessionMirrorSnapshot[]>();
    for (const session of relevantSessions) {
      const metadata: BirdCoderPersistedCodingSessionMessageMetadata | undefined =
        messageMetadataByCodingSessionId.get(session.id);
      const projectSessions = sessionsByProjectId.get(session.projectId) ?? [];
      projectSessions.push({
        id: session.id,
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        title: session.title,
        status: session.status,
        hostMode: session.hostMode,
        engineId: session.engineId,
        modelId: session.modelId,
        nativeSessionId: session.nativeSessionId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastTurnAt: session.lastTurnAt,
        sortTimestamp: resolveBirdCoderSessionSortTimestampString(session),
        transcriptUpdatedAt:
          session.transcriptUpdatedAt ?? metadata?.latestTranscriptUpdatedAt ?? null,
        displayTime: formatBirdCoderSessionActivityDisplayTime({
          ...session,
          transcriptUpdatedAt:
            session.transcriptUpdatedAt ?? metadata?.latestTranscriptUpdatedAt ?? null,
        }),
        pinned: session.pinned,
        archived: session.archived,
        unread: session.unread,
        messageCount: metadata?.messageCount ?? 0,
        nativeTranscriptUpdatedAt: metadata?.nativeTranscriptUpdatedAt ?? null,
      });
      sessionsByProjectId.set(session.projectId, projectSessions);
    }

    for (const [projectId, sessions] of sessionsByProjectId) {
      sessions.sort(
        (left, right) =>
          compareBirdCoderSessionSortTimestamp(right, left) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );
      sessionsByProjectId.set(projectId, sessions);
    }

    return sessionsByProjectId;
  }

  private mapPersistedCodingSessionRecord(
    session: BirdCoderPersistedCodingSessionRecord,
    messagesByCodingSessionId: ReadonlyMap<string, BirdCoderChatMessage[]>,
    options: {
      cloneMessages?: boolean;
    } = {},
  ): BirdCoderCodingSession {
    const messages = deduplicateCodingSessionMessages(
      messagesByCodingSessionId.get(session.id) ?? [],
      {
        cloneMessages: options.cloneMessages,
      },
    );
    const transcriptUpdatedAt = resolveLatestTranscriptTimestampCandidate(
      session.transcriptUpdatedAt,
      findLatestTranscriptTimestamp(messages),
    );

    return {
      id: session.id,
      workspaceId: session.workspaceId,
      projectId: session.projectId,
      title: session.title,
      status: session.status,
      hostMode: session.hostMode,
      engineId: session.engineId,
      modelId: session.modelId,
      nativeSessionId: session.nativeSessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastTurnAt: session.lastTurnAt,
      sortTimestamp: resolveBirdCoderSessionSortTimestampString(session),
      transcriptUpdatedAt,
      displayTime: formatBirdCoderSessionActivityDisplayTime({
        ...session,
        transcriptUpdatedAt,
      }),
      pinned: session.pinned,
      archived: session.archived,
      unread: session.unread,
      messages,
    };
  }

  private toPersistedCodingSessionRecord(
    codingSession: BirdCoderCodingSession,
  ): BirdCoderPersistedCodingSessionRecord {
    return {
      id: codingSession.id,
      workspaceId: codingSession.workspaceId,
      projectId: codingSession.projectId,
      title: codingSession.title,
      status: codingSession.status,
      hostMode: codingSession.hostMode,
      engineId: codingSession.engineId,
      modelId: codingSession.modelId,
      nativeSessionId: codingSession.nativeSessionId,
      createdAt: codingSession.createdAt,
      updatedAt: codingSession.updatedAt,
      lastTurnAt: codingSession.lastTurnAt,
      sortTimestamp: resolveBirdCoderSessionSortTimestampString(codingSession),
      transcriptUpdatedAt: codingSession.transcriptUpdatedAt ?? null,
      pinned: codingSession.pinned === true,
      archived: codingSession.archived === true || codingSession.status === 'archived',
      unread: codingSession.unread === true,
    };
  }

  private async persistCodingSessionSummary(codingSession: BirdCoderCodingSession): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    await this.codingSessionRepositories.sessions.save(
      this.toPersistedCodingSessionRecord(codingSession),
    );
  }

  private async persistCodingSessionMessage(message: BirdCoderChatMessage): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    await this.codingSessionRepositories.messages.save(cloneChatMessage(message));
  }

  private async persistCodingSessionMessages(messages: readonly BirdCoderChatMessage[]): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    if (messages.length === 0) {
      return;
    }

    await this.codingSessionRepositories.messages.saveMany(
      messages.map((message) => cloneChatMessage(message)),
    );
  }

  private async replacePersistedCodingSessionMessages(
    codingSessionId: string,
    messages: readonly BirdCoderChatMessage[],
  ): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    const normalizedCodingSessionId = codingSessionId.trim();
    const replacementMessages = deduplicateCodingSessionMessages(messages).filter(
      (message) => message.codingSessionId.trim() === normalizedCodingSessionId,
    );
    const replacementMessageIds = new Set(
      replacementMessages.map((message) => message.id),
    );

    if (replacementMessages.length > 0) {
      await this.codingSessionRepositories.messages.saveMany(replacementMessages);
    }

    const persistedMessages =
      await this.codingSessionRepositories.listMessagesByCodingSessionIds([
        normalizedCodingSessionId,
      ]);
    for (const persistedMessage of persistedMessages) {
      if (
        persistedMessage.codingSessionId.trim() !== normalizedCodingSessionId ||
        replacementMessageIds.has(persistedMessage.id)
      ) {
        continue;
      }

      await this.deletePersistedCodingSessionMessage(
        normalizedCodingSessionId,
        persistedMessage.id,
      );
    }
  }

  private async deletePersistedCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    await this.codingSessionRepositories.messages.delete(
      JSON.stringify([codingSessionId.trim(), messageId.trim()]),
    );
    await this.codingSessionRepositories.messages.delete(messageId);
  }

  private async deletePersistedCodingSession(codingSessionId: string): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    const normalizedCodingSessionId = codingSessionId.trim();
    await this.codingSessionRepositories.deleteMessagesByCodingSessionIds([
      normalizedCodingSessionId,
    ]);
    await this.codingSessionRepositories.sessions.delete(normalizedCodingSessionId);
  }

  private async deletePersistedProjectSessions(projectId: string): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    await this.codingSessionRepositories.deleteMessagesByProjectIds([normalizedProjectId]);
    await this.codingSessionRepositories.deleteSessionsByProjectIds([normalizedProjectId]);
  }

  private async recordPromptMessageEvidence(
    projectId: string,
    codingSessionId: string,
    message: BirdCoderChatMessage,
  ): Promise<void> {
    if (!this.evidenceRepositories) {
      return;
    }

    const promptRunId = `prompt-run-${message.id}`;
    const promptEvaluationId = `prompt-evaluation-${message.id}`;
    const recordedAt = message.createdAt;

    await this.evidenceRepositories.promptRuns.save({
      id: promptRunId,
      projectId,
      codingSessionId,
      promptBundleId: 'runtime-default-bundle',
      promptAssetVersionId: 'runtime-default-asset-version',
      status: 'completed',
      inputSnapshotRef: `message:${message.id}:input`,
      outputSnapshotRef: `message:${message.id}:output`,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    });

    await this.evidenceRepositories.promptEvaluations.save({
      id: promptEvaluationId,
      promptRunId,
      evaluator: 'provider-backed-project-service',
      score: message.content.trim().length > 0 ? 100 : 0,
      summary: {
        messageId: message.id,
        role: message.role,
        turnId: message.turnId ?? null,
      },
      status: 'completed',
      createdAt: recordedAt,
      updatedAt: recordedAt,
    });
  }

  private async recordTemplateInstantiationEvidence(
    projectRecord: Pick<
      BirdCoderRepresentativeProjectRecord,
      'createdAt' | 'id' | 'rootPath' | 'updatedAt'
    >,
    options?: CreateProjectOptions,
  ): Promise<void> {
    if (!this.evidenceRepositories) {
      return;
    }

    await this.evidenceRepositories.templateInstantiations.save({
      id: `template-instantiation-${projectRecord.id}`,
      projectId: projectRecord.id,
      appTemplateVersionId: options?.appTemplateVersionId?.trim() || 'manual-project',
      presetKey: options?.templatePresetKey?.trim() || 'default',
      status: 'planned',
      outputRoot: projectRecord.rootPath ?? '',
      createdAt: projectRecord.createdAt,
      updatedAt: projectRecord.updatedAt,
    });
  }
}
