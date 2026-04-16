import type { IWorkspace } from '@sdkwork/birdcoder-types';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';

const MOCK_WORKSPACES: IWorkspace[] = [
  { id: 'ws-1', name: 'Personal', description: 'My personal projects', icon: 'User' },
  { id: 'ws-2', name: 'Work', description: 'Company projects', icon: 'Briefcase' },
  { id: 'ws-3', name: 'Open Source', description: 'OSS contributions', icon: 'Globe' }
];

export class MockWorkspaceService implements IWorkspaceService {
  private workspaces: IWorkspace[] = [...MOCK_WORKSPACES];

  async getWorkspaces(): Promise<IWorkspace[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...this.workspaces]);
      }, 100);
    });
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newWorkspace: IWorkspace = {
          id: `ws-${Date.now()}`,
          name,
          description,
          icon: 'Folder'
        };
        this.workspaces.push(newWorkspace);
        resolve(newWorkspace);
      }, 100);
    });
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.workspaces.findIndex(w => w.id === id);
        if (index !== -1) {
          this.workspaces[index] = { ...this.workspaces[index], name };
          resolve(this.workspaces[index]);
        } else {
          reject(new Error("Workspace not found"));
        }
      }, 100);
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.workspaces.findIndex(w => w.id === id);
        if (index !== -1) {
          this.workspaces.splice(index, 1);
          resolve();
        } else {
          reject(new Error("Workspace not found"));
        }
      }, 100);
    });
  }
}
