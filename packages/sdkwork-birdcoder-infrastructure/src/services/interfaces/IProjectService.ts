import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface CreateCodingSessionOptions {
  engineId: BirdCoderCodingSession['engineId'];
  hostMode?: BirdCoderCodingSession['hostMode'];
  modelId: string;
  workspaceId?: string;
}

export interface UpdateCodingSessionOptions {
  archived?: boolean;
  hostMode?: BirdCoderCodingSession['hostMode'];
  pinned?: boolean;
  status?: BirdCoderCodingSession['status'];
  title?: string;
  unread?: boolean;
}

export interface CreateProjectOptions {
  description?: string;
  path?: string;
  appTemplateVersionId?: string;
  templatePresetKey?: string;
}

export interface BirdCoderCodingSessionMirrorSnapshot extends BirdCoderCodingSessionSummary {
  archived?: boolean;
  displayTime: string;
  messageCount: number;
  nativeTranscriptUpdatedAt?: string | null;
  pinned?: boolean;
  runtimeStatus?: BirdCoderCodingSession['runtimeStatus'];
  unread?: boolean;
}

export interface BirdCoderProjectMirrorSnapshot extends Omit<BirdCoderProject, 'codingSessions'> {
  codingSessions: BirdCoderCodingSessionMirrorSnapshot[];
}

export interface GetCodingSessionTranscriptOptions {
  expectedTranscriptUpdatedAt?: string | null;
}

export type CreateCodingSessionMessageInput =
  Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'> &
    Partial<Pick<BirdCoderChatMessage, 'createdAt' | 'id'>>;

export interface IProjectService {
  getProjects(workspaceId?: string): Promise<BirdCoderProject[]>;
  getProjectById(projectId: string): Promise<BirdCoderProject | null>;
  getProjectByPath(workspaceId: string, path: string): Promise<BirdCoderProject | null>;
  invalidateProjectReadCache?(scope?: {
    projectId?: string;
    workspaceId?: string;
  }): Promise<void> | void;
  getProjectMirrorSnapshots?(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]>;
  getCodingSessionTranscript?(
    projectId: string,
    codingSessionId: string,
    options?: GetCodingSessionTranscriptOptions,
  ): Promise<BirdCoderCodingSession | null>;
  recordProjectCreationEvidence?(
    projectId: string,
    options?: CreateProjectOptions,
    projectSnapshot?: Pick<
      BirdCoderProject,
      'createdAt' | 'id' | 'path' | 'updatedAt'
    >,
  ): Promise<void>;
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
    options: CreateCodingSessionOptions,
  ): Promise<BirdCoderCodingSession>;
  upsertCodingSession?(
    projectId: string,
    codingSession: BirdCoderCodingSession,
  ): Promise<void>;
  renameCodingSession(projectId: string, codingSessionId: string, title: string): Promise<void>;
  updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: UpdateCodingSessionOptions,
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
    message: CreateCodingSessionMessageInput,
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
