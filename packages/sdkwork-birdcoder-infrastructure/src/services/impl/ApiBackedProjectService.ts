import type {
  BirdCoderAppAdminApiClient,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  CreateCodingSessionOptions,
  IProjectService,
} from '../interfaces/IProjectService.ts';

const ZERO_TIMESTAMP = new Date(0).toISOString();

export interface ApiBackedProjectServiceOptions {
  client: BirdCoderAppAdminApiClient;
  codingSessionMirror?: IProjectSessionMirror;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  writeService: IProjectService;
}

function mergeProjectSummary(
  summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number],
  localProject: BirdCoderProject | undefined,
): BirdCoderProject {
  const resolvedProjectPath = summary.rootPath?.trim() || localProject?.path;
  return {
    id: summary.id,
    workspaceId: summary.workspaceId,
    name: summary.name,
    description: summary.description,
    path: resolvedProjectPath,
    createdAt: summary.createdAt || localProject?.createdAt || ZERO_TIMESTAMP,
    updatedAt: summary.updatedAt || localProject?.updatedAt || summary.createdAt || ZERO_TIMESTAMP,
    archived: summary.status === 'archived',
    codingSessions: localProject?.codingSessions ? structuredClone(localProject.codingSessions) : [],
  };
}

function mergeProjectMirrorSnapshot(
  summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number],
  localProject: BirdCoderProjectMirrorSnapshot | undefined,
): BirdCoderProjectMirrorSnapshot {
  const resolvedProjectPath = summary.rootPath?.trim() || localProject?.path;
  return {
    id: summary.id,
    workspaceId: summary.workspaceId,
    name: summary.name,
    description: summary.description,
    path: resolvedProjectPath,
    createdAt: summary.createdAt || localProject?.createdAt || ZERO_TIMESTAMP,
    updatedAt: summary.updatedAt || localProject?.updatedAt || summary.createdAt || ZERO_TIMESTAMP,
    archived: summary.status === 'archived',
    codingSessions: localProject?.codingSessions
      ? structuredClone(localProject.codingSessions)
      : [],
  };
}

function mergeCodingSessionSummary(
  summary: BirdCoderCodingSessionSummary,
  localCodingSession?: BirdCoderCodingSession,
): BirdCoderCodingSession {
  return {
    id: summary.id,
    workspaceId: summary.workspaceId,
    projectId: summary.projectId,
    title: summary.title,
    status: summary.status,
    hostMode: summary.hostMode,
    engineId: summary.engineId,
    modelId: summary.modelId ?? localCodingSession?.modelId,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    lastTurnAt: summary.lastTurnAt,
    displayTime: localCodingSession?.displayTime ?? 'Just now',
    pinned: localCodingSession?.pinned ?? false,
    archived: localCodingSession?.archived ?? summary.status === 'archived',
    unread: localCodingSession?.unread ?? false,
    messages: localCodingSession?.messages ? structuredClone(localCodingSession.messages) : [],
  };
}

const REMOTE_CODING_SESSION_TURN_REQUEST_KIND_BY_ROLE = {
  planner: 'plan',
  reviewer: 'review',
  tool: 'tool',
  user: 'chat',
} as const satisfies Partial<
  Record<BirdCoderChatMessage['role'], BirdCoderCreateCodingSessionTurnRequest['requestKind']>
>;

function resolveRemoteCodingSessionTurnRequest(
  message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
): BirdCoderCreateCodingSessionTurnRequest | null {
  if (message.turnId) {
    return null;
  }

  const requestKind = REMOTE_CODING_SESSION_TURN_REQUEST_KIND_BY_ROLE[message.role];
  const inputSummary = message.content.trim();

  if (!requestKind || inputSummary.length === 0) {
    return null;
  }

  return {
    requestKind,
    inputSummary,
  };
}

function shouldFallbackToLocalTurnMirror(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('-> 404') || error.message.toLowerCase().includes('not found');
}

