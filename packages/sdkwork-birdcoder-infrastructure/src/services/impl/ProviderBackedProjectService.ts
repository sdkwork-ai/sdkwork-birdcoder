import type {
  BirdCoderProjectSummary,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  compareBirdCoderProjectsByActivity,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  CreateCodingSessionOptions,
  CreateCodingSessionMessageInput,
  CreateProjectOptions,
  IProjectService,
  UpdateCodingSessionOptions,
} from '../interfaces/IProjectService.ts';
import type { BirdCoderTableRecordRepository } from '../../storage/dataKernel.ts';
import type { BirdCoderRepresentativeProjectRecord } from '../../storage/appConsoleRepository.ts';
import type { BirdCoderPromptSkillTemplateEvidenceRepositories } from '../../storage/promptSkillTemplateEvidenceRepository.ts';
import type {
  BirdCoderCodingSessionRepositories,
  BirdCoderPersistedCodingSessionRecord,
} from '../../storage/codingSessionRepository.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
  BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
  BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
} from '../../storage/bootstrapConsoleCatalog.ts';
import { resolveRequiredCodingSessionSelection } from '../codingSessionSelection.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

const CODEX_NATIVE_MESSAGE_ID_SEGMENT = ':native-message:';

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

function normalizeRequiredProjectPathForCreate(path: string | null | undefined): string {
  if (typeof path !== 'string') {
    throw new Error('Project root path is required to create a project.');
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    throw new Error('Project root path is required to create a project.');
  }

  if (!isAbsoluteProjectPath(normalizedPath)) {
    throw new Error('Project root path must be an absolute path.');
  }

  return normalizedPath;
}

function cloneProjects(value: readonly BirdCoderProject[]): BirdCoderProject[] {
  return structuredClone([...value]);
}

function cloneCodingSession(value: BirdCoderCodingSession): BirdCoderCodingSession {
  return structuredClone(value);
}

function cloneChatMessage(value: BirdCoderChatMessage): BirdCoderChatMessage {
  return structuredClone(value);
}

interface SortableCodingSessionLike {
  id: string;
  updatedAt: string;
  createdAt?: string;
  lastTurnAt?: string;
  sortTimestamp?: number;
  transcriptUpdatedAt?: string | null;
}

