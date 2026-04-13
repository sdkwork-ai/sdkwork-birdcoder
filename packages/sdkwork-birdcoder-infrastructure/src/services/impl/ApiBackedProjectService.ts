import type {
  BirdCoderAppAdminApiClient,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderCoreWriteApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import type { IProjectService } from '../interfaces/IProjectService.ts';

const ZERO_TIMESTAMP = new Date(0).toISOString();

export interface ApiBackedProjectServiceOptions {
  client: BirdCoderAppAdminApiClient;
  codingSessionMirror?: IProjectSessionMirror;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  writeService: IProjectService;
}

function mergeProjectSummary(
  summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number],
  localProject: BirdCoderProject | undefined,
): BirdCoderProject {
  return {
    id: summary.id,
    workspaceId: summary.workspaceId,
    name: summary.name,
    description: summary.description,
    path: summary.rootPath,
    createdAt: summary.createdAt || localProject?.createdAt || ZERO_TIMESTAMP,
    updatedAt: summary.updatedAt || localProject?.updatedAt || summary.createdAt || ZERO_TIMESTAMP,
    archived: summary.status === 'archived',
    codingSessions: localProject?.codingSessions ? structuredClone(localProject.codingSessions) : [],
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

export class ApiBackedProjectService implements IProjectService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly codingSessionMirror?: IProjectSessionMirror;
  private readonly coreWriteClient?: BirdCoderCoreWriteApiClient;
  private readonly writeService: IProjectService;

  constructor({ client, codingSessionMirror, coreWriteClient, writeService }: ApiBackedProjectServiceOptions) {
    this.client = client;
    this.codingSessionMirror = codingSessionMirror;
    this.coreWriteClient = coreWriteClient;
    this.writeService = writeService;
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const [projectSummaries, localProjects] = await Promise.all([
      this.client.listProjects({ workspaceId }),
      this.writeService.getProjects(workspaceId),
    ]);
    const localProjectsById = new Map(localProjects.map((project) => [project.id, project]));
    return projectSummaries.map((projectSummary) =>
      mergeProjectSummary(projectSummary, localProjectsById.get(projectSummary.id)),
    );
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

  async createCodingSession(projectId: string, title: string): Promise<BirdCoderCodingSession> {
    if (!this.coreWriteClient) {
      return this.writeService.createCodingSession(projectId, title);
    }

    const project = await this.resolveProject(projectId);
    const localCodingSession = project.codingSessions.find(
      (candidate) => candidate.title === title.trim(),
    );
    const createdCodingSessionSummary = await this.coreWriteClient.createCodingSession({
      workspaceId: project.workspaceId,
      projectId,
      title,
    });
    const createdCodingSession = mergeCodingSessionSummary(
      createdCodingSessionSummary,
      localCodingSession,
    );

    await this.codingSessionMirror?.upsertCodingSession(projectId, createdCodingSession);
    return structuredClone(createdCodingSession);
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
    try {
      const createdTurn = await this.coreWriteClient!.createCodingSessionTurn(
        codingSessionId,
        remoteTurnRequest,
      );
      turnId = createdTurn.id;
    } catch (error) {
      if (!shouldFallbackToLocalTurnMirror(error)) {
        throw error;
      }
    }

    return this.writeService.addCodingSessionMessage(projectId, codingSessionId, {
      ...message,
      turnId,
    });
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
}
