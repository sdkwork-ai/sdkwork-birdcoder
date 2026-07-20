#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  formatNetworkAccessLines,
  resolveNetworkAccessUrls,
} from '@sdkwork/app-topology/network-access';

import {
  parseBirdcoderIamCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import {
  resolveBirdcoderIamCommandEnv,
} from './birdcoder-iam-env.mjs';
import { createWorkspacePackageScriptPlan } from './run-workspace-package-script.mjs';

const __filename = fileURLToPath(import.meta.url);
const WORKSPACE_ROOT = path.resolve(path.dirname(__filename), '..');

const DEFAULT_SERVER_READY_POLL_INTERVAL_MS = 350;
const DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS = 800;
const DEFAULT_SERVER_READY_TIMEOUT_MS = 300000;
const DEFAULT_SERVER_READY_PATHS = Object.freeze([
  '/readyz',
]);
const DEFAULT_STACK_VITE_MODE = 'development';
const CLIENT_LOOPBACK_PORT_FALLBACK_HOST = '127.0.0.1';
const CLIENT_LOOPBACK_PORT_FALLBACK_MAX_ATTEMPTS = 20;
const DEFAULT_WEB_CLIENT_HOST = '0.0.0.0';
const DEFAULT_CLIENT_READY_TIMEOUT_MS = 30000;
const STACK_VITE_MODES = new Set(['development', 'test']);

const STACK_SURFACE_CONFIGS = Object.freeze({
  desktop: {
    clientPackageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop',
    clientScriptNamesByViteMode: {
      development: 'start:desktop',
      test: 'start:desktop:check',
    },
    target: 'desktop-dev',
  },
  web: {
    browser: true,
    clientPackageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
    clientScriptNamesByViteMode: {
      development: 'start:browser',
      test: 'start:browser:check',
    },
    target: 'web-dev',
  },
  h5: {
    browser: true,
    clientPackageDir: 'apps/sdkwork-birdcoder-h5',
    clientScriptNamesByViteMode: {
      development: 'start:browser',
      test: 'start:browser:check',
    },
    target: 'h5-dev',
  },
});

const SERVER_DEV_CONFIG = Object.freeze({
    packageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server',
  scriptName: 'start:server',
  target: 'server-dev',
});

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function readTrimmedValue(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || undefined;
}

function resolveStackViteMode(value) {
  const normalizedValue = readTrimmedValue(value) ?? DEFAULT_STACK_VITE_MODE;
  if (!STACK_VITE_MODES.has(normalizedValue)) {
    throw new Error(
      `run-birdcoder-dev-stack only supports --vite-mode ${[...STACK_VITE_MODES].join(' or ')}.`,
    );
  }

  return normalizedValue;
}

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const target = String(tokens.shift() ?? '').trim();
  if (!Object.prototype.hasOwnProperty.call(STACK_SURFACE_CONFIGS, target)) {
    throw new Error(
      `run-birdcoder-dev-stack requires one target argument: ${Object.keys(STACK_SURFACE_CONFIGS).join(', ')}.`,
    );
  }

  let dryRun = false;
  let passthroughMode = false;
  const iamTokens = [];
  const clientArgs = [];
  for (const token of tokens) {
    if (token === '--') {
      passthroughMode = true;
      continue;
    }

    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (passthroughMode) {
      clientArgs.push(token);
      continue;
    }

    iamTokens.push(token);
  }

  const {
    iamMode,
    viteMode,
  } = parseBirdcoderIamCliOptions(iamTokens, {
    allowViteMode: true,
    commandName: 'run-birdcoder-dev-stack',
  });

  return {
    clientArgs,
    dryRun,
    iamMode,
    target,
    viteMode: resolveStackViteMode(viteMode),
  };
}

function resolveApiOriginUrl(env) {
  const rawApiBaseUrl =
    readTrimmedValue(env.BIRDCODER_API_BASE_URL)
    || readTrimmedValue(env.VITE_BIRDCODER_API_BASE_URL)
    || readTrimmedValue(env.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL)
    || readTrimmedValue(env.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL);
  if (!rawApiBaseUrl) {
    return undefined;
  }

  try {
    return new URL(rawApiBaseUrl);
  } catch {
    return undefined;
  }
}

function sqliteDatabaseUrl(filePath) {
  const normalizedPath = String(filePath).replace(/\\/gu, '/');
  return `sqlite:///${normalizedPath}?mode=rwc`;
}

