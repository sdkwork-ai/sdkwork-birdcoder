import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface IProjectService {
  getProjects(workspaceId?: string): Promise<BirdCoderProject[]>;
  createProject(workspaceId: string, name: string): Promise<BirdCoderProject>;
  renameProject(projectId: string, name: string): Promise<void>;
  updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;

  createCodingSession(projectId: string, title: string): Promise<BirdCoderCodingSession>;
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