function readProjectionPayloadString(
  payload: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const value = payload[fieldName];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export class ApiBackedProjectService implements IProjectService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly codingSessionMirror?: IProjectSessionMirror;
  private readonly coreReadClient?: BirdCoderCoreReadApiClient;
  private readonly coreWriteClient?: BirdCoderCoreWriteApiClient;
  private readonly writeService: IProjectService;

  constructor({ client, codingSessionMirror, coreReadClient, coreWriteClient, writeService }: ApiBackedProjectServiceOptions) {
    this.client = client;
    this.codingSessionMirror = codingSessionMirror;
    this.coreReadClient = coreReadClient;
    this.coreWriteClient = coreWriteClient;
    this.writeService = writeService;
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const [projectSummaries, localProjects] = await Promise.all([
      this.client.listProjects({ workspaceId }),
      this.writeService.getProjects(workspaceId),
    ]);
    const localProjectsById = new Map(localProjects.map((project) => [project.id, project]));
    const mergedProjects = projectSummaries.map((projectSummary) =>
      mergeProjectSummary(projectSummary, localProjectsById.get(projectSummary.id)),
    );
    const localOnlyProjects = localProjects.filter(
      (project) => !projectSummaries.some((summary) => summary.id === project.id),
    );

    return [...mergedProjects, ...structuredClone(localOnlyProjects)];
  }

  async getProjectMirrorSnapshots(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]> {
    const [projectSummaries, localProjects] = await Promise.all([
      this.client.listProjects({ workspaceId }),
      this.writeService.getProjectMirrorSnapshots
        ? this.writeService.getProjectMirrorSnapshots(workspaceId)
        : this.writeService.getProjects(workspaceId).then((projects) =>
            projects.map((project) => ({
              id: project.id,
              workspaceId: project.workspaceId,
              name: project.name,
              description: project.description,
              path: project.path,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              archived: project.archived,
              codingSessions: project.codingSessions.map((codingSession): BirdCoderCodingSessionMirrorSnapshot => ({
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
                displayTime: codingSession.displayTime,
                pinned: codingSession.pinned,
                archived: codingSession.archived,
                unread: codingSession.unread,
                messageCount: codingSession.messages.length,
                nativeTranscriptUpdatedAt: [...codingSession.messages]
                  .reverse()
                  .find((message) => message.id.includes(':native-message:'))
                  ?.createdAt ?? null,
              })),
            })),
          ),
    ]);
    const localProjectsById = new Map(localProjects.map((project) => [project.id, project]));
    const mergedProjects = projectSummaries.map((projectSummary) =>
      mergeProjectMirrorSnapshot(projectSummary, localProjectsById.get(projectSummary.id)),
    );
    const localOnlyProjects = localProjects.filter(
      (project) => !projectSummaries.some((summary) => summary.id === project.id),
    );

    return [...mergedProjects, ...structuredClone(localOnlyProjects)];
  }

  async createProject(workspaceId: string, name: string): Promise<BirdCoderProject> {
    return this.writeService.createProject(workspaceId, name);
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    await this.writeService.renameProject(projectId, name);
  }

  async updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void> {
    await this.writeService.updateProject(projectId, updates);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.writeService.deleteProject(projectId);
  }

  async createCodingSession(
    projectId: string,
    title: string,
    options?: CreateCodingSessionOptions,
  ): Promise<BirdCoderCodingSession> {
    if (!this.coreWriteClient) {
      return this.writeService.createCodingSession(projectId, title, options);
    }

    const project = await this.resolveProject(projectId);
    const localCodingSession = project.codingSessions.find(
      (candidate) => candidate.title === title.trim(),
    );
    const createdCodingSessionSummary = await this.coreWriteClient.createCodingSession({
      workspaceId: project.workspaceId,
      projectId,
      title,
      engineId: options?.engineId,
      modelId: options?.modelId,
    });
    const createdCodingSession = mergeCodingSessionSummary(
      createdCodingSessionSummary,
      localCodingSession,
    );

    await this.codingSessionMirror?.upsertCodingSession(projectId, createdCodingSession);
    return structuredClone(createdCodingSession);
  }

  async upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void> {
    if (this.codingSessionMirror) {
      await this.codingSessionMirror.upsertCodingSession(projectId, codingSession);
      return;
    }

    if (this.writeService.upsertCodingSession) {
      await this.writeService.upsertCodingSession(projectId, codingSession);
      return;
    }

    throw new Error(
      'Project service session mirroring requires a codingSessionMirror or writeService.upsertCodingSession implementation.',
    );
  }

  private async resolveProject(projectId: string): Promise<BirdCoderProject> {
    const localProjects = await this.writeService.getProjects();
    const localProject = localProjects.find((candidate) => candidate.id === projectId);
    if (localProject) {
      return localProject;
    }

    const projectSummaries = await this.client.listProjects();
    const projectSummary = projectSummaries.find((candidate) => candidate.id === projectId);
    if (projectSummary) {
      return mergeProjectSummary(projectSummary, undefined);
    }

    throw new Error(`Project ${projectId} not found`);
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    await this.writeService.renameCodingSession(projectId, codingSessionId, title);
  }

  async updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ): Promise<void> {
    await this.writeService.updateCodingSession(projectId, codingSessionId, updates);
  }

  async forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession> {
    return this.writeService.forkCodingSession(projectId, codingSessionId, newTitle);
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    await this.writeService.deleteCodingSession(projectId, codingSessionId);
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
  ): Promise<BirdCoderChatMessage> {
    const remoteTurnRequest =
      this.coreWriteClient === undefined ? null : resolveRemoteCodingSessionTurnRequest(message);

    if (!remoteTurnRequest) {
      return this.writeService.addCodingSessionMessage(projectId, codingSessionId, message);
    }

    let turnId = message.turnId;
    let createdRemoteTurn = false;
    try {
      const createdTurn = await this.coreWriteClient!.createCodingSessionTurn(
        codingSessionId,
        remoteTurnRequest,
      );
      turnId = createdTurn.id;
      createdRemoteTurn = true;
    } catch (error) {
      if (!shouldFallbackToLocalTurnMirror(error)) {
        throw error;
      }
    }

    const createdMessage = await this.writeService.addCodingSessionMessage(projectId, codingSessionId, {
      ...message,
      turnId,
    });

    if (createdRemoteTurn && turnId) {
      try {
        await this.syncRemoteTurnMirror(projectId, codingSessionId, turnId);
      } catch (error) {
        console.error('Failed to synchronize remote coding session turn mirror', error);
      }
    }

    return createdMessage;
  }

  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void> {
    await this.writeService.editCodingSessionMessage(projectId, codingSessionId, messageId, updates);
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    await this.writeService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
  }

  private async syncRemoteTurnMirror(
    projectId: string,
    codingSessionId: string,
    turnId: string,
  ): Promise<void> {
    if (!this.coreReadClient) {
      return;
    }

    const [sessionSummary, events, localProjects] = await Promise.all([
      this.coreReadClient.getCodingSession(codingSessionId),
      this.coreReadClient.listCodingSessionEvents(codingSessionId),
      this.writeService.getProjects(),
    ]);

    const localProject = localProjects.find((candidate) => candidate.id === projectId);
    const localCodingSession = localProject?.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );

    if (this.codingSessionMirror) {
      await this.codingSessionMirror.upsertCodingSession(
        projectId,
        mergeCodingSessionSummary(sessionSummary, localCodingSession),
      );
    }

    const completedMessageEvent = [...events]
      .reverse()
      .find(
        (event) =>
          event.turnId === turnId &&
          event.kind === 'message.completed' &&
          readProjectionPayloadString(event.payload, 'role') === 'assistant',
      );
    const assistantContent = completedMessageEvent
      ? readProjectionPayloadString(completedMessageEvent.payload, 'content')
      : undefined;

    if (!assistantContent) {
      return;
    }

    const refreshedProjects = await this.writeService.getProjects();
    const refreshedProject = refreshedProjects.find((candidate) => candidate.id === projectId);
    const refreshedCodingSession = refreshedProject?.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    const existingAssistantMessage = refreshedCodingSession?.messages.find(
      (candidate) => candidate.turnId === turnId && candidate.role === 'assistant',
    );

    if (existingAssistantMessage) {
      await this.writeService.editCodingSessionMessage(
        projectId,
        codingSessionId,
        existingAssistantMessage.id,
        {
          content: assistantContent,
        },
      );
      return;
    }

    await this.writeService.addCodingSessionMessage(projectId, codingSessionId, {
      role: 'assistant',
      turnId,
      content: assistantContent,
    });
  }
}
