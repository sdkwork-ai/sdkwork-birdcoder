import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
  resolveBirdcoderDevelopmentApiEnvDefines,
  resolveBirdcoderViteRuntimeEnvSource,
  resolveBirdcoderWebRuntimeEnvSource,
} from '../../../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOYMENT_WORKSPACE_URL_PREFIX = '/__sdkwork/deployment-workspace';
const DEPLOYMENT_WORKSPACE_IGNORED_DIRECTORY_NAMES = new Set([
  '.git', '.cache', '.turbo', 'dist', 'node_modules', 'target',
]);

interface DeploymentWorkspaceFileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: DeploymentWorkspaceFileNode[];
}

interface DeploymentWorkspaceRequestBody {
  branchName?: string;
  content?: string;
  force?: boolean;
  message?: string;
  newPath?: string;
  oldPath?: string;
  operation?: string;
  path?: string;
  remoteName?: string;
  type?: string;
  worktreeKey?: string;
}

function deploymentWorkspacePlugin(): Plugin {
  const configuredRoot =
    process.env.BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT?.trim()
    || process.env.SDKWORK_BIRDCODER_APP_ROOT?.trim();
  const workspaceRoot = path.resolve(configuredRoot || path.resolve(__dirname, '../../../../'));
  const canonicalWorkspaceRoot = fs.realpathSync.native(workspaceRoot);
  const rootName = path.basename(canonicalWorkspaceRoot);
  const rootVirtualPath = `/${rootName}`;

  const writeJson = (res: import('node:http').ServerResponse, statusCode: number, body: unknown) => {
    res.statusCode = statusCode;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

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
    if (relativeCandidate === '..' || relativeCandidate.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCandidate)) {
      throw new Error('Workspace path is outside the deployed project root.');
    }

    if (!allowMissing || fs.existsSync(candidatePath)) {
      const canonicalCandidate = fs.realpathSync.native(candidatePath);
      const canonicalRelative = path.relative(canonicalWorkspaceRoot, canonicalCandidate);
      if (canonicalRelative === '..' || canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative)) {
        throw new Error('Workspace path resolves outside the deployed project root.');
      }
      return canonicalCandidate;
    }

    const canonicalParent = fs.realpathSync.native(path.dirname(candidatePath));
    const parentRelative = path.relative(canonicalWorkspaceRoot, canonicalParent);
    if (parentRelative === '..' || parentRelative.startsWith(`..${path.sep}`) || path.isAbsolute(parentRelative)) {
      throw new Error('Workspace path parent resolves outside the deployed project root.');
    }
    return candidatePath;
  };

  const toVirtualPath = (absolutePath: string) => {
    const relativePath = path.relative(canonicalWorkspaceRoot, absolutePath).split(path.sep).join('/');
    return relativePath ? `${rootVirtualPath}/${relativePath}` : rootVirtualPath;
  };

  const listDirectory = (virtualPathValue?: string | null): DeploymentWorkspaceFileNode => {
    const directoryPath = resolveWorkspacePath(virtualPathValue);
    if (!fs.statSync(directoryPath).isDirectory()) {
      throw new Error('Workspace entry is not a directory.');
    }
    const children = fs.readdirSync(directoryPath, { withFileTypes: true })
      .filter((entry) => !entry.isSymbolicLink())
      .filter((entry) => !entry.isDirectory() || !DEPLOYMENT_WORKSPACE_IGNORED_DIRECTORY_NAMES.has(entry.name))
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

  const runGit = (args: readonly string[], allowFailure = false): string => {
    try {
      return execFileSync('git', ['-C', canonicalWorkspaceRoot, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (error) {
      if (allowFailure) {
        return '';
      }
      const stderr = error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr ?? '').trim()
        : '';
      throw new Error(stderr || (error instanceof Error ? error.message : 'Git operation failed.'));
    }
  };

  const readGitOverview = () => {
    if (runGit(['rev-parse', '--is-inside-work-tree'], true) !== 'true') {
      return {
        branches: [],
        detachedHead: false,
        status: 'not_repository',
        statusCounts: { staged: 0, unstaged: 0, untracked: 0 },
        worktrees: [],
      };
    }

    const currentBranch = runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], true);
    const currentRevision = runGit(['rev-parse', 'HEAD'], true);
    const localBranches = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], true)
      .split(/\r?\n/u).filter(Boolean)
      .map((name) => ({ name, isCurrent: name === currentBranch, isRemote: false }));
    const remoteBranches = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], true)
      .split(/\r?\n/u).filter(Boolean)
      .map((name) => ({ name, isCurrent: false, isRemote: true }));
    const statusCounts = { staged: 0, unstaged: 0, untracked: 0 };
    for (const line of runGit(['status', '--porcelain=v1'], true).split(/\r?\n/u).filter(Boolean)) {
      if (line.startsWith('??')) {
        statusCounts.untracked += 1;
      } else {
        if (line[0] && line[0] !== ' ') statusCounts.staged += 1;
        if (line[1] && line[1] !== ' ') statusCounts.unstaged += 1;
      }
    }

    const worktrees: Array<{ branch?: string; head?: string; isCurrent: boolean; worktreeKey?: string }> = [];
    let worktree: { branch?: string; head?: string; path?: string } = {};
    const flushWorktree = () => {
      if (!worktree.path) return;
      const canonicalWorktreePath = fs.realpathSync.native(worktree.path);
      const managedWorktreeRoot = path.join(canonicalWorkspaceRoot, '.sdkwork-worktrees');
      const relativeManagedPath = path.relative(managedWorktreeRoot, canonicalWorktreePath);
      worktrees.push({
        branch: worktree.branch,
        head: worktree.head,
        isCurrent: canonicalWorktreePath === canonicalWorkspaceRoot,
        ...(relativeManagedPath && !relativeManagedPath.includes(path.sep) && !relativeManagedPath.startsWith('..')
          ? { worktreeKey: relativeManagedPath }
          : {}),
      });
      worktree = {};
    };
    for (const line of runGit(['worktree', 'list', '--porcelain'], true).split(/\r?\n/u)) {
      if (!line) flushWorktree();
      else if (line.startsWith('worktree ')) worktree.path = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) worktree.head = line.slice('HEAD '.length);
      else if (line.startsWith('branch refs/heads/')) worktree.branch = line.slice('branch refs/heads/'.length);
    }
    flushWorktree();

    return {
      branches: [...localBranches, ...remoteBranches],
      currentBranch: currentBranch || undefined,
      currentRevision: currentRevision || undefined,
      detachedHead: !currentBranch,
      status: 'ready',
      statusCounts,
      worktrees,
    };
  };

  const readRequestBody = async (req: import('node:http').IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return chunks.length === 0
      ? {} as DeploymentWorkspaceRequestBody
      : JSON.parse(Buffer.concat(chunks).toString('utf8')) as DeploymentWorkspaceRequestBody;
  };

  const handleRequest = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
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
        writeJson(res, 200, { directory: listDirectory(requestUrl.searchParams.get('path')) });
        return;
      }
      if (route === '/content' && req.method === 'GET') {
        const filePath = resolveWorkspacePath(requestUrl.searchParams.get('path'));
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) throw new Error('Workspace entry is not a file.');
        if (stat.size > 4 * 1024 * 1024) throw new Error('Workspace file exceeds the 4 MB browser editor limit.');
        writeJson(res, 200, {
          content: fs.readFileSync(filePath, 'utf8'),
          revision: `${stat.size}:${stat.mtimeMs}`,
        });
        return;
      }
      if (route === '/content' && req.method === 'PUT') {
        const body = await readRequestBody(req);
        const filePath = resolveWorkspacePath(body.path);
        if (typeof body.content !== 'string') throw new Error('File content is required.');
        fs.writeFileSync(filePath, body.content, 'utf8');
        writeJson(res, 200, { updated: true });
        return;
      }
      if (route === '/entries' && req.method === 'POST') {
        const body = await readRequestBody(req);
        const entryPath = resolveWorkspacePath(body.path, true);
        if (body.type === 'directory') fs.mkdirSync(entryPath);
        else if (body.type === 'file') fs.writeFileSync(entryPath, '', { encoding: 'utf8', flag: 'wx' });
        else throw new Error('Entry type must be file or directory.');
        writeJson(res, 201, { created: true });
        return;
      }
      if (route === '/entries' && req.method === 'DELETE') {
        const entryPath = resolveWorkspacePath(requestUrl.searchParams.get('path'));
        if (entryPath === canonicalWorkspaceRoot) throw new Error('The deployment workspace root cannot be deleted.');
        fs.rmSync(entryPath, { recursive: requestUrl.searchParams.get('recursive') === 'true', force: false });
        writeJson(res, 200, { deleted: true });
        return;
      }
      if (route === '/entries' && req.method === 'PATCH') {
        const body = await readRequestBody(req);
        fs.renameSync(resolveWorkspacePath(body.oldPath), resolveWorkspacePath(body.newPath, true));
        writeJson(res, 200, { renamed: true });
        return;
      }
      if (route === '/git' && req.method === 'GET') {
        writeJson(res, 200, readGitOverview());
        return;
      }
      if (route === '/git' && req.method === 'POST') {
        const body = await readRequestBody(req);
        switch (body.operation) {
          case 'createBranch': runGit(['switch', '-c', body.branchName?.trim() || '']); break;
          case 'switchBranch': runGit(['switch', body.branchName?.trim() || '']); break;
          case 'commit':
            runGit(['add', '--all']);
            runGit(['commit', '-m', body.message?.trim() || '']);
            break;
          case 'push': {
            const branchName = body.branchName?.trim() || runGit(['symbolic-ref', '--short', 'HEAD']);
            runGit(['push', body.remoteName?.trim() || 'origin', branchName]);
            break;
          }
          case 'createWorktree': {
            const branchName = body.branchName?.trim() || '';
            const worktreeKey = branchName.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
            if (!worktreeKey) throw new Error('Worktree branch name is required.');
            const worktreePath = path.join(canonicalWorkspaceRoot, '.sdkwork-worktrees', worktreeKey);
            fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
            runGit(['worktree', 'add', '-b', branchName, worktreePath]);
            break;
          }
          case 'removeWorktree': {
            const worktreeKey = body.worktreeKey?.trim() || '';
            if (!/^[a-zA-Z0-9._-]+$/u.test(worktreeKey)) throw new Error('Worktree key is invalid.');
            const worktreePath = path.join(canonicalWorkspaceRoot, '.sdkwork-worktrees', worktreeKey);
            runGit(['worktree', 'remove', ...(body.force ? ['--force'] : []), worktreePath]);
            break;
          }
          case 'pruneWorktrees': runGit(['worktree', 'prune']); break;
          default: throw new Error('Unsupported Git operation.');
        }
        writeJson(res, 200, readGitOverview());
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
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
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

// 自定义插件：为 /data/sdkwork-models/ 提供静态文件服务
function sdkworkModelsDataPlugin(): Plugin {
  // Five parents reach the workspace root; sdkwork-models is its sibling.
  const sdkworkModelsRoot = path.resolve(__dirname, '../../../../../sdkwork-models');
  const DATA_URL_PREFIX = '/data/sdkwork-models/';

  const isPathInside = (rootPath: string, candidatePath: string): boolean => {
    const relativePath = path.relative(rootPath, candidatePath);
    return (
      relativePath.length > 0 &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    );
  };

  const resolveModelFile = (requestPath: string): string | null => {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(requestPath);
    } catch {
      return null;
    }

    if (!decodedPath || decodedPath.includes('\0') || path.isAbsolute(decodedPath)) {
      return null;
    }

    const rootPath = path.resolve(sdkworkModelsRoot);
    const candidatePath = path.resolve(rootPath, decodedPath);
    if (!isPathInside(rootPath, candidatePath)) {
      return null;
    }

    // Resolve symlinks/reparse points before serving so lexical containment
    // cannot be bypassed by a link inside the root.
    try {
      const canonicalRootPath = fs.realpathSync.native(rootPath);
      const canonicalCandidatePath = fs.realpathSync.native(candidatePath);
      return isPathInside(canonicalRootPath, canonicalCandidatePath)
        ? canonicalCandidatePath
        : null;
    } catch {
      return null;
    }
  };

  return {
    name: 'sdkwork-models-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url;
        let pathname = '';
        try {
          pathname = requestUrl
            ? new URL(requestUrl, 'http://birdcoder.local').pathname
            : '';
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }

        if (!pathname.startsWith(DATA_URL_PREFIX)) {
          next();
          return;
        }

        const filePath = resolveModelFile(pathname.slice(DATA_URL_PREFIX.length));
        if (!filePath) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

          // 安全检查：确保路径在 sdkwork-models 目录内
          // 使用 sirv 或直接发送文件
        let fileStat: fs.Stats;
        try {
          fileStat = fs.statSync(filePath);
        } catch {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        if (fileStat.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.json': 'application/json',
              '.js': 'application/javascript',
              '.ts': 'application/typescript',
              '.css': 'text/css',
              '.html': 'text/html',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            const stream = fs.createReadStream(filePath);
            stream.on('error', (error: Error) => {
              console.error('[sdkwork-models-data] Error reading file:', error);
              if (!res.headersSent) {
                res.statusCode = 500;
              }
              res.end('Internal Server Error');
            });
            stream.pipe(res);
            return;
        }

        res.statusCode = 404;
        res.end('Not Found');
      });
    },
  };
}