// Detects the database engine from a connection URL so the gateway process
// gets a service-specific engine hint. Without this, SDKWORK_CLAW_DATABASE_ENGINE
// (leaked from .env.postgres when IAM dev login needs PostgreSQL) overrides URL
// scheme detection in sdkwork-database-config and wrongly classifies SQLite URLs
// as Postgres, causing sqlx to reject the appended `options=-c search_path=...`.
function detectDatabaseEngineFromUrl(url) {
  const normalized = String(url ?? '').toLowerCase();
  if (normalized.startsWith('sqlite:')) {
    return 'sqlite';
  }
  if (normalized.startsWith('postgres://') || normalized.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return undefined;
}

export function resolveStandaloneDependencyEnv(env) {
  const driveDatabasePath = path.join(
    WORKSPACE_ROOT,
    '.runtime',
    'standalone-development',
    'drive.sqlite3',
  );
  const membershipDatabasePath = path.join(
    WORKSPACE_ROOT,
    '.runtime',
    'standalone-development',
    'membership.sqlite3',
  );
  const sharedDatabaseUrl = readTrimmedValue(env.SDKWORK_CLAW_DATABASE_URL);
  const sharedDatabaseEngine =
    readTrimmedValue(env.SDKWORK_CLAW_DATABASE_ENGINE)
    || detectDatabaseEngineFromUrl(sharedDatabaseUrl);
  const usesSharedPostgresDatabase =
    sharedDatabaseEngine === 'postgres' || sharedDatabaseEngine === 'postgresql';
  const driveDatabaseUrl =
    readTrimmedValue(env.SDKWORK_DRIVE_DATABASE_URL)
    || (usesSharedPostgresDatabase ? sharedDatabaseUrl : undefined)
    || sqliteDatabaseUrl(driveDatabasePath);
  const membershipDatabaseUrl =
    readTrimmedValue(env.SDKWORK_MEMBERSHIP_DATABASE_URL)
    || (usesSharedPostgresDatabase ? sharedDatabaseUrl : undefined)
    || sqliteDatabaseUrl(membershipDatabasePath);
  const sharedMaxConnections =
    readTrimmedValue(env.SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS)
    || (usesSharedPostgresDatabase ? '10' : '2');
  return {
    SDKWORK_DRIVE_DATABASE_URL: driveDatabaseUrl,
    SDKWORK_DRIVE_DATABASE_ENGINE:
      readTrimmedValue(env.SDKWORK_DRIVE_DATABASE_ENGINE)
      || detectDatabaseEngineFromUrl(driveDatabaseUrl),
    SDKWORK_MEMBERSHIP_DATABASE_URL: membershipDatabaseUrl,
    SDKWORK_MEMBERSHIP_DATABASE_ENGINE:
      readTrimmedValue(env.SDKWORK_MEMBERSHIP_DATABASE_ENGINE)
      || detectDatabaseEngineFromUrl(membershipDatabaseUrl),
    SDKWORK_DRIVE_DATABASE_MAX_CONNECTIONS:
      readTrimmedValue(env.SDKWORK_DRIVE_DATABASE_MAX_CONNECTIONS)
      || sharedMaxConnections,
    SDKWORK_MEMBERSHIP_DATABASE_MAX_CONNECTIONS:
      readTrimmedValue(env.SDKWORK_MEMBERSHIP_DATABASE_MAX_CONNECTIONS)
      || sharedMaxConnections,
    SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT:
      readTrimmedValue(env.SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT)
      || '2',
    SDKWORK_MEMBERSHIP_APP_ROOT:
      readTrimmedValue(env.SDKWORK_MEMBERSHIP_APP_ROOT)
      || path.resolve(WORKSPACE_ROOT, '..', 'sdkwork-membership'),
  };
}

function formatCommandPlan(plan) {
  const renderedArgs = Array.isArray(plan.args) ? plan.args.join(' ') : '';
  return [plan.command, renderedArgs].filter(Boolean).join(' ');
}

function appendPlanArgs(plan, extraArgs = []) {
  if (!Array.isArray(extraArgs) || extraArgs.length === 0) {
    return plan;
  }

  return {
    ...plan,
    args: [...plan.args, ...extraArgs],
  };
}

function hasCliOption(args = [], flag) {
  return args.some((token) => {
    const normalizedToken = String(token ?? '').trim();
    return normalizedToken === flag || normalizedToken.startsWith(`${flag}=`);
  });
}

function readLastCliOptionValue(args = [], flag) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const token = String(args[index] ?? '').trim();
    if (token.startsWith(`${flag}=`)) {
      return token.slice(flag.length + 1);
    }
    if (token === flag) {
      return String(args[index + 1] ?? '').trim() || undefined;
    }
  }

  return undefined;
}

