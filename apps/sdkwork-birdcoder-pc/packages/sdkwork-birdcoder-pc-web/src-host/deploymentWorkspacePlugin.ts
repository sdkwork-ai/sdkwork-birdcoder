import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

export const DEPLOYMENT_WORKSPACE_URL_PREFIX = '/__sdkwork/deployment-workspace';

const DEPLOYMENT_WORKSPACE_IGNORED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.git',
  '.sdkwork-worktrees',
  '.turbo',
  'dist',
  'node_modules',
  'target',
]);
const GIT_DIFF_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;
const GIT_COMMAND_BUFFER_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_COMMIT_MESSAGE_CHARACTERS = 500;
const WORKTREE_KEY_PATTERN = /^[a-f0-9]{64}$/u;

export interface DeploymentWorkspaceFileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: DeploymentWorkspaceFileNode[];
}

export interface DeploymentWorkspaceGitDiff {
  patch: string;
  truncated: boolean;
}

export interface DeploymentWorkspaceGitOverview {
  branches: Array<{ name: string; isCurrent: boolean; isRemote: boolean }>;
  currentBranch?: string;
  currentRevision?: string;
  detachedHead: boolean;
  status: 'ready' | 'not_repository';
  statusCounts: { staged: number; unstaged: number; untracked: number };
  worktrees: Array<{
    branch?: string;
    head?: string;
    isCurrent: boolean;
    prunableReason?: string;
    worktreeKey?: string;
  }>;
}

interface DeploymentWorkspaceRequestBody {
  branchName?: string;
  content?: string;
  force?: boolean;
  includeUnstaged?: boolean;
  message?: string;
  newPath?: string;
  oldPath?: string;
  operation?: string;
  path?: string;
  remoteName?: string;
  type?: string;
  worktreeKey?: string;
}

interface GitCommandOptions {
  allowedExitCodes?: readonly number[];
  trim?: boolean;
}

export interface DeploymentWorkspaceHostRuntime {
  canonicalWorkspaceRoot: string;
  createEntry(body: DeploymentWorkspaceRequestBody): void;
  deleteEntry(virtualPath: string | null, recursive: boolean): void;
  getContent(virtualPath: string | null): { content: string; revision: string };
  listDirectory(virtualPath?: string | null): DeploymentWorkspaceFileNode;
  mutateGit(body: DeploymentWorkspaceRequestBody): DeploymentWorkspaceGitOverview;
  readGitDiff(): DeploymentWorkspaceGitDiff;
  readGitOverview(): DeploymentWorkspaceGitOverview;
  renameEntry(body: DeploymentWorkspaceRequestBody): void;
  saveContent(body: DeploymentWorkspaceRequestBody): void;
}

function commandErrorMessage(result: ReturnType<typeof spawnSync>): string {
  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
  if (stderr) {
    return stderr;
  }
  return result.error?.message || 'Git operation failed.';
}

function isSamePath(left: string, right: string): boolean {
  return path.relative(left, right) === '';
}

function deriveWorktreeKey(branchName: string): string {
  return createHash('sha256').update(branchName).digest('hex');
}

function validateBranchName(runGit: (args: readonly string[]) => string, branchName: string): string {
  const normalizedBranchName = branchName.trim();
  if (!normalizedBranchName || normalizedBranchName.startsWith('-')) {
    throw new Error('Worktree branch name is required.');
  }
  runGit(['check-ref-format', '--branch', normalizedBranchName]);
  return normalizedBranchName;
}

