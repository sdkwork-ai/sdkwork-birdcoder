#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRootDir = path.resolve(__dirname, '..');

export const SHARED_SDK_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_REF';
export const SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_FORCE_SYNC';
export const SHARED_SDK_GIT_PROTOCOL_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_PROTOCOL';
export const SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR = 'SDKWORK_SHARED_SDK_RELEASE_CONFIG_PATH';
export const SHARED_SDK_GITHUB_TOKEN_ENV_VAR = 'SDKWORK_SHARED_SDK_GITHUB_TOKEN';

export const SHARED_APPBASE_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_APPBASE_REPO_URL';
export const SHARED_CORE_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_CORE_REPO_URL';
export const SHARED_UI_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_UI_REPO_URL';
export const SHARED_TERMINAL_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_TERMINAL_REPO_URL';
export const SHARED_APP_SDK_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_APP_SDK_REPO_URL';
export const SHARED_SDK_COMMONS_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMONS_REPO_URL';

export const SHARED_APPBASE_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_APPBASE_GIT_REF';
export const SHARED_CORE_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_CORE_GIT_REF';
export const SHARED_UI_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_UI_GIT_REF';
export const SHARED_TERMINAL_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_TERMINAL_GIT_REF';
export const SHARED_APP_SDK_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_APP_SDK_GIT_REF';
export const SHARED_SDK_COMMONS_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMONS_GIT_REF';

export const DEFAULT_SHARED_APPBASE_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-appbase.git';
export const DEFAULT_SHARED_CORE_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-core.git';
export const DEFAULT_SHARED_UI_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-ui.git';
export const DEFAULT_SHARED_TERMINAL_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-terminal.git';
export const DEFAULT_SHARED_APP_SDK_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git';
export const DEFAULT_SHARED_SDK_COMMONS_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-commons.git';
export const DEFAULT_SHARED_SDK_RELEASE_CONFIG_PATH = 'config/shared-sdk-release-sources.json';
const SHARED_SDK_AUTH_TOKEN_ENV_VARS = Object.freeze([
  SHARED_SDK_GITHUB_TOKEN_ENV_VAR,
  'GITHUB_TOKEN',
  'GH_TOKEN',
]);

function resolveGitCommand() {
  const configuredCandidates = [
    process.env.GIT_EXE,
    process.env.GIT,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  const defaultCandidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\bin\\git.exe',
  ];

  for (const candidate of [...configuredCandidates, ...defaultCandidates]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const whereResult = spawnSync('where.exe', ['git'], {
    encoding: 'utf8',
    shell: false,
  });
  if (whereResult.status === 0) {
    const resolvedCandidate = String(whereResult.stdout ?? '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (resolvedCandidate) {
      return resolvedCandidate;
    }
  }

  return 'git.exe';
}

export function resolveSpawnCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (command === 'git') {
    return resolveGitCommand();
  }

  if (command === 'pnpm') {
    return 'pnpm.cmd';
  }

  return command;
}

