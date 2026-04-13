import type { IWorkspace } from '@sdkwork/birdcoder-types';

export interface IWorkspaceService {
  getWorkspaces(): Promise<IWorkspace[]>;
  createWorkspace(name: string, description?: string): Promise<IWorkspace>;
  updateWorkspace(id: string, name: string): Promise<IWorkspace>;
  deleteWorkspace(id: string): Promise<void>;
}