export function createDeploymentWorkspaceHostRuntime(workspaceRoot: string): DeploymentWorkspaceHostRuntime {
  const canonicalWorkspaceRoot = fs.realpathSync.native(path.resolve(workspaceRoot));
  const rootName = path.basename(canonicalWorkspaceRoot);
  const rootVirtualPath = `/${rootName}`;
  const managedWorktreeRoot = path.join(canonicalWorkspaceRoot, '.sdkwork-worktrees');

  const resolveWorkspacePath = (virtualPathValue: string | null | undefined, allowMissing = false) => {
    const virtualPath = virtualPathValue?.trim() || rootVirtualPath;
    if (virtualPath !== rootVirtualPath && !virtualPath.startsWith(`${rootVirtualPath}/`)) {
      throw new Error('Workspace path is outside the deployed project root.');
    }
    const relativePath = virtualPath === rootVirtualPath
      ? ''
      : virtualPath.slice(rootVirtualPath.length + 1);
    const candidatePath = path.resolve(canonicalWorkspaceRoot, relativePath);
    const relativeCandidate = path.relative(canonicalWorkspaceRoot, candidatePath);
    if (
      relativeCandidate === '..'
      || relativeCandidate.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeCandidate)
    ) {
      throw new Error('Workspace path is outside the deployed project root.');
    }

    if (!allowMissing || fs.existsSync(candidatePath)) {
      const canonicalCandidate = fs.realpathSync.native(candidatePath);
      const canonicalRelative = path.relative(canonicalWorkspaceRoot, canonicalCandidate);
      if (
        canonicalRelative === '..'
        || canonicalRelative.startsWith(`..${path.sep}`)
        || path.isAbsolute(canonicalRelative)
      ) {
        throw new Error('Workspace path resolves outside the deployed project root.');
      }
      return canonicalCandidate;
    }

    const canonicalParent = fs.realpathSync.native(path.dirname(candidatePath));
    const parentRelative = path.relative(canonicalWorkspaceRoot, canonicalParent);
    if (
      parentRelative === '..'
      || parentRelative.startsWith(`..${path.sep}`)
      || path.isAbsolute(parentRelative)
    ) {
      throw new Error('Workspace path parent resolves outside the deployed project root.');
    }
    return candidatePath;
  };

  const toVirtualPath = (absolutePath: string) => {
    const relativePath = path.relative(canonicalWorkspaceRoot, absolutePath).split(path.sep).join('/');
    return relativePath ? `${rootVirtualPath}/${relativePath}` : rootVirtualPath;
  };

  const runGit = (args: readonly string[], options: GitCommandOptions = {}): string => {
    const result = spawnSync('git', ['-C', canonicalWorkspaceRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: GIT_COMMAND_BUFFER_LIMIT_BYTES,
      windowsHide: true,
    });
    const allowedExitCodes = options.allowedExitCodes ?? [0];
    if (result.status === null || !allowedExitCodes.includes(result.status)) {
      throw new Error(commandErrorMessage(result));
    }
    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    return options.trim === false ? stdout : stdout.trim();
  };

  const tryRunGit = (args: readonly string[]): string | null => {
    try {
      return runGit(args);
    } catch {
      return null;
    }
  };

  const isExactGitRepository = () => {
    const topLevel = tryRunGit(['rev-parse', '--show-toplevel']);
    if (!topLevel || !fs.existsSync(topLevel)) {
      return false;
    }
    return isSamePath(canonicalWorkspaceRoot, fs.realpathSync.native(topLevel));
  };

  const requireGitRepository = () => {
    if (!isExactGitRepository()) {
      throw new Error('Project root path is not a Git repository.');
    }
  };

  const gitRefExists = (refName: string) => {
    const result = spawnSync('git', ['-C', canonicalWorkspaceRoot, 'show-ref', '--verify', '--quiet', refName], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return result.status === 0;
  };

  const listRemoteNames = () => runGit(['remote'])
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);

  const listDirectory = (virtualPathValue?: string | null): DeploymentWorkspaceFileNode => {
    const directoryPath = resolveWorkspacePath(virtualPathValue);
    if (!fs.statSync(directoryPath).isDirectory()) {
      throw new Error('Workspace entry is not a directory.');
    }
    const children = fs.readdirSync(directoryPath, { withFileTypes: true })
      .filter((entry) => !entry.isSymbolicLink())
      .filter(
        (entry) => !entry.isDirectory()
          || !DEPLOYMENT_WORKSPACE_IGNORED_DIRECTORY_NAMES.has(entry.name),
      )
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map<DeploymentWorkspaceFileNode>((entry) => ({
        name: entry.name,
        path: toVirtualPath(path.join(directoryPath, entry.name)),
        type: entry.isDirectory() ? 'directory' : 'file',
      }))
      .sort((left, right) => left.type === right.type
        ? left.name.localeCompare(right.name)
        : left.type === 'directory' ? -1 : 1);
    return {
      name: path.basename(directoryPath),
      path: toVirtualPath(directoryPath),
      type: 'directory',
      children,
    };
  };

  const readGitOverview = (): DeploymentWorkspaceGitOverview => {
    if (!isExactGitRepository()) {
      return {
        branches: [],
        detachedHead: false,
        status: 'not_repository',
        statusCounts: { staged: 0, unstaged: 0, untracked: 0 },
        worktrees: [],
      };
    }

    const currentBranch = tryRunGit(['symbolic-ref', '--quiet', '--short', 'HEAD']) ?? '';
    const currentRevision = tryRunGit(['rev-parse', 'HEAD']) ?? '';
    const localBranches = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((name) => ({ name, isCurrent: name === currentBranch, isRemote: false }));
    const remoteBranches = runGit([
      'for-each-ref',
      '--format=%(refname)\t%(refname:short)',
      'refs/remotes',
    ])
      .split(/\r?\n/u)
      .flatMap((line) => {
        const [reference, name] = line.split('\t');
        if (!reference || !name || reference.endsWith('/HEAD')) {
          return [];
        }
        return [{ name, isCurrent: false, isRemote: true }];
      });
    const statusCounts = { staged: 0, unstaged: 0, untracked: 0 };
    for (const line of runGit(['status', '--porcelain=v1'], { trim: false })
      .split(/\r?\n/u)
      .filter(Boolean)) {
      if (line.startsWith('??')) {
        statusCounts.untracked += 1;
      } else {
        if (line[0] && line[0] !== ' ') statusCounts.staged += 1;
        if (line[1] && line[1] !== ' ') statusCounts.unstaged += 1;
      }
    }

    const worktrees: DeploymentWorkspaceGitOverview['worktrees'] = [];
    let worktree: { branch?: string; head?: string; path?: string; prunableReason?: string } = {};
    const flushWorktree = () => {
      if (!worktree.path) return;
      const resolvedWorktreePath = fs.existsSync(worktree.path)
        ? fs.realpathSync.native(worktree.path)
        : path.resolve(worktree.path);
      const relativeManagedPath = path.relative(managedWorktreeRoot, resolvedWorktreePath);
      const isManagedWorktree = WORKTREE_KEY_PATTERN.test(relativeManagedPath)
        && path.dirname(relativeManagedPath) === '.';
      worktrees.push({
        ...(worktree.branch ? { branch: worktree.branch } : {}),
        ...(worktree.head ? { head: worktree.head } : {}),
        isCurrent: isSamePath(resolvedWorktreePath, canonicalWorkspaceRoot),
        ...(worktree.prunableReason ? { prunableReason: worktree.prunableReason } : {}),
        ...(isManagedWorktree ? { worktreeKey: relativeManagedPath } : {}),
      });
      worktree = {};
    };
    for (const line of runGit(['worktree', 'list', '--porcelain']).split(/\r?\n/u)) {
      if (!line) flushWorktree();
      else if (line.startsWith('worktree ')) worktree.path = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) worktree.head = line.slice('HEAD '.length);
      else if (line.startsWith('branch refs/heads/')) {
        worktree.branch = line.slice('branch refs/heads/'.length);
      } else if (line.startsWith('prunable ')) {
        worktree.prunableReason = line.slice('prunable '.length);
      }
    }
    flushWorktree();

    return {
      branches: [...localBranches, ...remoteBranches],
      ...(currentBranch ? { currentBranch } : {}),
      ...(currentRevision ? { currentRevision } : {}),
      detachedHead: Boolean(currentRevision) && !currentBranch,
      status: 'ready',
      statusCounts,
      worktrees,
    };
  };

  const readGitDiff = (): DeploymentWorkspaceGitDiff => {
    requireGitRepository();
    const hasHead = Boolean(tryRunGit(['rev-parse', '--verify', 'HEAD']));
    const patches: string[] = [];
    const trackedPatch = runGit(
      hasHead
        ? ['diff', '--no-ext-diff', '--binary', 'HEAD', '--']
        : ['diff', '--no-ext-diff', '--binary', '--cached', '--'],
      { trim: false },
    );
    if (trackedPatch) {
      patches.push(trackedPatch);
    }

    const untrackedPaths = runGit(['ls-files', '--others', '--exclude-standard', '-z'], { trim: false })
      .split('\0')
      .filter(Boolean);
    for (const untrackedPath of untrackedPaths) {
      const patch = runGit(
        ['diff', '--no-index', '--binary', '--', '/dev/null', untrackedPath],
        { allowedExitCodes: [0, 1], trim: false },
      );
      if (patch) {
        patches.push(patch);
      }
    }

    const patch = patches.join(patches.length > 1 ? '\n' : '');
    if (Buffer.byteLength(patch, 'utf8') <= GIT_DIFF_RESPONSE_LIMIT_BYTES) {
      return { patch, truncated: false };
    }
    return {
      patch: Buffer.from(patch, 'utf8').subarray(0, GIT_DIFF_RESPONSE_LIMIT_BYTES).toString('utf8'),
      truncated: true,
    };
  };

  const switchBranch = (branchNameValue: string | undefined) => {
    const branchName = validateBranchName(runGit, branchNameValue ?? '');
    if (gitRefExists(`refs/heads/${branchName}`)) {
      runGit(['switch', branchName]);
      return;
    }
    if (!gitRefExists(`refs/remotes/${branchName}`)) {
      throw new Error(`Branch does not exist: ${branchName}`);
    }
    const localName = branchName.split('/').slice(1).join('/');
    validateBranchName(runGit, localName);
    if (gitRefExists(`refs/heads/${localName}`)) {
      runGit(['switch', localName]);
    } else {
      runGit(['switch', '--track', '-c', localName, branchName]);
    }
  };

  const pushBranch = (body: DeploymentWorkspaceRequestBody) => {
    const branchName = validateBranchName(
      runGit,
      body.branchName?.trim() || runGit(['symbolic-ref', '--quiet', '--short', 'HEAD']),
    );
    const remoteNames = listRemoteNames();
    const upstreamName = tryRunGit([
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      `${branchName}@{upstream}`,
    ]);
    const upstreamRemote = upstreamName?.split('/')[0];
    const remoteName = body.remoteName?.trim()
      || upstreamRemote
      || (remoteNames.includes('origin') ? 'origin' : undefined)
      || (remoteNames.length === 1 ? remoteNames[0] : undefined);
    if (!remoteName || !remoteNames.includes(remoteName)) {
      throw new Error('A configured Git remote is required before pushing.');
    }
    runGit(upstreamName
      ? ['push', remoteName, branchName]
      : ['push', '--set-upstream', remoteName, branchName]);
  };

  const createWorktree = (branchNameValue: string | undefined) => {
    const requestedBranchName = validateBranchName(runGit, branchNameValue ?? '');
    let localBranchName = requestedBranchName;
    let args: string[];
    const worktreeKey = deriveWorktreeKey(requestedBranchName);
    const worktreePath = path.join(managedWorktreeRoot, worktreeKey);
    if (gitRefExists(`refs/heads/${requestedBranchName}`)) {
      args = ['worktree', 'add', worktreePath, requestedBranchName];
    } else if (gitRefExists(`refs/remotes/${requestedBranchName}`)) {
      localBranchName = requestedBranchName.split('/').slice(1).join('/');
      validateBranchName(runGit, localBranchName);
      if (gitRefExists(`refs/heads/${localBranchName}`)) {
        args = ['worktree', 'add', worktreePath, localBranchName];
      } else {
        args = [
          'worktree',
          'add',
          '--track',
          '-b',
          localBranchName,
          worktreePath,
          requestedBranchName,
        ];
      }
    } else {
      args = ['worktree', 'add', '-b', localBranchName, worktreePath];
    }
    fs.mkdirSync(managedWorktreeRoot, { recursive: true });
    runGit(args);
  };

  const removeWorktree = (body: DeploymentWorkspaceRequestBody) => {
    const worktreeKey = body.worktreeKey?.trim() || '';
    if (!WORKTREE_KEY_PATTERN.test(worktreeKey)) {
      throw new Error('Worktree key must be a server-generated SHA-256 key.');
    }
    const worktreePath = path.join(managedWorktreeRoot, worktreeKey);
    runGit(['worktree', 'remove', ...(body.force ? ['--force'] : []), worktreePath]);
  };

  return {
    canonicalWorkspaceRoot,
    createEntry(body) {
      const entryPath = resolveWorkspacePath(body.path, true);
      if (body.type === 'directory') fs.mkdirSync(entryPath);
      else if (body.type === 'file') fs.writeFileSync(entryPath, '', { encoding: 'utf8', flag: 'wx' });
      else throw new Error('Entry type must be file or directory.');
    },
    deleteEntry(virtualPath, recursive) {
      const entryPath = resolveWorkspacePath(virtualPath);
      if (entryPath === canonicalWorkspaceRoot) {
        throw new Error('The deployment workspace root cannot be deleted.');
      }
      fs.rmSync(entryPath, { recursive, force: false });
    },
    getContent(virtualPath) {
      const filePath = resolveWorkspacePath(virtualPath);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error('Workspace entry is not a file.');
      if (stat.size > 4 * 1024 * 1024) {
        throw new Error('Workspace file exceeds the 4 MB browser editor limit.');
      }
      return {
        content: fs.readFileSync(filePath, 'utf8'),
        revision: `${stat.size}:${stat.mtimeMs}`,
      };
    },
    listDirectory,
    mutateGit(body) {
      requireGitRepository();
      switch (body.operation) {
        case 'createBranch': {
          const branchName = validateBranchName(runGit, body.branchName ?? '');
          runGit(['switch', '-c', branchName]);
          break;
        }
        case 'switchBranch':
          switchBranch(body.branchName);
          break;
        case 'commit': {
          const message = body.message?.trim() || '';
          if (!message) throw new Error('Commit message is required.');
          if (Array.from(message).length > MAX_COMMIT_MESSAGE_CHARACTERS) {
            throw new Error(
              `Commit message must be ${MAX_COMMIT_MESSAGE_CHARACTERS} characters or fewer.`,
            );
          }
          if (!runGit(['status', '--porcelain'])) {
            throw new Error('There are no Git changes to commit.');
          }
          if (body.includeUnstaged !== false) {
            runGit(['add', '--all']);
          } else {
            const stagedDiff = spawnSync('git', ['diff', '--cached', '--quiet', '--exit-code'], {
              cwd: canonicalWorkspaceRoot,
              encoding: 'utf8',
              windowsHide: true,
            });
            if (stagedDiff.status === 0) {
              throw new Error('There are no staged Git changes to commit.');
            }
            if (stagedDiff.status !== 1) {
              throw new Error(commandErrorMessage(stagedDiff));
            }
          }
          runGit(['commit', '-m', message]);
          break;
        }
        case 'push':
          pushBranch(body);
          break;
        case 'createWorktree':
          createWorktree(body.branchName);
          break;
        case 'removeWorktree':
          removeWorktree(body);
          break;
        case 'pruneWorktrees':
          runGit(['worktree', 'prune']);
          break;
        default:
          throw new Error('Unsupported Git operation.');
      }
      return readGitOverview();
    },
    readGitDiff,
    readGitOverview,
    renameEntry(body) {
      fs.renameSync(resolveWorkspacePath(body.oldPath), resolveWorkspacePath(body.newPath, true));
    },
    saveContent(body) {
      const filePath = resolveWorkspacePath(body.path);
      if (typeof body.content !== 'string') throw new Error('File content is required.');
      fs.writeFileSync(filePath, body.content, 'utf8');
    },
  };
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readRequestBody(req: IncomingMessage): Promise<DeploymentWorkspaceRequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length === 0
    ? {}
    : JSON.parse(Buffer.concat(chunks).toString('utf8')) as DeploymentWorkspaceRequestBody;
}