function run(
  command,
  args,
  {
    cwd = process.cwd(),
    captureStdout = false,
    env,
    spawnSyncImpl = spawnSync,
  } = {},
) {
  const result = spawnSyncImpl(resolveSpawnCommand(command), args, {
    cwd,
    encoding: 'utf8',
    env: createGitCommandEnvironment(env),
    stdio: captureStdout ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stderrSuffix = stderr.length > 0 ? `: ${stderr}` : '';
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${stderrSuffix}`,
    );
  }

  return String(result.stdout ?? '').trim();
}

function createGitCommandEnvironment(extraEnv = {}) {
  const commandEnv = {
    ...process.env,
    ...extraEnv,
  };

  for (const tokenEnvVar of SHARED_SDK_AUTH_TOKEN_ENV_VARS) {
    delete commandEnv[tokenEnvVar];
  }

  return commandEnv;
}

function parseBooleanFlag(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCommitHash(value) {
  return /^[0-9a-f]{40}$/iu.test(String(value ?? '').trim());
}

function normalizeGitRepoUrl(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '').trim();
  if (normalizedRepoUrl.length === 0) {
    return '';
  }

  const scpLikeMatch = normalizedRepoUrl.match(/^[^@]+@([^:]+):(.+)$/u);
  if (scpLikeMatch) {
    return `${scpLikeMatch[1]}/${scpLikeMatch[2]}`
      .replace(/\.git$/iu, '')
      .replaceAll('\\', '/')
      .replace(/\/+$/u, '')
      .toLowerCase();
  }

  if (/^[a-z]+:\/\//iu.test(normalizedRepoUrl)) {
    try {
      const parsedUrl = new URL(normalizedRepoUrl);
      return `${parsedUrl.host}${parsedUrl.pathname}`
        .replace(/\.git$/iu, '')
        .replace(/\/+$/u, '')
        .toLowerCase();
    } catch {
      // Fall through to path normalization.
    }
  }

  return path.resolve(normalizedRepoUrl).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}

function areEquivalentGitRepoUrls(left, right) {
  return normalizeGitRepoUrl(left) === normalizeGitRepoUrl(right);
}

function isGithubHttpsRepoUrl(repoUrl) {
  try {
    const parsedUrl = new URL(String(repoUrl ?? '').trim());
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.toLowerCase() === 'github.com';
  } catch {
    return false;
  }
}

function isGithubSshRepoUrl(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '').trim();
  return /^git@github\.com:.+$/iu.test(normalizedRepoUrl)
    || /^ssh:\/\/git@github\.com\/.+$/iu.test(normalizedRepoUrl);
}

function resolveSharedSdkGitProtocol(env = process.env) {
  const protocol = typeof env?.[SHARED_SDK_GIT_PROTOCOL_ENV_VAR] === 'string'
    ? env[SHARED_SDK_GIT_PROTOCOL_ENV_VAR].trim().toLowerCase()
    : '';
  return protocol === 'ssh' ? 'ssh' : 'https';
}

function toGithubSshRepoUrl(repoUrl) {
  if (!isGithubHttpsRepoUrl(repoUrl)) {
    return repoUrl;
  }

  const parsedUrl = new URL(String(repoUrl).trim());
  const repoPath = parsedUrl.pathname.replace(/^\/+/u, '');
  return `git@github.com:${repoPath}`;
}

function resolveTransportRepoUrl(repoUrl, env = process.env) {
  if (resolveSharedSdkGitProtocol(env) !== 'ssh') {
    return repoUrl;
  }

  return toGithubSshRepoUrl(repoUrl);
}

function resolveEmptyGitConfigPath(env = process.env) {
  if (process.platform === 'win32') {
    const tempRoot = typeof env?.RUNNER_TEMP === 'string' && env.RUNNER_TEMP.trim().length > 0
      ? env.RUNNER_TEMP.trim()
      : os.tmpdir();
    const configPath = path.join(tempRoot, 'sdkwork-shared-sdk-empty-gitconfig');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, '', 'utf8');
    }
    return configPath;
  }

  return os.devNull;
}

function resolveSharedSdkGithubToken(env = process.env) {
  for (const tokenEnvVar of SHARED_SDK_AUTH_TOKEN_ENV_VARS) {
    const token = typeof env?.[tokenEnvVar] === 'string' ? env[tokenEnvVar].trim() : '';
    if (token.length > 0) {
      return token;
    }
  }

  return '';
}

export function createGithubAuthGitEnv(repoUrl, env = process.env) {
  if (!isGithubHttpsRepoUrl(repoUrl)) {
    return {};
  }

  const token = resolveSharedSdkGithubToken(env);
  if (!token) {
    return {};
  }

  const configIndex = Number.parseInt(String(env?.GIT_CONFIG_COUNT ?? '0'), 10);
  const nextConfigIndex = Number.isFinite(configIndex) && configIndex >= 0 ? configIndex : 0;
  const authHeader = Buffer
    .from(`x-access-token:${token}`, 'utf8')
    .toString('base64');

  return {
    GIT_CONFIG_COUNT: String(nextConfigIndex + 1),
    [`GIT_CONFIG_KEY_${nextConfigIndex}`]: 'http.https://github.com/.extraheader',
    [`GIT_CONFIG_VALUE_${nextConfigIndex}`]: `AUTHORIZATION: basic ${authHeader}`,
  };
}

function createSharedSdkGitEnv(repoUrl, env = process.env) {
  if (isGithubSshRepoUrl(repoUrl)) {
    return {
      GIT_CONFIG_GLOBAL: resolveEmptyGitConfigPath(env),
      GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=accept-new',
    };
  }

  return createGithubAuthGitEnv(repoUrl, env);
}

export function createSharedSdkSourceSpecs(workspaceRootDir = defaultWorkspaceRootDir) {
  return [
    {
      id: 'sdkwork-appbase',
      label: 'sdkwork-appbase',
      repoRoot: path.resolve(workspaceRootDir, '..', 'sdkwork-appbase'),
      requiredPaths: ['package.json'],
      repoUrlEnvVar: SHARED_APPBASE_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_APPBASE_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_APPBASE_REPO_URL,
    },
    {
      id: 'sdkwork-core',
      label: 'sdkwork-core',
      repoRoot: path.resolve(workspaceRootDir, '..', 'sdkwork-core'),
      requiredPaths: ['package.json'],
      repoUrlEnvVar: SHARED_CORE_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_CORE_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_CORE_REPO_URL,
    },
    {
      id: 'sdkwork-ui',
      label: 'sdkwork-ui',
      repoRoot: path.resolve(workspaceRootDir, '..', 'sdkwork-ui'),
      requiredPaths: ['sdkwork-ui-pc-react/package.json'],
      repoUrlEnvVar: SHARED_UI_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_UI_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_UI_REPO_URL,
    },
    {
      id: 'sdkwork-terminal',
      label: 'sdkwork-terminal',
      repoRoot: path.resolve(workspaceRootDir, '..', 'sdkwork-terminal'),
      requiredPaths: ['apps/desktop/package.json'],
      repoUrlEnvVar: SHARED_TERMINAL_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_TERMINAL_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_TERMINAL_REPO_URL,
    },
    {
      id: 'sdkwork-sdk-app',
      label: 'sdkwork-sdk-app',
      repoRoot: path.resolve(workspaceRootDir, '..', '..', 'spring-ai-plus-app-api', 'sdkwork-sdk-app'),
      requiredPaths: ['sdkwork-app-sdk-typescript/package.json'],
      repoUrlEnvVar: SHARED_APP_SDK_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_APP_SDK_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_APP_SDK_REPO_URL,
    },
    {
      id: 'sdkwork-sdk-commons',
      label: 'sdkwork-sdk-commons',
      repoRoot: path.resolve(workspaceRootDir, '..', '..', 'sdk', 'sdkwork-sdk-commons'),
      requiredPaths: ['sdkwork-sdk-common-typescript/package.json'],
      repoUrlEnvVar: SHARED_SDK_COMMONS_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_COMMONS_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_COMMONS_REPO_URL,
    },
  ];
}

export function resolveSharedSdkReleaseConfigPath(
  workspaceRootDir = defaultWorkspaceRootDir,
  env = process.env,
) {
  const configuredPath = typeof env?.[SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR] === 'string'
    ? env[SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR].trim()
    : '';

  return path.resolve(
    workspaceRootDir,
    configuredPath.length > 0 ? configuredPath : DEFAULT_SHARED_SDK_RELEASE_CONFIG_PATH,
  );
}

export function readSharedSdkReleaseConfig(
  workspaceRootDir = defaultWorkspaceRootDir,
  env = process.env,
) {
  const configPath = resolveSharedSdkReleaseConfigPath(workspaceRootDir, env);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Missing shared SDK release config at ${configPath}.`,
    );
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const sourceMap = rawConfig?.sources;
  if (!isObject(sourceMap)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Invalid shared SDK release config at ${configPath}: missing sources map.`,
    );
  }

  return {
    configPath,
    sources: sourceMap,
  };
}

function resolveConfiguredSource(spec, sourceMap, env) {
  const configuredSource = sourceMap?.[spec.id];
  if (!isObject(configuredSource)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Missing ${spec.id} source in the shared SDK release config.`,
    );
  }

  const repoUrl = typeof env?.[spec.repoUrlEnvVar] === 'string' && env[spec.repoUrlEnvVar].trim().length > 0
    ? env[spec.repoUrlEnvVar].trim()
    : typeof configuredSource.repoUrl === 'string' && configuredSource.repoUrl.trim().length > 0
      ? configuredSource.repoUrl.trim()
      : spec.defaultRepoUrl;
  if (!repoUrl || repoUrl.trim().length === 0) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Missing repoUrl for ${spec.label}.`,
    );
  }

  const targetRef = typeof env?.[spec.refEnvVar] === 'string' && env[spec.refEnvVar].trim().length > 0
    ? env[spec.refEnvVar].trim()
    : typeof env?.[SHARED_SDK_GIT_REF_ENV_VAR] === 'string' && env[SHARED_SDK_GIT_REF_ENV_VAR].trim().length > 0
      ? env[SHARED_SDK_GIT_REF_ENV_VAR].trim()
      : typeof configuredSource.ref === 'string' && configuredSource.ref.trim().length > 0
        ? configuredSource.ref.trim()
        : 'main';

  return {
    repoUrl,
    targetRef,
  };
}

export function isGitCheckout(repoRoot, { spawnSyncImpl } = {}) {
  if (!fs.existsSync(repoRoot)) {
    return false;
  }

  try {
    const output = run('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree'], {
      captureStdout: true,
      spawnSyncImpl,
    });
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

function resolveGitTopLevel(repoRoot, { spawnSyncImpl } = {}) {
  return run('git', ['-C', repoRoot, 'rev-parse', '--show-toplevel'], {
    captureStdout: true,
    spawnSyncImpl,
  });
}

function resolveOriginUrl(repoRoot, { spawnSyncImpl } = {}) {
  return run('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
    captureStdout: true,
    spawnSyncImpl,
  });
}

function resolveCurrentHead(repoRoot, { spawnSyncImpl } = {}) {
  return run('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
    captureStdout: true,
    spawnSyncImpl,
  });
}

function resolveCurrentBranch(repoRoot, { spawnSyncImpl } = {}) {
  return run('git', ['-C', repoRoot, 'branch', '--show-current'], {
    captureStdout: true,
    spawnSyncImpl,
  });
}

function directoryHasEntries(targetPath) {
  return fs.existsSync(targetPath)
    && fs.statSync(targetPath).isDirectory()
    && fs.readdirSync(targetPath).length > 0;
}

function assertRequiredPathsExist(spec, repoRoot) {
  for (const relativePath of spec.requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (fs.existsSync(absolutePath)) {
      continue;
    }

    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} path at ${absolutePath}.`,
    );
  }
}

