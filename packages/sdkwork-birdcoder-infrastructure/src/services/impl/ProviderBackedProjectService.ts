import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import type { IProjectService } from '../interfaces/IProjectService.ts';
import type { BirdCoderTableRecordRepository } from '../../storage/dataKernel.ts';
import type { BirdCoderRepresentativeProjectRecord } from '../../storage/appConsoleRepository.ts';
import type { BirdCoderPromptSkillTemplateEvidenceRepositories } from '../../storage/promptSkillTemplateEvidenceRepository.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

function createIdentifier(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDisplayTime(updatedAt: string): string {
  const updatedAtValue = Date.parse(updatedAt);
  if (Number.isNaN(updatedAtValue)) {
    return 'Just now';
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - updatedAtValue) / 1000));
  if (deltaSeconds < 60) {
    return 'Just now';
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)} mins ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)} hours ago`;
  }
  return `${Math.floor(deltaSeconds / 86400)} days ago`;
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

function createCodingSession(
  projectRecord: BirdCoderRepresentativeProjectRecord,
  title: string,
): BirdCoderCodingSession {
  const createdAt = createTimestamp();
  return {
    id: createIdentifier('coding-session'),
    workspaceId: projectRecord.workspaceId,
    projectId: projectRecord.id,
    title: title.trim() || 'New Thread',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'codex',
    createdAt,
    updatedAt: createdAt,
    lastTurnAt: createdAt,
    displayTime: 'Just now',
    pinned: false,
    archived: false,
    unread: false,
    messages: [],
  };
}

function createChatMessage(
  codingSessionId: string,
  message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
): BirdCoderChatMessage {
  return {
    id: createIdentifier('message'),
    codingSessionId,
    turnId: message.turnId,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: createTimestamp(),
    timestamp: message.timestamp ?? Date.now(),
    name: message.name,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
    fileChanges: message.fileChanges,
    commands: message.commands,
    taskProgress: message.taskProgress,
  };
}

export interface ProviderBackedProjectServiceOptions {
  evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  repository: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectRecord>;
}

export class ProviderBackedProjectService implements IProjectService, IProjectSessionMirror {
  private readonly evidenceRepositories?: BirdCoderPromptSkillTemplateEvidenceRepositories;
  private readonly repository: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectRecord>;
  private readonly sessionsByProjectId = new Map<string, BirdCoderCodingSession[]>();

  constructor({ evidenceRepositories, repository }: ProviderBackedProjectServiceOptions) {
    this.evidenceRepositories = evidenceRepositories;
    this.repository = repository;
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const records = await this.repository.list();
    const filteredRecords = workspaceId
      ? records.filter((record) => record.workspaceId === workspaceId)
      : records;

    const projects = filteredRecords.map((record) => this.mapProjectRecord(record));
    return cloneProjects(projects);
  }

  async createProject(workspaceId: string, name: string): Promise<BirdCoderProject> {
    const normalizedName = name.trim();
    if (!workspaceId.trim()) {
      throw new Error('Workspace ID is required to create a project');
    }
    if (!normalizedName) {
      throw new Error('Project name is required');
    }

    const now = createTimestamp();
    const record = await this.repository.save({
      id: createIdentifier('project'),
      workspaceId,
      name: normalizedName,
      description: undefined,
      rootPath: undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await this.recordTemplateInstantiationEvidence(record);
    this.sessionsByProjectId.set(record.id, []);
    return this.mapProjectRecord(record);
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
    await this.repository.save({
      ...record,
      name: updates.name?.trim() || record.name,
      description: updates.description ?? record.description,
      rootPath: updates.path ?? record.rootPath,
      status: updates.archived === true ? 'archived' : updates.archived === false ? 'active' : record.status,
      updatedAt: createTimestamp(),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.repository.delete(projectId);
    this.sessionsByProjectId.delete(projectId);
  }

  async createCodingSession(projectId: string, title: string): Promise<BirdCoderCodingSession> {
    const projectRecord = await this.readProjectRecord(projectId);
    const codingSession = createCodingSession(projectRecord, title);
    const sessions = this.readProjectSessions(projectId);
    sessions.unshift(codingSession);
    return cloneCodingSession(codingSession);
  }

  async upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void> {
    await this.readProjectRecord(projectId);
    const sessions = this.readProjectSessions(projectId);
    const nextCodingSession = cloneCodingSession(codingSession);
    const existingIndex = sessions.findIndex((candidate) => candidate.id === nextCodingSession.id);

    if (existingIndex >= 0) {
      sessions.splice(existingIndex, 1);
    }
    sessions.unshift(nextCodingSession);
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    codingSession.title = title.trim() || codingSession.title;
    this.touchCodingSession(codingSession);
  }

  async updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    codingSession.title = updates.title?.trim() || codingSession.title;
    codingSession.status = updates.archived === true ? 'archived' : updates.status ?? codingSession.status;
    codingSession.engineId = updates.engineId ?? codingSession.engineId;
    codingSession.modelId = updates.modelId ?? codingSession.modelId;
    codingSession.pinned = updates.pinned ?? codingSession.pinned;
    codingSession.archived = updates.archived ?? codingSession.archived;
    codingSession.unread = updates.unread ?? codingSession.unread;
    this.touchCodingSession(codingSession);
  }

  async forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession> {
    const sourceSession = this.findCodingSession(projectId, codingSessionId);
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
    this.touchCodingSession(forkedSession);
    forkedSession.messages = forkedSession.messages.map((message) => ({
      ...message,
      codingSessionId: forkedSession.id,
    }));
    this.readProjectSessions(projectId).unshift(forkedSession);
    return cloneCodingSession(forkedSession);
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    const sessions = this.readProjectSessions(projectId);
    const nextSessions = sessions.filter((codingSession) => codingSession.id !== codingSessionId);
    this.sessionsByProjectId.set(projectId, nextSessions);
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
  ): Promise<BirdCoderChatMessage> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    const newMessage = createChatMessage(codingSessionId, message);
    codingSession.messages.push(newMessage);
    this.touchCodingSession(codingSession);
    await this.recordPromptMessageEvidence(projectId, codingSessionId, newMessage);
    return cloneChatMessage(newMessage);
  }

  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    const message = codingSession.messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    Object.assign(message, updates);
    this.touchCodingSession(codingSession);
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    codingSession.messages = codingSession.messages.filter((message) => message.id !== messageId);
    this.touchCodingSession(codingSession);
  }

  private mapProjectRecord(record: BirdCoderRepresentativeProjectRecord): BirdCoderProject {
    const sessions = this.readProjectSessions(record.id)
      .map((session) => ({
        ...cloneCodingSession(session),
        displayTime: toDisplayTime(session.updatedAt),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      name: record.name,
      description: record.description,
      path: record.rootPath,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archived: record.status === 'archived',
      codingSessions: sessions,
    };
  }

  private readProjectSessions(projectId: string): BirdCoderCodingSession[] {
    const sessions = this.sessionsByProjectId.get(projectId);
    if (sessions) {
      return sessions;
    }

    const nextSessions: BirdCoderCodingSession[] = [];
    this.sessionsByProjectId.set(projectId, nextSessions);
    return nextSessions;
  }

  private findCodingSession(projectId: string, codingSessionId: string): BirdCoderCodingSession {
    const codingSession = this.readProjectSessions(projectId).find(
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

  private touchCodingSession(codingSession: BirdCoderCodingSession): void {
    const updatedAt = createTimestamp();
    codingSession.updatedAt = updatedAt;
    codingSession.lastTurnAt = updatedAt;
    codingSession.displayTime = 'Just now';
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
    projectRecord: BirdCoderRepresentativeProjectRecord,
  ): Promise<void> {
    if (!this.evidenceRepositories) {
      return;
    }

    await this.evidenceRepositories.templateInstantiations.save({
      id: `template-instantiation-${projectRecord.id}`,
      projectId: projectRecord.id,
      appTemplateVersionId: 'app-template-version-default',
      presetKey: 'default',
      status: 'planned',
      outputRoot: projectRecord.rootPath ?? '',
      createdAt: projectRecord.createdAt,
      updatedAt: projectRecord.updatedAt,
    });
  }
}
