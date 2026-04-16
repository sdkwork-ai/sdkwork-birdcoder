import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface CreateCodingSessionOptions {
  engineId?: BirdCoderCodingSession['engineId'];
  modelId?: string;
}

export interface CreateProjectOptions {
  description?: string;
  path?: string;
}

export interface BirdCoderCodingSessionMirrorSnapshot extends BirdCoderCodingSessionSummary {
  archived?: boolean;
  displayTime: string;
  messageCount: number;
  nativeTranscriptUpdatedAt?: string | null;
  pinned?: boolean;
  unread?: boolean;
}

export interface BirdCoderProjectMirrorSnapshot extends Omit<BirdCoderProject, 'codingSessions'> {
  codingSessions: BirdCoderCodingSessionMirrorSnapshot[];
}

export interface IProjectService {
  getProjects(workspaceId?: string): Promise<BirdCoderProject[]>;
  getProjectMirrorSnapshots?(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]>;
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
  renameProject(projectId: string, name: string): Promise<void>;
  updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;

  createCodingSession(
    projectId: string,
    title: string,
    options?: CreateCodingSessionOptions,
  ): Promise<BirdCoderCodingSession>;
  upsertCodingSession?(
    projectId: string,
    codingSession: BirdCoderCodingSession,
  ): Promise<void>;
  renameCodingSession(projectId: string, codingSessionId: string, title: string): Promise<void>;
  updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ): Promise<void>;
  forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession>;
  deleteCodingSession(projectId: string, codingSessionId: string): Promise<void>;

  addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
  ): Promise<BirdCoderChatMessage>;
  editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void>;
  deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void>;
}