function compareCodingSessionsByActivity<TSession extends SortableCodingSessionLike>(
  left: TSession,
  right: TSession,
): number {
  return (
    resolveBirdCoderSessionSortTimestamp(right) -
      resolveBirdCoderSessionSortTimestamp(left) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function sortCodingSessionsByActivity<TSession extends SortableCodingSessionLike>(
  sessions: readonly TSession[],
): TSession[] {
  return [...sessions].sort(compareCodingSessionsByActivity);
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
    sortTimestamp: Date.parse(createdAt),
    transcriptUpdatedAt: null,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      createdAt,
      lastTurnAt: createdAt,
      sortTimestamp: Date.parse(createdAt),
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

export interface ProviderBackedProjectServiceOptions {
  codingSessionRepositories?: BirdCoderCodingSessionRepositories;
  defaultOwnerUserId?: string;
  evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  repository: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectRecord>;
}

export class ProviderBackedProjectService implements IProjectService, IProjectSessionMirror {
  private readonly codingSessionRepositories?: BirdCoderCodingSessionRepositories;
  private readonly defaultOwnerUserId: string;
  private readonly evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  private readonly repository: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectRecord>;
  private readonly sessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();

  constructor({
    codingSessionRepositories,
    defaultOwnerUserId = BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
    evidenceRepositories,
    repository,
  }: ProviderBackedProjectServiceOptions) {
    this.codingSessionRepositories = codingSessionRepositories;
    this.defaultOwnerUserId = defaultOwnerUserId;
    this.evidenceRepositories = evidenceRepositories;
    this.repository = repository;
  }

  invalidateProjectReadCache(): void {
    // Provider-backed project reads are already served from the local authority.
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const records = await this.repository.list();
    const filteredRecords = workspaceId
      ? records.filter((record) => record.workspaceId === workspaceId)
      : records;

    const persistedSessionsByProjectId = this.codingSessionRepositories
      ? await this.loadPersistedCodingSessionsSnapshot(filteredRecords.map((record) => record.id))
      : undefined;
    const projects = filteredRecords.map((record) =>
      this.mapProjectRecord(
        record,
        persistedSessionsByProjectId?.get(record.id) ?? this.sessionsByProjectId.get(record.id) ?? [],
      ),
    );
    return cloneProjects([...projects].sort(compareBirdCoderProjectsByActivity));
  }

  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    const record = await this.repository.findById(projectId);
    if (!record) {
      return null;
    }

    const sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionsSnapshot([record.id])).get(record.id) ??
        this.sessionsByProjectId.get(record.id) ??
        []
      : this.sessionsByProjectId.get(record.id) ?? [];
    return structuredClone(this.mapProjectRecord(record, sessions));
  }

  async getProjectByPath(workspaceId: string, path: string): Promise<BirdCoderProject | null> {
    const records = await this.repository.list();
    const record = findMatchingProjectRecordByPath(records, workspaceId, path);
    if (!record) {
      return null;
    }

    const sessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionsSnapshot([record.id])).get(record.id) ??
        this.sessionsByProjectId.get(record.id) ??
        []
      : this.sessionsByProjectId.get(record.id) ?? [];
    return structuredClone(this.mapProjectRecord(record, sessions));
  }

  async getProjectMirrorSnapshots(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]> {
    const records = await this.repository.list();
    const filteredRecords = workspaceId
      ? records.filter((record) => record.workspaceId === workspaceId)
      : records;

    const persistedSessionSnapshotsByProjectId = this.codingSessionRepositories
      ? await this.loadPersistedCodingSessionMirrorSnapshot(filteredRecords.map((record) => record.id))
      : undefined;
    return filteredRecords
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
      return this.mapProjectRecord(existingProjectByPath, sessions);
    }

    const now = createTimestamp();
    const record = await this.repository.save({
      id: createIdentifier('project'),
      uuid: createUuid(),
      tenantId: BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
      organizationId: BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
      workspaceId,
      dataScope: 'PRIVATE',
      userId: this.defaultOwnerUserId,
      parentId: '0',
      parentUuid: '0',
      parentMetadata: {},
      code: normalizedName,
      title: normalizedName,
      name: normalizedName,
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
    });

    await this.recordTemplateInstantiationEvidence(record, options);
    this.sessionsByProjectId.set(record.id, []);
    return this.mapProjectRecord(record, []);
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
    const existingRecord = await this.repository.findById(summary.id);
    const record = await this.repository.save({
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
      rootPath: summary.rootPath?.trim() || existingRecord?.rootPath,
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
    });
    const sessions = await this.readProjectSessions(summary.id, {
      refresh: true,
    });
    return this.mapProjectRecord(record, sessions);
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const record = await this.readProjectRecord(projectId);
    await this.repository.save({
      ...record,
      name: name.trim() || record.name,
      updatedAt: createTimestamp(),
    });
  }

  async updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void> {
    const record = await this.readProjectRecord(projectId);
    const conflictingProject = await this.findProjectByWorkspaceAndPath(
      record.workspaceId,
      updates.path,
      projectId,
    );
    if (conflictingProject) {
      throw new Error(
        `Workspace already contains project "${conflictingProject.name}" for path "${updates.path}".`,
      );
    }

    await this.repository.save({
      ...record,
      name: updates.name?.trim() || record.name,
      code: updates.code?.trim() || record.code,
      title: updates.title?.trim() || record.title,
      description: updates.description ?? record.description,
      dataScope: updates.dataScope ?? record.dataScope,
      userId: updates.userId ?? record.userId,
      parentId: updates.parentId ?? record.parentId,
      parentUuid: updates.parentUuid ?? record.parentUuid,
      parentMetadata: updates.parentMetadata ?? record.parentMetadata,
      sitePath: updates.sitePath?.trim() || record.sitePath,
      domainPrefix: updates.domainPrefix?.trim() || record.domainPrefix,
      rootPath: updates.path ?? record.rootPath,
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
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.repository.delete(projectId);
    await this.deletePersistedProjectSessions(projectId);
    this.sessionsByProjectId.delete(projectId);
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

    const records = await this.repository.list();
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
    const sessions = await this.readProjectSessions(projectId, {
      refresh: true,
    });
    this.storeProjectSessions(projectId, [codingSession, ...sessions]);
    await this.persistCodingSessionSummary(codingSession);
    return cloneCodingSession(codingSession);
  }

  async upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void> {
    await this.readProjectRecord(projectId);
    const sessions = await this.readProjectSessions(projectId, {
      refresh: true,
    });
    const nextCodingSession = cloneCodingSession(codingSession);
    const existingCodingSession = sessions.find(
      (candidate) => candidate.id === nextCodingSession.id,
    );

    if (nextCodingSession.messages.length === 0 && existingCodingSession?.messages.length) {
      nextCodingSession.messages = existingCodingSession.messages.map((message) =>
        cloneChatMessage(message),
      );
    }

    this.storeProjectSessions(
      projectId,
      [nextCodingSession, ...sessions.filter((candidate) => candidate.id !== nextCodingSession.id)],
    );
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.persistCodingSessionMessages(nextCodingSession.messages);
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const nextCodingSession = this.touchCodingSessionMetadata({
      ...cloneCodingSession(codingSession),
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
    const codingSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const nextCodingSession = this.touchCodingSessionMetadata({
      ...cloneCodingSession(codingSession),
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
    this.storeProjectSessions(projectId, [nextForkedSession, ...sessions]);
    await this.persistCodingSessionSummary(nextForkedSession);
    await this.persistCodingSessionMessages(nextForkedSession.messages);
    return cloneCodingSession(nextForkedSession);
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    const sessions = await this.readProjectSessions(projectId, {
      refresh: true,
    });
    const nextSessions = sessions.filter((codingSession) => codingSession.id !== codingSessionId);
    this.sessionsByProjectId.set(projectId, nextSessions);
    await this.deletePersistedCodingSession(codingSessionId);
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: CreateCodingSessionMessageInput,
  ): Promise<BirdCoderChatMessage> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const normalizedMessageId = message.id?.trim();
    if (normalizedMessageId) {
      const existingMessage = codingSession.messages.find(
        (candidate) => candidate.id === normalizedMessageId,
      );
      if (existingMessage) {
        return cloneChatMessage(existingMessage);
      }
    }

    const newMessage = createChatMessage(codingSessionId, message);
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...cloneCodingSession(codingSession),
      messages: [
        ...codingSession.messages.map((candidate) => cloneChatMessage(candidate)),
        newMessage,
      ],
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
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
    const codingSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const message = codingSession.messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const nextMessage = {
      ...cloneChatMessage(message),
      ...updates,
    };
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...cloneCodingSession(codingSession),
      messages: codingSession.messages.map((candidate) =>
        candidate.id === messageId ? nextMessage : cloneChatMessage(candidate),
      ),
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.persistCodingSessionMessage(nextMessage);
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    const codingSession = await this.findCodingSession(projectId, codingSessionId, {
      refresh: true,
    });
    const nextCodingSession = this.touchCodingSessionTranscript({
      ...cloneCodingSession(codingSession),
      messages: codingSession.messages
        .filter((message) => message.id !== messageId)
        .map((message) => cloneChatMessage(message)),
    });
    this.replaceCachedCodingSession(projectId, nextCodingSession);
    await this.persistCodingSessionSummary(nextCodingSession);
    await this.deletePersistedCodingSessionMessage(messageId);
  }

  private mapProjectRecord(
    record: BirdCoderRepresentativeProjectRecord,
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderProject {
    const normalizedSessions = [...sessions]
      .map((session) => ({
        ...cloneCodingSession(session),
        displayTime: formatBirdCoderSessionActivityDisplayTime(session),
      }))
      .sort(
        (left, right) =>
          resolveBirdCoderSessionSortTimestamp(right) -
            resolveBirdCoderSessionSortTimestamp(left) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );

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
      name: record.name,
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

  private mapCodingSessionsToMirrorSnapshots(
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSessionMirrorSnapshot[] {
    return [...sessions]
      .map((session) => ({
        id: session.id,
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        title: session.title,
        status: session.status,
        hostMode: session.hostMode,
        engineId: session.engineId,
        modelId: session.modelId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastTurnAt: session.lastTurnAt,
        sortTimestamp: session.sortTimestamp ?? resolveBirdCoderSessionSortTimestamp(session),
        transcriptUpdatedAt:
          session.transcriptUpdatedAt ?? findLatestTranscriptTimestamp(session.messages),
        displayTime: formatBirdCoderSessionActivityDisplayTime({
          ...session,
          transcriptUpdatedAt:
            session.transcriptUpdatedAt ?? findLatestTranscriptTimestamp(session.messages),
        }),
        pinned: session.pinned,
        archived: session.archived,
        unread: session.unread,
        messageCount: session.messages.length,
        nativeTranscriptUpdatedAt: findLatestNativeTranscriptTimestamp(session.messages),
      }))
      .sort(
        (left, right) =>
          resolveBirdCoderSessionSortTimestamp(right) -
            resolveBirdCoderSessionSortTimestamp(left) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );
  }

  private mapProjectRecordToMirrorSnapshot(
    record: BirdCoderRepresentativeProjectRecord,
    sessions: readonly BirdCoderCodingSessionMirrorSnapshot[],
  ): BirdCoderProjectMirrorSnapshot {
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
      name: record.name,
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
      this.sessionsByProjectId.set(projectId, refreshedSessions);
      return refreshedSessions;
    }

    const sessions = this.sessionsByProjectId.get(projectId);
    if (sessions) {
      return sessions;
    }

    const nextSessions = this.codingSessionRepositories
      ? (await this.loadPersistedCodingSessionsSnapshot([projectId])).get(projectId) ?? []
      : [];
    this.sessionsByProjectId.set(projectId, nextSessions);
    return nextSessions;
  }

  private async findCodingSession(
    projectId: string,
    codingSessionId: string,
    options: {
      refresh?: boolean;
    } = {},
  ): Promise<BirdCoderCodingSession> {
    const codingSession = (await this.readProjectSessions(projectId, options)).find(
      (candidate) => candidate.id === codingSessionId,
    );
    if (!codingSession) {
      throw new Error(`Coding session ${codingSessionId} not found`);
    }

    return codingSession;
  }

  private async readProjectRecord(projectId: string): Promise<BirdCoderRepresentativeProjectRecord> {
    const record = await this.repository.findById(projectId);
    if (!record) {
      throw new Error(`Project ${projectId} not found`);
    }

    return record;
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
    const sortTimestamp = resolveBirdCoderSessionSortTimestamp({
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

  private replaceCachedCodingSession(
    projectId: string,
    nextCodingSession: BirdCoderCodingSession,
    existingSessions?: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession {
    const currentSessions = existingSessions ?? this.sessionsByProjectId.get(projectId) ?? [];
    const nextSessions = sortCodingSessionsByActivity([
      nextCodingSession,
      ...currentSessions.filter((candidate) => candidate.id !== nextCodingSession.id),
    ]);
    this.sessionsByProjectId.set(projectId, nextSessions);
    return nextCodingSession;
  }

  private storeProjectSessions(
    projectId: string,
    sessions: readonly BirdCoderCodingSession[],
  ): BirdCoderCodingSession[] {
    const nextSessions = sortCodingSessionsByActivity(sessions);
    this.sessionsByProjectId.set(projectId, nextSessions);
    return nextSessions;
  }

  private async loadPersistedCodingSessionsSnapshot(
    projectIds: readonly string[],
  ): Promise<Map<string, BirdCoderCodingSession[]>> {
    if (!this.codingSessionRepositories) {
      return new Map();
    }

    const [persistedSessions, persistedMessages] = await Promise.all([
      this.codingSessionRepositories.sessions.list(),
      this.codingSessionRepositories.messages.list(),
    ]);
    const projectIdSet = new Set(projectIds);
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

    for (const session of persistedSessions) {
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
          resolveBirdCoderSessionSortTimestamp(right) -
            resolveBirdCoderSessionSortTimestamp(left) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );
      this.sessionsByProjectId.set(projectId, sessions);
    }

    return sessionsByProjectId;
  }

  private async loadPersistedCodingSessionMirrorSnapshot(
    projectIds: readonly string[],
  ): Promise<Map<string, BirdCoderCodingSessionMirrorSnapshot[]>> {
    if (!this.codingSessionRepositories) {
      return new Map();
    }

    const persistedSessions = await this.codingSessionRepositories.sessions.list();
    const projectIdSet = new Set(projectIds);
    const relevantSessions = persistedSessions.filter((session) => projectIdSet.has(session.projectId));
    const codingSessionIdSet = new Set(relevantSessions.map((session) => session.id));
    const messageMetadataByCodingSessionId = new Map<string, {
      latestTranscriptUpdatedAt: string | null;
      messageCount: number;
      nativeTranscriptUpdatedAt: string | null;
    }>();

    for (const message of await this.codingSessionRepositories.messages.list()) {
      if (!codingSessionIdSet.has(message.codingSessionId)) {
        continue;
      }

      const existingMetadata = messageMetadataByCodingSessionId.get(message.codingSessionId) ?? {
        latestTranscriptUpdatedAt: null,
        messageCount: 0,
        nativeTranscriptUpdatedAt: null,
      };
      existingMetadata.messageCount += 1;
      if (
        typeof message.createdAt === 'string' &&
        !Number.isNaN(Date.parse(message.createdAt)) &&
        (
          existingMetadata.latestTranscriptUpdatedAt === null ||
          Date.parse(message.createdAt) > Date.parse(existingMetadata.latestTranscriptUpdatedAt)
        )
      ) {
        existingMetadata.latestTranscriptUpdatedAt = message.createdAt;
      }
      if (
        message.id.includes(CODEX_NATIVE_MESSAGE_ID_SEGMENT) &&
        typeof message.createdAt === 'string' &&
        !Number.isNaN(Date.parse(message.createdAt)) &&
        (
          existingMetadata.nativeTranscriptUpdatedAt === null ||
          Date.parse(message.createdAt) > Date.parse(existingMetadata.nativeTranscriptUpdatedAt)
        )
      ) {
        existingMetadata.nativeTranscriptUpdatedAt = message.createdAt;
      }
      messageMetadataByCodingSessionId.set(message.codingSessionId, existingMetadata);
    }

    const sessionsByProjectId = new Map<string, BirdCoderCodingSessionMirrorSnapshot[]>();
    for (const session of relevantSessions) {
      const metadata = messageMetadataByCodingSessionId.get(session.id);
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
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastTurnAt: session.lastTurnAt,
        sortTimestamp: session.sortTimestamp ?? resolveBirdCoderSessionSortTimestamp(session),
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
          resolveBirdCoderSessionSortTimestamp(right) -
            resolveBirdCoderSessionSortTimestamp(left) ||
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
  ): BirdCoderCodingSession {
    const messages = (messagesByCodingSessionId.get(session.id) ?? []).map((message) =>
      cloneChatMessage(message),
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
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastTurnAt: session.lastTurnAt,
      sortTimestamp: session.sortTimestamp ?? resolveBirdCoderSessionSortTimestamp(session),
      transcriptUpdatedAt:
        session.transcriptUpdatedAt ?? findLatestTranscriptTimestamp(messages),
      displayTime: formatBirdCoderSessionActivityDisplayTime({
        ...session,
        transcriptUpdatedAt:
          session.transcriptUpdatedAt ?? findLatestTranscriptTimestamp(messages),
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
      createdAt: codingSession.createdAt,
      updatedAt: codingSession.updatedAt,
      lastTurnAt: codingSession.lastTurnAt,
      sortTimestamp:
        codingSession.sortTimestamp ?? resolveBirdCoderSessionSortTimestamp(codingSession),
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

  private async deletePersistedCodingSessionMessage(messageId: string): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    await this.codingSessionRepositories.messages.delete(messageId);
  }

  private async deletePersistedCodingSession(codingSessionId: string): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    const persistedMessages = await this.codingSessionRepositories.messages.list();
    const messageIds = persistedMessages
      .filter((message) => message.codingSessionId === codingSessionId)
      .map((message) => message.id);

    await Promise.all([
      this.codingSessionRepositories.sessions.delete(codingSessionId),
      ...messageIds.map((messageId) => this.codingSessionRepositories!.messages.delete(messageId)),
    ]);
  }

  private async deletePersistedProjectSessions(projectId: string): Promise<void> {
    if (!this.codingSessionRepositories) {
      return;
    }

    const persistedSessions = (await this.loadPersistedCodingSessionsSnapshot([projectId])).get(projectId) ?? [];
    await Promise.all(
      persistedSessions.map((session) => this.deletePersistedCodingSession(session.id)),
    );
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