export function resolveClientAccessUrls(options = {}) {
  return resolveNetworkAccessUrls(options);
}

export function resolveClientAccessLines(options = {}) {
  return formatNetworkAccessLines({
    ...options,
    pathname: options.pathname ?? '/',
    prefix: '[birdcoder-stack]   ',
    unavailableText: 'unavailable (listener is loopback-only or no LAN IPv4 address was detected)',
  });
}

function resolveClientHostAndPort(plan) {
  const args = Array.isArray(plan?.args) ? plan.args : [];
  return {
    host: readLastCliOptionValue(args, '--host') ?? DEFAULT_WEB_CLIENT_HOST,
    port: normalizePort(readLastCliOptionValue(args, '--port')),
  };
}

function normalizePort(value) {
  const port = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return undefined;
  }

  return port;
}

function canBindLoopbackPort(port, host = CLIENT_LOOPBACK_PORT_FALLBACK_HOST) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

async function canBindClientPort(port, host) {
  if (!(await canBindLoopbackPort(port, host))) {
    return false;
  }

  return host !== DEFAULT_WEB_CLIENT_HOST
    || canBindLoopbackPort(port, CLIENT_LOOPBACK_PORT_FALLBACK_HOST);
}

async function resolveAvailableLoopbackPort({
  host = CLIENT_LOOPBACK_PORT_FALLBACK_HOST,
  maxAttempts = CLIENT_LOOPBACK_PORT_FALLBACK_MAX_ATTEMPTS,
  preferredPort,
} = {}) {
  const normalizedPreferredPort = normalizePort(preferredPort);
  if (!normalizedPreferredPort) {
    return undefined;
  }

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = normalizedPreferredPort + offset;
    if (candidatePort > 65535) {
      return undefined;
    }

    if (await canBindClientPort(candidatePort, host)) {
      return candidatePort;
    }
  }

  return undefined;
}

export async function applyClientLoopbackPortFallback({
  clientArgs = [],
  stackPlans,
} = {}) {
  if (!stackPlans?.clientPlan) {
    return stackPlans;
  }

  if (hasCliOption(clientArgs, '--port') || hasCliOption(clientArgs, '--strictPort')) {
    return stackPlans;
  }

  const preferredPort = normalizePort(
    readLastCliOptionValue(stackPlans.clientPlan.args, '--port'),
  );
  if (!preferredPort) {
    return stackPlans;
  }

  const clientHost =
    readLastCliOptionValue(stackPlans.clientPlan.args, '--host')
    ?? CLIENT_LOOPBACK_PORT_FALLBACK_HOST;
  const availablePort = await resolveAvailableLoopbackPort({
    host: clientHost,
    preferredPort,
  });
  if (!availablePort || availablePort === preferredPort) {
    return stackPlans;
  }

  return {
    ...stackPlans,
    clientPlan: appendPlanArgs(
      stackPlans.clientPlan,
      ['--port', String(availablePort)],
    ),
    clientPortFallback: {
      host: clientHost,
      preferredPort,
      resolvedPort: availablePort,
    },
  };
}

function applyWebClientLanHost(stackPlans) {
  if (
    !STACK_SURFACE_CONFIGS[stackPlans?.target]?.browser
    || hasCliOption(stackPlans.clientPlan?.args, '--host')
  ) {
    return stackPlans;
  }

  return {
    ...stackPlans,
    clientPlan: appendPlanArgs(stackPlans.clientPlan, ['--host', DEFAULT_WEB_CLIENT_HOST]),
  };
}

function applyWebClientStrictPort(stackPlans) {
  if (
    !STACK_SURFACE_CONFIGS[stackPlans?.target]?.browser
    || hasCliOption(stackPlans.clientPlan?.args, '--strictPort')
  ) {
    return stackPlans;
  }

  return {
    ...stackPlans,
    clientPlan: appendPlanArgs(stackPlans.clientPlan, ['--strictPort']),
  };
}