export function createDeploymentWorkspacePlugin(workspaceRoot: string): Plugin {
  const runtime = createDeploymentWorkspaceHostRuntime(workspaceRoot);

  const handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const requestUrl = new URL(req.url ?? '/', 'http://birdcoder.local');
    if (!requestUrl.pathname.startsWith(DEPLOYMENT_WORKSPACE_URL_PREFIX)) {
      next();
      return;
    }

    try {
      const route = requestUrl.pathname.slice(DEPLOYMENT_WORKSPACE_URL_PREFIX.length);
      if (route === '/files' && req.method === 'GET') {
        writeJson(res, 200, { directory: runtime.listDirectory(requestUrl.searchParams.get('path')) });
        return;
      }
      if (route === '/content' && req.method === 'GET') {
        writeJson(res, 200, runtime.getContent(requestUrl.searchParams.get('path')));
        return;
      }
      if (route === '/content' && req.method === 'PUT') {
        runtime.saveContent(await readRequestBody(req));
        writeJson(res, 200, { updated: true });
        return;
      }
      if (route === '/entries' && req.method === 'POST') {
        runtime.createEntry(await readRequestBody(req));
        writeJson(res, 201, { created: true });
        return;
      }
      if (route === '/entries' && req.method === 'DELETE') {
        runtime.deleteEntry(
          requestUrl.searchParams.get('path'),
          requestUrl.searchParams.get('recursive') === 'true',
        );
        writeJson(res, 200, { deleted: true });
        return;
      }
      if (route === '/entries' && req.method === 'PATCH') {
        runtime.renameEntry(await readRequestBody(req));
        writeJson(res, 200, { renamed: true });
        return;
      }
      if (route === '/git' && req.method === 'GET') {
        writeJson(res, 200, runtime.readGitOverview());
        return;
      }
      if (route === '/git/diff' && req.method === 'GET') {
        writeJson(res, 200, runtime.readGitDiff());
        return;
      }
      if (route === '/git' && req.method === 'POST') {
        writeJson(res, 200, runtime.mutateGit(await readRequestBody(req)));
        return;
      }
      writeJson(res, 404, { message: 'Browser deployment workspace route not found.' });
    } catch (error) {
      writeJson(res, 400, {
        message: error instanceof Error ? error.message : 'Browser deployment workspace request failed.',
      });
    }
  };

  const attach = (server: {
    middlewares: {
      use: (handler: (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void,
      ) => void) => void;
    };
  }) => {
    server.middlewares.use((req, res, next) => { void handleRequest(req, res, next); });
  };

  return {
    name: 'birdcoder-browser-deployment-workspace',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export function resolveDeploymentWorkspaceRoot(
  appRootDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configuredRoot = environment.BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT?.trim()
    || environment.SDKWORK_BIRDCODER_APP_ROOT?.trim();
  return path.resolve(configuredRoot || path.resolve(appRootDirectory, '../../../../'));
}

// Retained for consumers that still probe Git synchronously during Vite configuration.
export function assertGitExecutableAvailable(): void {
  execFileSync('git', ['--version'], { stdio: 'ignore', windowsHide: true });
}
