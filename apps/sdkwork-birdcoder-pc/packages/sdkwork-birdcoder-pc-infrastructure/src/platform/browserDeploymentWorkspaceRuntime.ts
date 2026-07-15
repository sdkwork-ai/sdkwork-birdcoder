import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
  FileRevisionLookupResult,
  IFileNode,
} from '@sdkwork/birdcoder-pc-types';

const BROWSER_DEPLOYMENT_WORKSPACE_PREFIX = '/__sdkwork/deployment-workspace';

export class BrowserDeploymentWorkspaceUnavailableError extends Error {
  readonly code = 'browser_deployment_workspace_unavailable';

  constructor(message = 'The browser deployment workspace is unavailable.') {
    super(message);
    this.name = 'BrowserDeploymentWorkspaceUnavailableError';
  }
}

export function isBrowserDeploymentWorkspaceUnavailableError(error: unknown): boolean {
  return error instanceof BrowserDeploymentWorkspaceUnavailableError;
}

export interface BrowserDeploymentWorkspaceRuntime {
  getFiles(projectId: string): Promise<IFileNode[]>;
  loadDirectory(projectId: string, path: string): Promise<IFileNode[]>;
  getFileContent(projectId: string, path: string): Promise<string>;
  getFileRevision(projectId: string, path: string): Promise<string>;
  getFileRevisions(projectId: string, paths: readonly string[]): Promise<ReadonlyArray<FileRevisionLookupResult>>;
  saveFileContent(projectId: string, path: string, content: string): Promise<void>;
  createFile(projectId: string, path: string): Promise<void>;
  createFolder(projectId: string, path: string): Promise<void>;
  deleteEntry(projectId: string, path: string, recursive?: boolean): Promise<void>;
  renameNode(projectId: string, oldPath: string, newPath: string): Promise<void>;
  getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview>;
  createProjectGitBranch(projectId: string, request: BirdCoderCreateProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview>;
  createProjectGitWorktree(projectId: string, request: BirdCoderCreateProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview>;
  switchProjectGitBranch(projectId: string, request: BirdCoderSwitchProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview>;
  commitProjectGitChanges(projectId: string, request: BirdCoderCommitProjectGitChangesRequest): Promise<BirdCoderProjectGitOverview>;
  pushProjectGitBranch(projectId: string, request: BirdCoderPushProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(projectId: string, request: BirdCoderRemoveProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview>;
  pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview>;
}

interface ApiErrorPayload {
  message?: string;
}

interface DirectoryResponse {
  directory: IFileNode;
}

interface ContentResponse {
  content: string;
  revision: string;
}

function isBrowserRuntime(): boolean {
  const browserWindow = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return typeof browserWindow.window !== 'undefined' &&
    typeof browserWindow.document !== 'undefined' &&
    !browserWindow.__TAURI__ &&
    !browserWindow.__TAURI_INTERNALS__;
}

function buildUrl(path: string, query: Record<string, string> = {}): string {
  const url = new URL(`${BROWSER_DEPLOYMENT_WORKSPACE_PREFIX}${path}`, globalThis.location?.origin ?? 'http://localhost');
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  query: Record<string, string> = {},
): Promise<T> {
  if (!isBrowserRuntime() || typeof globalThis.fetch !== 'function') {
    throw new BrowserDeploymentWorkspaceUnavailableError();
  }

  let response: Response;
  try {
    response = await globalThis.fetch(buildUrl(path, query), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new BrowserDeploymentWorkspaceUnavailableError();
  }

  if (response.status === 404 || response.status === 501) {
    throw new BrowserDeploymentWorkspaceUnavailableError();
  }

  const body = await response.json().catch(() => null) as T | ApiErrorPayload | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Browser workspace request failed with HTTP ${response.status}.`,
    );
  }
  return body as T;
}

function projectQuery(projectId: string): Record<string, string> {
  const normalizedProjectId = projectId.trim();
  return normalizedProjectId ? { projectId: normalizedProjectId } : {};
}

function encodeBody(value: unknown): BodyInit {
  return JSON.stringify(value);
}

export function createBrowserDeploymentWorkspaceRuntime(): BrowserDeploymentWorkspaceRuntime {
  return {
    async getFiles(projectId) {
      const response = await requestJson<DirectoryResponse>('/files', undefined, projectQuery(projectId));
      return [response.directory];
    },
    async loadDirectory(projectId, path) {
      const response = await requestJson<DirectoryResponse>('/files', undefined, {
        ...projectQuery(projectId),
        path,
      });
      return [response.directory];
    },
    async getFileContent(projectId, path) {
      const response = await requestJson<ContentResponse>('/content', undefined, {
        ...projectQuery(projectId),
        path,
      });
      return response.content;
    },
    async getFileRevision(projectId, path) {
      const response = await requestJson<ContentResponse>('/content', undefined, {
        ...projectQuery(projectId),
        path,
      });
      return response.revision;
    },
    async getFileRevisions(projectId, paths) {
      return Promise.all(paths.map(async (path) => {
        try {
          return { path, revision: await this.getFileRevision(projectId, path), missing: false };
        } catch (error) {
          return {
            path,
            revision: null,
            missing: true,
            error: error instanceof Error ? error.message : 'Unable to read file revision.',
          };
        }
      }));
    },
    async saveFileContent(projectId, path, content) {
      await requestJson('/content', {
        method: 'PUT',
        body: encodeBody({ path, content }),
      }, projectQuery(projectId));
    },
    async createFile(projectId, path) {
      await requestJson('/entries', {
        method: 'POST',
        body: encodeBody({ path, type: 'file' }),
      }, projectQuery(projectId));
    },
    async createFolder(projectId, path) {
      await requestJson('/entries', {
        method: 'POST',
        body: encodeBody({ path, type: 'directory' }),
      }, projectQuery(projectId));
    },
    async deleteEntry(projectId, path, recursive = false) {
      await requestJson('/entries', { method: 'DELETE' }, {
        ...projectQuery(projectId),
        path,
        recursive: String(recursive),
      });
    },
    async renameNode(projectId, oldPath, newPath) {
      await requestJson('/entries', {
        method: 'PATCH',
        body: encodeBody({ oldPath, newPath }),
      }, projectQuery(projectId));
    },
    async getProjectGitOverview(projectId) {
      return requestJson<BirdCoderProjectGitOverview>('/git', undefined, projectQuery(projectId));
    },
    async createProjectGitBranch(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'createBranch', ...request }) }, projectQuery(projectId));
    },
    async createProjectGitWorktree(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'createWorktree', ...request }) }, projectQuery(projectId));
    },
    async switchProjectGitBranch(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'switchBranch', ...request }) }, projectQuery(projectId));
    },
    async commitProjectGitChanges(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'commit', ...request }) }, projectQuery(projectId));
    },
    async pushProjectGitBranch(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'push', ...request }) }, projectQuery(projectId));
    },
    async removeProjectGitWorktree(projectId, request) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'removeWorktree', ...request }) }, projectQuery(projectId));
    },
    async pruneProjectGitWorktrees(projectId) {
      return requestJson('/git', { method: 'POST', body: encodeBody({ operation: 'pruneWorktrees' }) }, projectQuery(projectId));
    },
  };
}