function resolveStackPlans({
  clientArgs = [],
  env = process.env,
  iamMode,
  target,
  viteMode = DEFAULT_STACK_VITE_MODE,
} = {}) {
  if (target === 'web' && iamMode === 'desktop-local') {
    throw new Error(
      'The web sample stack does not support desktop-local. Use desktop with --iam-mode desktop-local instead.',
    );
  }

  const stackSurfaceConfig = STACK_SURFACE_CONFIGS[target];
  const resolvedViteMode = resolveStackViteMode(viteMode);
  const clientScriptName = stackSurfaceConfig.clientScriptNamesByViteMode[resolvedViteMode];
  if (!clientScriptName) {
    throw new Error(
      `No BirdCoder ${target} client script is configured for vite mode ${resolvedViteMode}.`,
    );
  }
  const commandEnv = resolveBirdcoderCommandEnv({
    env,
  });
  const clientResolvedIam = resolveBirdcoderIamCommandEnv({
    env: commandEnv,
    iamMode,
    target: stackSurfaceConfig.target,
    viteMode: resolvedViteMode,
  });
  const needsServer = clientResolvedIam.iamMode !== 'desktop-local';
  const serverResolvedIam = needsServer
    ? resolveBirdcoderIamCommandEnv({
        env: commandEnv,
        iamMode,
        target: SERVER_DEV_CONFIG.target,
        viteMode: resolvedViteMode,
      })
    : null;
  const errors = [
    ...clientResolvedIam.errors,
    ...(serverResolvedIam?.errors || []),
  ];
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const clientPlan = createWorkspacePackageScriptPlan({
    env: clientResolvedIam.env,
    packageDir: stackSurfaceConfig.clientPackageDir,
    scriptName: clientScriptName,
  });
  const standaloneDependencyEnv = serverResolvedIam
    ? resolveStandaloneDependencyEnv(serverResolvedIam.env)
    : {};
  const serverPlan = serverResolvedIam
    ? createWorkspacePackageScriptPlan({
        env: {
          ...serverResolvedIam.env,
          ...standaloneDependencyEnv,
          ...(iamMode === 'server-private'
            ? { BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT: WORKSPACE_ROOT }
            : {}),
        },
        packageDir: SERVER_DEV_CONFIG.packageDir,
        scriptName: SERVER_DEV_CONFIG.scriptName,
      })
    : null;
  const sdkworkIamMode =
    readTrimmedValue(clientResolvedIam.env.SDKWORK_IAM_MODE)
    || readTrimmedValue(serverResolvedIam?.env.SDKWORK_IAM_MODE)
    || 'local';
  const apiOriginUrl = resolveApiOriginUrl(clientResolvedIam.env);

  return {
    apiOriginUrl,
    clientPlan: appendPlanArgs(clientPlan, clientArgs),
    clientResolvedIam,
    needsServer,
    sdkworkIamMode,
    serverPlan,
    serverResolvedIam,
    target,
    viteMode: resolvedViteMode,
  };
}

function printStackSummary({
  apiOriginUrl,
  clientPortFallback,
  clientPlan,
  clientResolvedIam,
  sdkworkIamMode,
  serverPlan,
  target,
  viteMode,
} = {}) {
  console.log(`[birdcoder-stack] surface=${target}`);
  console.log(`[birdcoder-stack] iamMode=${clientResolvedIam.iamMode}`);
  console.log(`[birdcoder-stack] viteMode=${viteMode}`);
  console.log(`[birdcoder-stack] sdkworkIamMode=${sdkworkIamMode}`);
  if (apiOriginUrl) {
    console.log(`[birdcoder-stack] apiBaseUrl=${apiOriginUrl.origin}${apiOriginUrl.pathname === '/' ? '' : apiOriginUrl.pathname}`);
  }
  if (serverPlan) {
    console.log(`[birdcoder-stack] server=${formatCommandPlan(serverPlan)}`);
  } else {
    console.log('[birdcoder-stack] server=embedded');
  }
  if (clientPortFallback) {
    console.log(
      `[birdcoder-stack] clientPortFallback=${clientPortFallback.preferredPort}->${clientPortFallback.resolvedPort} (${clientPortFallback.host})`,
    );
  }
  console.log(`[birdcoder-stack] client=${formatCommandPlan(clientPlan)}`);

  if (sdkworkIamMode !== 'cloud') {
    const quickLogin = clientResolvedIam.developerExperience?.quickLogin;
    if (quickLogin?.account && quickLogin?.password) {
      console.log(`[birdcoder-stack] devPrefillAccount=${quickLogin.account}`);
      console.log('[birdcoder-stack] devPrefillPassword=***');
      if (quickLogin.verifyCode) {
        console.log(`[birdcoder-stack] devFixedVerifyCode=${quickLogin.verifyCode}`);
      }
    } else {
      console.log('[birdcoder-stack] devPrefillAccount=disabled');
      console.log('[birdcoder-stack] devPrefillPassword=***');
      console.log('[birdcoder-stack] devIdentity=register-or-login via /app/v3/api/auth/*');
    }
  }
}

