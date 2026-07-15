import type {
  IFileNode,
  LocalFolderMountSource,
  ProjectDeviceMountRecoveryResult,
  ProjectDeviceMountState,
  ProjectFileSystemChangeEvent,
  WorkspaceFileSearchExecutionResult,
  WorkspaceFileSearchOptions,
} from '@sdkwork/birdcoder-pc-types';
import {
  createBrowserDeploymentWorkspaceRuntime,
  isBrowserDeploymentWorkspaceUnavailableError,
  type BrowserDeploymentWorkspaceRuntime,
} from '../../platform/browserDeploymentWorkspaceRuntime.ts';
import type {
  FileSystemChangeSubscriptionOptions,
  IFileSystemService,
} from '../interfaces/IFileSystemService.ts';

interface BrowserDeploymentFileSystemServiceOptions {
  fallback: IFileSystemService;
  runtime?: BrowserDeploymentWorkspaceRuntime;
}

function replaceDirectoryNode(
  nodes: readonly IFileNode[],
  directory: IFileNode,
): IFileNode[] {
  return nodes.map((node) => {
    if (node.path === directory.path) {
      return directory;
    }
    if (!node.children?.length) {
      return node;
    }
    const children = replaceDirectoryNode(node.children, directory);
    return children === node.children ? node : { ...node, children };
  });
}

export class BrowserDeploymentFileSystemService implements IFileSystemService {
  private readonly fallback: IFileSystemService;
  private readonly runtime: BrowserDeploymentWorkspaceRuntime;
  private readonly deploymentProjectIds = new Set<string>();
  private readonly deploymentTrees = new Map<string, IFileNode[]>();

  constructor({ fallback, runtime }: BrowserDeploymentFileSystemServiceOptions) {
    this.fallback = fallback;
    this.runtime = runtime ?? createBrowserDeploymentWorkspaceRuntime();
  }

  private isDeploymentProject(projectId: string): boolean {
    return this.deploymentProjectIds.has(projectId.trim());
  }

  private rememberDeploymentTree(projectId: string, files: IFileNode[]): IFileNode[] {
    const normalizedProjectId = projectId.trim();
    this.deploymentProjectIds.add(normalizedProjectId);
    this.deploymentTrees.set(normalizedProjectId, files);
    return files;
  }

  private forgetDeploymentProject(projectId: string): void {
    const normalizedProjectId = projectId.trim();
    this.deploymentProjectIds.delete(normalizedProjectId);
    this.deploymentTrees.delete(normalizedProjectId);
  }

  private async loadDeploymentFiles(projectId: string): Promise<IFileNode[] | null> {
    try {
      return this.rememberDeploymentTree(projectId, await this.runtime.getFiles(projectId));
    } catch (error) {
      if (isBrowserDeploymentWorkspaceUnavailableError(error)) {
        this.forgetDeploymentProject(projectId);
        return null;
      }
      throw error;
    }
  }

  async getFiles(projectId: string): Promise<IFileNode[]> {
    const mountedFiles = await this.fallback.getFiles(projectId);
    if (mountedFiles.length > 0) {
      this.forgetDeploymentProject(projectId);
      return mountedFiles;
    }

    return await this.loadDeploymentFiles(projectId) ?? mountedFiles;
  }

  async loadDirectory(projectId: string, path: string): Promise<IFileNode[]> {
    if (!this.isDeploymentProject(projectId)) {
      return this.fallback.loadDirectory(projectId, path);
    }

    const listing = await this.runtime.loadDirectory(projectId, path);
    const directory = listing[0];
    if (!directory) {
      return this.deploymentTrees.get(projectId.trim()) ?? [];
    }
    const currentTree = this.deploymentTrees.get(projectId.trim()) ?? [];
    return this.rememberDeploymentTree(
      projectId,
      replaceDirectoryNode(currentTree, directory),
    );
  }