// Reserved governance names retained for BirdCoder standards:
// birdcoder-platform
// birdcoder-commons-root
// birdcoder-infrastructure-root

export default defineConfig(({ mode }) => {
  const runtimeEnvSource = resolveBirdcoderViteRuntimeEnvSource(
    loadEnv(mode, __dirname, ''),
  ) as Record<string, string | undefined>;
  const devProxyTarget =
    process.env.BIRDCODER_DEV_PROXY_TARGET ??
    runtimeEnvSource.VITE_BIRDCODER_API_BASE_URL ??
    'http://127.0.0.1:10240';
  const publicRuntimeEnvSource = resolveBirdcoderWebRuntimeEnvSource(
    runtimeEnvSource,
    mode,
  );

  return ({
    esbuild: false,
    oxc: false,
    define: resolveBirdcoderDevelopmentApiEnvDefines(mode),
    plugins: [
      ...createBirdcoderVitePlugins({
        appRootDir: __dirname,
        mode,
        namespace: 'sdkwork-birdcoder-pc-web',
        runtimeEnvSource: publicRuntimeEnvSource,
      }),
      deploymentWorkspacePlugin(),
      sdkworkModelsDataPlugin(),
    ],
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: resolveBirdcoderProductionMinify(mode),
      terserOptions: {
        compress: {
          passes: 5,
          drop_console: true,
          toplevel: true,
        },
        module: true,
        mangle: true,
        format: {
          comments: false,
        },
      },
      cssMinify: resolveBirdcoderProductionCssMinify(mode),
      sourcemap: false,
      modulePreload: {
        resolveDependencies(_filename, deps, context) {
          if (context.hostType !== 'html') {
            return deps;
          }

          return deps.filter(
            (dependency) =>
              !/^assets\/(?:birdcoder-iam-surface|birdcoder-platform|birdcoder-shell-bootstrap|birdcoder-code|birdcoder-studio-surface|birdcoder-multiwindow-surface|birdcoder-settings-surface|birdcoder-terminal-desktop|birdcoder-terminal-infrastructure|ui-workbench|ui-workbench-editors|ui-workbench-preview|ui-file-explorer|ui-chat|ui-run-dialogs|vendor-terminal-xterm|vendor-tauri|vendor-monaco|vendor-markdown|vendor-code-highlight)-/u.test(
                dependency,
              ),
          );
        },
      },
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
        output: {
          manualChunks(id) {
            const isSourcePath = (sourcePath: string) => id.includes(sourcePath);
            const isAnySourcePath = (sourcePaths: readonly string[]) =>
              sourcePaths.some((sourcePath) => isSourcePath(sourcePath));
            const getSourcePathFileStem = (sourcePath: string) => {
              const sourcePathIndex = id.indexOf(sourcePath);
              if (sourcePathIndex < 0) {
                return '';
              }

              const relativePath = id.slice(sourcePathIndex + sourcePath.length).split('?')[0] ?? '';
              return (relativePath.split('/').pop() ?? '')
                .replace(/\.[cm]?[jt]sx?$/u, '')
                .replace(/[^A-Za-z0-9_-]+/gu, '-')
                .replace(/^-+|-+$/gu, '')
                .toLowerCase();
            };
            const appSdkSourceRoot = '/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/';
            const appSdkApiSourceRoot = `${appSdkSourceRoot}api/`;
            const sdkCommonSourceRoot = '/sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/';
          if (
            id === '\0vite/preload-helper.js' ||
            id.includes('/node_modules/vite/modulepreload-polyfill')
          ) {
            return 'vite-preload-helper';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-pc-i18n/src/') ||
            id.includes('/node_modules/react-i18next/') ||
            id.includes('/node_modules/i18next/')
          ) {
            return 'birdcoder-code-workbench';
            }

          if (
            id.includes('/node_modules/react-dom/') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom-client') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom')
          ) {
            return 'vendor-react-dom';
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/use-sync-external-store/') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom-client') ||
            id.includes('sdkwork-birdcoder-pc-web-react-jsx-runtime') ||
            id.includes('sdkwork-birdcoder-pc-web-react-jsx-dev-runtime') ||
            id.includes('sdkwork-birdcoder-pc-web-react') ||
            id.includes('sdkwork-birdcoder-pc-web-scheduler') ||
            id.includes('sdkwork-birdcoder-pc-web-use-sync-external-store-shim')
          ) {
            return 'vendor-react-core';
          }

          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('react-router@')
          ) {
            return 'birdcoder-shell-app';
          }

          if (id.includes('/node_modules/i18next/') || id.includes('i18next@')) {
            return 'birdcoder-code-workbench';
          }

          if (id.includes('/node_modules/tailwind-merge/') || id.includes('tailwind-merge@')) {
            return 'ui-workbench';
          }

          if (id.includes('/node_modules/sonner/') || id.includes('sonner@')) {
            return 'ui-workbench';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          if (id.includes('/node_modules/qrcode/')) {
            return 'vendor-qrcode';
          }

          if (
            isAnySourcePath([
              '/sdkwork-utils/packages/sdkwork-utils-typescript/dist/',
              '/sdkwork-utils/packages/sdkwork-utils-typescript/src/',
              '/node_modules/@sdkwork/utils/',
            ])
          ) {
            return 'birdcoder-platform-utils';
          }

          if (isSourcePath(sdkCommonSourceRoot)) {
            return 'birdcoder-platform-sdk-common';
          }

          if (isSourcePath(appSdkApiSourceRoot)) {
            const appSdkApiModule = getSourcePathFileStem(appSdkApiSourceRoot);
            if (appSdkApiModule === 'base' || appSdkApiModule === 'index') {
              return 'birdcoder-platform-app-sdk-client';
            }
            return appSdkApiModule
              ? `birdcoder-platform-app-sdk-api-${appSdkApiModule}`
              : 'birdcoder-platform-app-sdk-api';
          }

          if (
            isAnySourcePath([
              `${appSdkSourceRoot}http/`,
              `${appSdkSourceRoot}auth/`,
            ])
          ) {
            return 'birdcoder-platform-app-sdk-runtime';
          }

          if (isSourcePath(`${appSdkSourceRoot}types/`)) {
            return 'birdcoder-platform-app-sdk-types';
          }

          if (
            isAnySourcePath([
              `${appSdkSourceRoot}index.ts`,
              `${appSdkSourceRoot}sdk.ts`,
            ])
          ) {
            return 'birdcoder-platform-app-sdk-client';
          }

          if (
            id.includes('/node_modules/@xterm/xterm/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-xterm')
          ) {
            return 'vendor-terminal-xterm';
          }

          if (
            id.includes('/node_modules/@xterm/addon-canvas/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-canvas')
          ) {
            return 'vendor-terminal-xterm-addon-canvas';
          }

          if (
            id.includes('/node_modules/@xterm/addon-fit/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-fit')
          ) {
            return 'vendor-terminal-xterm-addon-fit';
          }

          if (
            id.includes('/node_modules/@xterm/addon-search/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-search')
          ) {
            return 'vendor-terminal-xterm-addon-search';
          }

          if (
            id.includes('/node_modules/@xterm/addon-unicode11/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-unicode11')
          ) {
            return 'vendor-terminal-xterm-addon-unicode11';
          }

          if (
            id.includes('/node_modules/@xterm/addon-web-links/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-web-links')
          ) {
            return 'vendor-terminal-xterm-addon-web-links';
          }

          if (
            id.includes('/node_modules/@tauri-apps/api/window') ||
            id.includes('/node_modules/@tauri-apps/api/dpi')
          ) {
            return 'vendor-tauri-window';
          }

          if (id.includes('/node_modules/@tauri-apps/api/event')) {
            return 'vendor-tauri-event';
          }

          if (id.includes('/node_modules/@tauri-apps/api/core')) {
            return 'vendor-tauri-core';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/node_modules/@sdkwork/ui-pc-react/src/',
              '/sdkwork-ui/sdkwork-ui-pc-react/src/',
            ])
          ) {
            return 'sdkwork-ui-core';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-pc-ui-shell/src/') ||
            id.includes('/node_modules/@radix-ui/react-slot/') ||
            id.includes('/node_modules/class-variance-authority/') ||
            id.includes('/node_modules/clsx/') ||
            id.includes('/node_modules/tailwind-merge/')
          ) {
            return 'ui-shell';
          }

          if (
            id.includes('/node_modules/monaco-editor/') ||
            id.includes('/node_modules/@monaco-editor/')
          ) {
            return 'vendor-monaco';
          }

          if (
            id.includes('/node_modules/react-syntax-highlighter/') ||
            id.includes('/node_modules/prismjs/') ||
            id.includes('/node_modules/refractor/') ||
            id.includes('/node_modules/lowlight/')
          ) {
            return 'vendor-code-highlight';
          }

          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/unified/') ||
            id.includes('/node_modules/remark-') ||
            id.includes('/node_modules/mdast-') ||
            id.includes('/node_modules/micromark') ||
            id.includes('/node_modules/hast-') ||
            id.includes('/node_modules/vfile') ||
            id.includes('/node_modules/unist-util')
          ) {
            return 'vendor-markdown';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/index.ts')) {
            return 'birdcoder-ui';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-ui/src/components/CodeEditor.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/DiffEditor.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/monacoOverflowWidgets.ts',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/monacoRuntime.ts',
            ])
          ) {
            return 'ui-workbench-editors';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentPreviewer.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentCodePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentMarkdownPreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentStructuredDataPreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentKeyValuePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentTablePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/contentPreview.ts',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/contentPreviewStructuredData.ts',
            ])
          ) {
            return 'ui-workbench-preview';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/RunConfigurationDialogs.tsx')
          ) {
            return 'ui-run-dialogs';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorer')
          ) {
            return 'ui-file-explorer';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/chat/')
          ) {
            return 'ui-chat';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-web/src/loadAppRoot.ts')
          ) {
            return 'birdcoder-shell-entry';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell/src/index.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/app.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppRoot.tsx',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/loadBirdcoderApp.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/providers/',
            ])
          ) {
            return 'birdcoder-shell-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/',
            ])
          ) {
            return 'birdcoder-shell-app';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/runtime/defaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-runtime-config';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/appbasePcAuthRuntime.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/appbasePcAuthSessionBridge.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/attachSdkworkSdkSessionAuthBoundary.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/createSdkworkSessionAuthUnauthorizedIntegration.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/handleSdkworkSessionAuthUnauthorizedError.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sdkSessionAuthError.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sessionAuthUnauthorized.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sessionAuthUnauthorizedEnv.ts',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-workbench-storage/src/',
              '/packages/sdkwork-birdcoder-pc-commons/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/storage/localStore.ts',
            ])
          ) {
            return 'birdcoder-workbench-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench-state/src/')) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/registry.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/profiles.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/runConfigStorage.ts',
            ])
          ) {
            return 'birdcoder-terminal-profiles';
          }

          if (
            isAnySourcePath([
              '/sdkwork-terminal/apps/desktop/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-desktop/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-ai-cli/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-diagnostics/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-i18n/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-resources/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-sessions/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-settings/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-shell/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-ui/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-workbench/src/',
            ])
          ) {
            return 'birdcoder-terminal-desktop';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/terminalRuntimeSanitization.ts',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-commons/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-contracts/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-infrastructure/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-types/src/',
            ])
          ) {
            return 'birdcoder-terminal-infrastructure';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx')
          ) {
            return 'birdcoder-code-topbar';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer',
            ])
          ) {
            return 'birdcoder-code-sidebar';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodeMobileProgrammingPanel.tsx')
          ) {
            return 'birdcoder-code-mobile';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageDialogs.tsx')
          ) {
            return 'birdcoder-code-dialogs';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodeWorkspaceOverlays.tsx')
          ) {
            return 'birdcoder-code-overlays';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorSurface.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageSurface.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeTerminalIntegrationPanel.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeTerminalIntegrationPanel.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageSurface.tsx',
            ])
          ) {
            return 'birdcoder-code-workbench';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts')
          ) {
            return 'birdcoder-code-workbench';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeLocalFolderProjectImport.ts')
          ) {
            return 'birdcoder-code-project-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeProjectSessionResolution.ts')) {
            return 'birdcoder-code-session-location-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/codeFileSearch.ts')) {
            return 'birdcoder-code-search-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSessionSelection.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePendingInteractions.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeNewCodingSessionRequestState.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeDeleteConfirmation.ts',
            ])
          ) {
            return 'birdcoder-code-session-runtime';
          }

          if (isAnySourcePath([
            '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEditorChatLayout.ts',
            '/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageShared.tsx',
          ])) {
            return 'birdcoder-code-workbench';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageClipboardActions.ts')) {
            return 'birdcoder-code-clipboard-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/codingSessionTerminal.ts',
            ])
          ) {
            return 'birdcoder-code-terminal-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeRunEntryActions.ts')) {
            return 'birdcoder-code-run-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts')) {
            return 'birdcoder-code-commands-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/')) {
            return 'birdcoder-code-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/')) {
            return 'birdcoder-code-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-studio/src/')) {
            return 'birdcoder-studio-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-multiwindow/src/')) {
            return 'birdcoder-multiwindow-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-settings/src/')) {
            return 'birdcoder-settings-surface';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
            ])
          ) {
            return 'birdcoder-shell-bootstrap';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/workbench/preferences.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/workbench/recovery.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/BootstrapGate.tsx',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/loadBootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerApiReady.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/index.ts',
            ])
          ) {
            return 'birdcoder-shell-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/data.ts',
            ])
          ) {
            return 'birdcoder-types-data';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
              '/packages/sdkwork-birdcoder-pc-types/src/generated/',
            ])
          ) {
            return 'birdcoder-types-api';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/storageBindings.ts',
            ])
          ) {
            return 'birdcoder-types-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-types/src/')) {
            return 'birdcoder-types';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-codeengine/src/',
            ])
          ) {
            return 'birdcoder-codeengine';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/index.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-definition.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-appearance.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-config.ts',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-authority.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-controller.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-copy.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-local-service.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-runtime-config.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-runtime-authority.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-service.ts',
            ])
          ) {
            return 'birdcoder-platform-auth-runtime';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-intl.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/auth/',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/auth-page-shell.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/oauth-provider-grid.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/qr-login-panel.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/pages/',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/index.ts')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/pages/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/index.ts')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/pages/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-git/src/')) {
            return 'birdcoder-git';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-commons/src/index.ts')) {
            return 'birdcoder-commons-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts')) {
            return 'birdcoder-infrastructure-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-iam/src/index.ts',
              '/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts',
            ])
          ) {
            return 'birdcoder-iam-integration';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/runtime.ts',
            ])
          ) {
            return 'birdcoder-storage-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sessionService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdcoderMobileChatApi.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeAuthService.ts',
              '/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/',
              '/sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
            ])
          ) {
            return 'birdcoder-platform-filesystem';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/bootstrapConsoleCatalog.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptEntryText.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/savedPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlBackendExecutors.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlExecutor.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlPlans.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlRowCodec.ts',
            ])
          ) {
            return 'birdcoder-platform-storage';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localBusinessUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localServerRequestId.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/apiJson.ts',
              '/packages/sdkwork-birdcoder-pc-core/src/appSessionEvents.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionEvents.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/codingSessionMessageProjection.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/codingSessionSelection.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeApiRetry.ts',
            ])
          ) {
            return 'birdcoder-platform-service-core';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-provider-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAdminDeploymentService.ts',
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAdminPolicyService.ts',
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAuditService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCollaborationService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeWriteService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedDeploymentService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedDocumentService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedGitService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedReleaseService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedTeamService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-api-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/context/ideServices.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/IDEContext.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/AuthContext.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/ServiceContext.tsx',
              '/packages/sdkwork-birdcoder-pc-commons/src/contexts/ToastProvider.tsx',
              '/packages/sdkwork-birdcoder-pc-commons/src/utils/EventBus.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/hooks/useDebounce.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/')) {
            return 'ui-workbench';
          }

            return undefined;
          },
        },
      },
    },
    resolve: {
      dedupe: [...BIRDCODER_VITE_DEDUPE_PACKAGES],
      alias: createBirdcoderWorkspaceAliasEntries(__dirname),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(__dirname),
      },
      proxy: {
        '/app': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/backend': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/readyz': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/healthz': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/livez': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/metrics': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/openapi.json': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
  });
});