function waitForChildExit(childProcess, label) {
  return new Promise((resolve) => {
    const resolveExit = (code, signal) => {
      resolve({
        code: typeof code === 'number' ? code : 0,
        label,
        signal,
      });
    };

    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      resolveExit(childProcess.exitCode, childProcess.signalCode);
      return;
    }

    childProcess.once('exit', resolveExit);
  });
}

function destroyChildProcessTree(childProcess) {
  if (!childProcess?.pid || childProcess.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  childProcess.kill('SIGTERM');
}

function normalizePositiveInteger(value, fallbackValue) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallbackValue;
  }

  return Math.floor(value);
}

function resolveServerReadyProbeUrls(apiOriginUrl, paths = DEFAULT_SERVER_READY_PATHS) {
  const normalizedPaths = Array.isArray(paths)
    ? paths
        .map((pathValue) => String(pathValue ?? '').trim())
        .filter(Boolean)
    : [];

  return normalizedPaths.map((pathValue) => new URL(pathValue, apiOriginUrl).toString());
}

async function probeServerReadyEndpoint(url, requestTimeoutMs) {
  const abortController =
    typeof AbortController === 'function' ? new AbortController() : undefined;
  const timeoutHandle = globalThis.setTimeout(() => {
    abortController?.abort();
  }, requestTimeoutMs);

  try {
    return await globalThis.fetch(url, {
      cache: 'no-store',
      signal: abortController?.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

export async function isServerReady({
  apiOriginUrl,
  paths = DEFAULT_SERVER_READY_PATHS,
  requestTimeoutMs = DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS,
} = {}) {
  if (!apiOriginUrl || typeof globalThis.fetch !== 'function') {
    return false;
  }

  const readinessUrls = resolveServerReadyProbeUrls(apiOriginUrl, paths);
  if (readinessUrls.length === 0) {
    return false;
  }

  const normalizedRequestTimeoutMs = normalizePositiveInteger(
    requestTimeoutMs,
    DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS,
  );

  try {
    const responses = await Promise.all(
      readinessUrls.map((url) =>
        probeServerReadyEndpoint(url, normalizedRequestTimeoutMs),
      ),
    );
    return responses.every((response) => response.ok);
  } catch {
    return false;
  }
}

async function waitForServerReady({
  apiOriginUrl,
  paths = DEFAULT_SERVER_READY_PATHS,
  requestTimeoutMs = DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS,
  serverChild,
  timeoutMs = DEFAULT_SERVER_READY_TIMEOUT_MS,
} = {}) {
  if (!apiOriginUrl) {
    throw new Error(
      'Unable to resolve the BirdCoder API base URL for stack startup.',
    );
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error(
      'BirdCoder stack startup requires fetch support to probe the standardized readiness APIs.',
    );
  }

  const readinessUrls = resolveServerReadyProbeUrls(apiOriginUrl, paths);
  if (readinessUrls.length === 0) {
    throw new Error(
      'BirdCoder stack startup requires at least one readiness endpoint.',
    );
  }

  const deadline = Date.now() + timeoutMs;
  const normalizedRequestTimeoutMs = normalizePositiveInteger(
    requestTimeoutMs,
    DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS,
  );
  const normalizedPollIntervalMs = normalizePositiveInteger(
    DEFAULT_SERVER_READY_POLL_INTERVAL_MS,
    DEFAULT_SERVER_READY_POLL_INTERVAL_MS,
  );
  while (Date.now() < deadline) {
    if (serverChild && serverChild.exitCode !== null) {
      return false;
    }

    if (await isServerReady({
      apiOriginUrl,
      paths,
      requestTimeoutMs: normalizedRequestTimeoutMs,
    })) {
      return true;
    }

    // The native BirdCoder server can publish the base URL before the standardized
    // infrastructure readiness route is ready. Keep polling until it responds.
    await sleep(normalizedPollIntervalMs);
  }

  return false;
}

async function waitForClientReady({
  clientChild,
  port,
  timeoutMs = DEFAULT_CLIENT_READY_TIMEOUT_MS,
} = {}) {
  if (!port || typeof globalThis.fetch !== 'function') {
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (clientChild?.exitCode !== null) {
      return false;
    }
    try {
      const response = await probeServerReadyEndpoint(
        `http://127.0.0.1:${port}/`,
        DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS,
      );
      if (response.ok) {
        return true;
      }
    } catch {
      // Vite may need a short interval after the process starts before accepting requests.
    }
    await sleep(DEFAULT_SERVER_READY_POLL_INTERVAL_MS);
  }
  return false;
}

function printClientAccessSummary(clientPlan) {
  const { host, port } = resolveClientHostAndPort(clientPlan);
  const lines = resolveClientAccessLines({ host, port });
  if (lines.length === 0) {
    return;
  }
  console.log('[birdcoder-stack] client ready');
  console.log('[birdcoder-stack] Access URLs');
  for (const line of lines) {
    console.log(line);
  }
}

function spawnPlan(plan, label) {
  console.log(`[birdcoder-stack] starting ${label}`);
  return spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    shell: plan.shell,
    stdio: 'inherit',
    windowsHide: true,
  });
}

export async function runBirdcoderDevStack({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const options = parseArgs(argv);
  let stackPlans = resolveStackPlans({
    clientArgs: options.clientArgs,
    env,
    iamMode: options.iamMode,
    target: options.target,
    viteMode: options.viteMode,
  });
  stackPlans = applyWebClientLanHost(stackPlans);
  stackPlans = applyWebClientStrictPort(stackPlans);

  if (!options.dryRun) {
    stackPlans = await applyClientLoopbackPortFallback({
      clientArgs: options.clientArgs,
      stackPlans,
    });
  }

  printStackSummary(stackPlans);

  if (options.dryRun) {
    console.log('[birdcoder-stack] dry-run complete');
    return 0;
  }

  let isShuttingDown = false;
  const activeChildren = [];
  const shutdownChildren = () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    for (const { childProcess } of activeChildren) {
      destroyChildProcessTree(childProcess);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      shutdownChildren();
      process.exit(130);
    });
  }

  if (stackPlans.serverPlan) {
    const reuseExistingServer = await isServerReady({
      apiOriginUrl: stackPlans.apiOriginUrl,
    });
    if (reuseExistingServer) {
      console.log('[birdcoder-stack] server ready (reusing existing process)');
    } else {
      const serverChild = spawnPlan(stackPlans.serverPlan, 'server');
      activeChildren.push({ childProcess: serverChild, label: 'server' });

      const ready = await waitForServerReady({
        apiOriginUrl: stackPlans.apiOriginUrl,
        serverChild,
      });
      if (!ready) {
        shutdownChildren();
        throw new Error(
          `BirdCoder server did not become ready at ${stackPlans.apiOriginUrl?.origin || 'the configured API base URL'} within ${DEFAULT_SERVER_READY_TIMEOUT_MS}ms.`,
        );
      }

      console.log('[birdcoder-stack] server ready');
    }
  }

  const clientChild = spawnPlan(stackPlans.clientPlan, 'client');
  activeChildren.push({ childProcess: clientChild, label: 'client' });
  if (STACK_SURFACE_CONFIGS[stackPlans.target]?.browser) {
    const clientReady = await waitForClientReady({
      ...resolveClientHostAndPort(stackPlans.clientPlan),
      clientChild,
    });
    if (clientReady) {
      printClientAccessSummary(stackPlans.clientPlan);
    } else {
      console.log('[birdcoder-stack] client readiness probe timed out; inspect the Vite output above for the actual port.');
    }
  }
  const exitResult = await Promise.race(
    activeChildren.map(({ childProcess, label }) =>
      waitForChildExit(
        childProcess,
        label,
      ),
    ),
  );

  shutdownChildren();
  if (exitResult.signal) {
    console.error(
      `[birdcoder-stack] ${exitResult.label} exited with signal ${exitResult.signal}.`,
    );
    return 1;
  }

  return exitResult.code;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    const exitCode = await runBirdcoderDevStack();
    process.exit(exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