function assertGitCheckoutIsClean(repoRoot, label, { spawnSyncImpl } = {}) {
  const statusOutput = run('git', ['-C', repoRoot, 'status', '--porcelain'], {
    captureStdout: true,
    spawnSyncImpl,
  });
  if (statusOutput.length === 0) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Refusing to use ${label} at ${repoRoot} because the checkout has uncommitted changes.`,
  );
}

function assertStandaloneCheckoutRoot(spec, repoRoot, { spawnSyncImpl } = {}) {
  const topLevel = path.resolve(resolveGitTopLevel(repoRoot, { spawnSyncImpl }));
  const expectedRoot = path.resolve(repoRoot);
  if (topLevel === expectedRoot) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Expected ${spec.label} checkout root at ${expectedRoot}, but git top-level is ${topLevel}.`,
  );
}

function assertRemoteMatchesConfiguredRepo(spec, repoRoot, repoUrl, { spawnSyncImpl } = {}) {
  const originUrl = resolveOriginUrl(repoRoot, { spawnSyncImpl });
  if (areEquivalentGitRepoUrls(originUrl, repoUrl)) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Refusing to use ${spec.label} at ${repoRoot} because origin ${originUrl} does not match configured repo ${repoUrl}.`,
  );
}

function checkoutMatchesTargetRef(repoRoot, targetRef, { spawnSyncImpl } = {}) {
  if (isCommitHash(targetRef)) {
    return resolveCurrentHead(repoRoot, { spawnSyncImpl }).toLowerCase() === targetRef.toLowerCase();
  }

  return resolveCurrentBranch(repoRoot, { spawnSyncImpl }) === targetRef;
}

function cloneSourceRepo({ repoRoot, repoUrl, targetRef, env, spawnSyncImpl }) {
  const transportRepoUrl = resolveTransportRepoUrl(repoUrl, env);
  fs.mkdirSync(path.dirname(repoRoot), { recursive: true });
  run('git', ['clone', transportRepoUrl, repoRoot], {
    env: createSharedSdkGitEnv(transportRepoUrl, env),
    spawnSyncImpl,
  });
  run('git', ['-C', repoRoot, 'checkout', '--force', targetRef], { spawnSyncImpl });
}

function syncExistingSourceRepo({ repoRoot, repoUrl, targetRef, env, spawnSyncImpl }) {
  const transportRepoUrl = resolveTransportRepoUrl(repoUrl, env);
  run('git', ['-C', repoRoot, 'remote', 'set-url', 'origin', transportRepoUrl], { spawnSyncImpl });
  run('git', ['-C', repoRoot, 'fetch', '--tags', '--prune', 'origin'], {
    env: createSharedSdkGitEnv(transportRepoUrl, env),
    spawnSyncImpl,
  });
  run('git', ['-C', repoRoot, 'checkout', '--force', targetRef], { spawnSyncImpl });
  run('git', ['-C', repoRoot, 'clean', '-fd'], { spawnSyncImpl });
}

function ensureSourceSpecReady(
  spec,
  {
    repoUrl,
    targetRef,
    syncExistingRepos,
    env,
    logger,
    spawnSyncImpl,
  },
) {
  if (!fs.existsSync(spec.repoRoot)) {
    cloneSourceRepo({
      repoRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      env,
      spawnSyncImpl,
    });
    assertStandaloneCheckoutRoot(spec, spec.repoRoot, { spawnSyncImpl });
    assertRequiredPathsExist(spec, spec.repoRoot);
    logger.log(
      `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
    );
    return {
      id: spec.id,
      label: spec.label,
      repoRoot: spec.repoRoot,
      packageRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      changed: true,
      status: 'ready',
    };
  }

  if (!isGitCheckout(spec.repoRoot, { spawnSyncImpl })) {
    if (directoryHasEntries(spec.repoRoot)) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Expected ${spec.repoRoot} to be a git checkout for ${spec.label}.`,
      );
    }

    cloneSourceRepo({
      repoRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      env,
      spawnSyncImpl,
    });
    assertStandaloneCheckoutRoot(spec, spec.repoRoot, { spawnSyncImpl });
    assertRequiredPathsExist(spec, spec.repoRoot);
    logger.log(
      `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
    );
    return {
      id: spec.id,
      label: spec.label,
      repoRoot: spec.repoRoot,
      packageRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      changed: true,
      status: 'ready',
    };
  }

  assertStandaloneCheckoutRoot(spec, spec.repoRoot, { spawnSyncImpl });
  assertRequiredPathsExist(spec, spec.repoRoot);
  assertGitCheckoutIsClean(spec.repoRoot, spec.label, { spawnSyncImpl });
  assertRemoteMatchesConfiguredRepo(spec, spec.repoRoot, repoUrl, { spawnSyncImpl });

  let changed = false;
  if (!checkoutMatchesTargetRef(spec.repoRoot, targetRef, { spawnSyncImpl })) {
    if (!syncExistingRepos) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Expected ${spec.label} at ${spec.repoRoot} to be on pinned ref ${targetRef}.`,
      );
    }

    syncExistingSourceRepo({
      repoRoot: spec.repoRoot,
      repoUrl,
      targetRef,
      env,
      spawnSyncImpl,
    });
    changed = true;
  }

  assertRequiredPathsExist(spec, spec.repoRoot);
  logger.log(
    `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
  );

  return {
    id: spec.id,
    label: spec.label,
    repoRoot: spec.repoRoot,
    packageRoot: spec.repoRoot,
    repoUrl,
    targetRef,
    changed,
    status: 'ready',
  };
}

export function ensureSharedSdkGitSources({
  workspaceRootDir = defaultWorkspaceRootDir,
  env = process.env,
  logger = console,
  syncExistingRepos = parseBooleanFlag(env?.[SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR]),
  spawnSyncImpl,
} = {}) {
  const mode = resolveSharedSdkMode(env);
  if (mode !== 'git') {
    logger.log('[prepare-shared-sdk-git-sources] shared SDK mode is source; skipping git materialization.');
    return {
      mode,
      changed: false,
      sources: [],
      status: 'skipped',
    };
  }

  const { sources: sourceMap } = readSharedSdkReleaseConfig(workspaceRootDir, env);
  const sources = createSharedSdkSourceSpecs(workspaceRootDir).map((spec) => {
    const configuredSource = resolveConfiguredSource(spec, sourceMap, env);
    return ensureSourceSpecReady(spec, {
      ...configuredSource,
      syncExistingRepos,
      env,
      logger,
      spawnSyncImpl,
    });
  });

  return {
    mode,
    changed: sources.some((source) => source.changed),
    sources,
    status: 'ready',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(ensureSharedSdkGitSources(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
