import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderListCodingSessionsRequest,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';

export interface CreateCodingSessionOptions {
  engineId: BirdCoderCodingSession['engineId'];
  hostMode?: BirdCoderCodingSession['hostMode'];
  modelId: string;
  runtimeLocationId: string;
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
  appTemplateVersionId?: string;
  templatePresetKey?: string;
}

export interface UpdateProjectOptions {
  description?: string;
  name?: string;
  status?: 'active' | 'archived';
}

export interface BindProjectWorkspaceInput {
  logicalPath: string;
  rootEntryId: string;
  sandboxId: string;
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

export interface BirdCoderServiceListPagination {
  limit?: number;
  offset?: number;
}

export interface BirdCoderServicePageRequest {
  page: number;
  pageSize: number;
}

export interface BirdCoderServiceOffsetPageInfo {
  hasMore: boolean;
  mode: 'offset';
  page: number;
  pageSize: number;
  totalItems: string;
  totalPages: number;
}

export interface BirdCoderServiceListPage<TItem> {
  items: TItem[];
  pageInfo: BirdCoderServiceOffsetPageInfo;
}

export interface BirdCoderCodingSessionListResult {
  items: BirdCoderCodingSession[];
  total: number;
}

export interface IProjectService {
  bindProjectWorkspace?(
    projectId: string,
    input: BindProjectWorkspaceInput,
  ): Promise<void>;
  getProjectsPage(
    workspaceId: string | undefined,
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<BirdCoderProject>>;
  getProjects(
    workspaceId?: string,
    pagination?: BirdCoderServiceListPagination,
  ): Promise<BirdCoderProject[]>;
  listCodingSessions(
    request: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionListResult>;
  getProjectById(projectId: string): Promise<BirdCoderProject | null>;
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
      'createdAt' | 'id' | 'updatedAt'
    >,
  ): Promise<void>;
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
  renameProject(projectId: string, name: string): Promise<void>;
  updateProject(projectId: string, updates: UpdateProjectOptions): Promise<void>;
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