  async refreshDirectory(projectId: string, path?: string): Promise<IFileNode[]> {
    if (!this.isDeploymentProject(projectId)) {
      return this.fallback.refreshDirectory(projectId, path);
    }
    return path ? this.loadDirectory(projectId, path) : (await this.loadDeploymentFiles(projectId) ?? []);
  }

  async refreshDirectories(projectId: string, paths: readonly string[]): Promise<IFileNode[]> {
    if (!this.isDeploymentProject(projectId)) {
      return this.fallback.refreshDirectories(projectId, paths);
    }
    let files = paths.length === 0 ? await this.refreshDirectory(projectId) : this.deploymentTrees.get(projectId.trim()) ?? [];
    for (const path of paths) {
      files = await this.loadDirectory(projectId, path);
    }
    return files;
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    return this.isDeploymentProject(projectId)
      ? this.runtime.getFileContent(projectId, path)
      : this.fallback.getFileContent(projectId, path);
  }

  async getFileRevision(projectId: string, path: string): Promise<string> {
    return this.isDeploymentProject(projectId)
      ? this.runtime.getFileRevision(projectId, path)
      : this.fallback.getFileRevision(projectId, path);
  }

  async getFileRevisions(projectId: string, paths: readonly string[]) {
    return this.isDeploymentProject(projectId)
      ? this.runtime.getFileRevisions(projectId, paths)
      : this.fallback.getFileRevisions(projectId, paths);
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.saveFileContent(projectId, path, content);
      return;
    }
    await this.fallback.saveFileContent(projectId, path, content);
  }

  async createFile(projectId: string, path: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.createFile(projectId, path);
      return;
    }
    await this.fallback.createFile(projectId, path);
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.createFolder(projectId, path);
      return;
    }
    await this.fallback.createFolder(projectId, path);
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.deleteEntry(projectId, path);
      return;
    }
    await this.fallback.deleteFile(projectId, path);
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.deleteEntry(projectId, path, true);
      return;
    }
    await this.fallback.deleteFolder(projectId, path);
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    if (this.isDeploymentProject(projectId)) {
      await this.runtime.renameNode(projectId, oldPath, newPath);
      return;
    }
    await this.fallback.renameNode(projectId, oldPath, newPath);
  }

  async searchFiles(
    projectId: string,
    options: WorkspaceFileSearchOptions,
  ): Promise<WorkspaceFileSearchExecutionResult> {
    return this.fallback.searchFiles(projectId, options);
  }

  subscribeToFileChanges(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options?: FileSystemChangeSubscriptionOptions,
  ): () => void {
    return this.fallback.subscribeToFileChanges(projectId, listener, options);
  }

  async getProjectMountState(projectId: string): Promise<ProjectDeviceMountState> {
    const fallbackState = await this.fallback.getProjectMountState(projectId);
    if (fallbackState.status === 'mounted') {
      this.forgetDeploymentProject(projectId);
      return fallbackState;
    }

    const deploymentFiles = await this.loadDeploymentFiles(projectId);
    const root = deploymentFiles?.[0];
    return root
      ? { displayName: root.name, host: 'browser', status: 'mounted' }
      : fallbackState;
  }

  async restoreProjectMount(projectId: string): Promise<ProjectDeviceMountRecoveryResult> {
    const deploymentFiles = await this.loadDeploymentFiles(projectId);
    const root = deploymentFiles?.[0];
    if (root) {
      return {
        restored: true,
        state: { displayName: root.name, host: 'browser', status: 'mounted' },
      };
    }
    return this.fallback.restoreProjectMount(projectId);
  }

  resolveLocalWorkingDirectory(projectId: string, mountedPath?: string): Promise<string | null> {
    return this.fallback.resolveLocalWorkingDirectory(projectId, mountedPath);
  }

  revealProjectInFileManager(projectId: string, mountedPath?: string): Promise<boolean> {
    return this.fallback.revealProjectInFileManager(projectId, mountedPath);
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    this.forgetDeploymentProject(projectId);
    await this.fallback.mountFolder(projectId, folderInfo);
  }
}
