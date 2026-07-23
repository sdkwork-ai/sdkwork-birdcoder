import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

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

export interface IProjectService {
  getProjectsPage(
    workspaceId: string | undefined,
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<BirdCoderProject>>;
  getProjectById(projectId: string): Promise<BirdCoderProject | null>;
  invalidateProjectReadCache?(scope?: {
    projectId?: string;
    workspaceId?: string;
  }): Promise<void> | void;
  createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject>;
  renameProject(projectId: string, name: string): Promise<void>;
  updateProject(projectId: string, updates: UpdateProjectOptions): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}
