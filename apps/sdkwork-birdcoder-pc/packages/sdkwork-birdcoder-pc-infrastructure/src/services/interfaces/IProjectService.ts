import type { PageInfo } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface CreateProjectOptions {
  description?: string;
}

export interface UpdateProjectOptions {
  description?: string;
  name?: string;
}

export interface BindProjectDriveCompositionInput {
  driveId: string;
  logicalPath: string;
  rootEntryId: string;
}

export interface ProjectDriveComposition {
  driveId: string;
  logicalPath: string;
  projectId: string;
  rootEntryId: string;
  slotId: string;
  version: string;
}

export interface AgentProjectPageRequest {
  includeDeleted?: boolean;
  page: number;
  pageSize: number;
  q?: string;
  status?: AgentProjectView['status'];
}

export interface AgentProjectViewPage {
  items: AgentProjectView[];
  pageInfo: PageInfo;
}

export interface IProjectService {
  getProjectsPage(request: AgentProjectPageRequest): Promise<AgentProjectViewPage>;
  getProjectById(projectId: string): Promise<AgentProjectView | null>;
  createProject(name: string, options?: CreateProjectOptions): Promise<AgentProjectView>;
  renameProject(projectId: string, name: string): Promise<void>;
  updateProject(projectId: string, updates: UpdateProjectOptions): Promise<void>;
  archiveProject(projectId: string): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  bindProjectDrive(
    projectId: string,
    input: BindProjectDriveCompositionInput,
  ): Promise<ProjectDriveComposition>;
  getProjectDrive(projectId: string): Promise<ProjectDriveComposition | null>;
}
