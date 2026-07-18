import type { IWorkspace } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  BirdCoderServiceListPage,
  BirdCoderServiceListPagination,
  BirdCoderServicePageRequest,
} from './IProjectService.ts';

export interface IWorkspaceService {
  getWorkspacesPage(
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<IWorkspace>>;
  getWorkspaces(pagination?: BirdCoderServiceListPagination): Promise<IWorkspace[]>;
  createWorkspace(name: string, description?: string): Promise<IWorkspace>;
  updateWorkspace(id: string, name: string): Promise<IWorkspace>;
  deleteWorkspace(id: string): Promise<void>;
}
