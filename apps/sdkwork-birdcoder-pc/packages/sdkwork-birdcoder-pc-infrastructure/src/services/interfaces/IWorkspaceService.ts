import type { IWorkspace } from '@sdkwork/birdcoder-pc-types';
import type { BirdCoderServiceListPagination } from './IProjectService.ts';

export interface IWorkspaceService {
  getWorkspaces(pagination?: BirdCoderServiceListPagination): Promise<IWorkspace[]>;
  createWorkspace(name: string, description?: string): Promise<IWorkspace>;
  updateWorkspace(id: string, name: string): Promise<IWorkspace>;
  deleteWorkspace(id: string): Promise<void>;
}
