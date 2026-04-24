#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseBirdcoderIdentityCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import {
  DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT,
  DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD,
  DEFAULT_BIRDCODER_LOCAL_VERIFY_CODE,
  resolveBirdcoderIdentityCommandEnv,
} from './birdcoder-identity-env.mjs';
import { createWorkspacePackageScriptPlan } from './run-workspace-package-script.mjs';

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_SERVER_READY_POLL_INTERVAL_MS = 350;
const DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS = 800;
const DEFAULT_SERVER_READY_TIMEOUT_MS = 30000;
const DEFAULT_SERVER_READY_PATHS = Object.freeze([
  '/api/core/v1/health',
  '/api/app/v1/auth/config',
]);

const STACK_SURFACE_CONFIGS = Object.freeze({
  desktop: {
    clientPackageDir: 'packages/sdkwork-birdcoder-desktop',
    clientScriptName: 'tauri:dev:base',
    target: 'desktop-dev',
  },
  web: {
    clientPackageDir: 'packages/sdkwork-birdcoder-web',
    clientScriptName: 'dev:base',
    target: 'web-dev',
  },
});

const SERVER_DEV_CONFIG = Object.freeze({
  packageDir: 'packages/sdkwork-birdcoder-server',
  scriptName: 'dev:base',
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

function isBuiltinLocalProvider(providerKind) {
  return providerKind === 'builtin-local';
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
  const identityTokens = [];
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

    identityTokens.push(token);
  }

  const {
    identityMode,
    userCenterProvider,
  } = parseBirdcoderIdentityCliOptions(identityTokens, {
    commandName: 'run-birdcoder-dev-stack',
  });

  return {
    clientArgs,
    dryRun,
    identityMode,
    target,
    userCenterProvider,
  };
}

function resolveApiOriginUrl(env) {
  const rawApiBaseUrl =
    readTrimmedValue(env.BIRDCODER_API_BASE_URL)
    || readTrimmedValue(env.VITE_BIRDCODER_API_BASE_URL);
  if (!rawApiBaseUrl) {
    return undefined;
  }

  try {
    return new URL(rawApiBaseUrl);
  } catch {
    return undefined;
  }
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

function resolveStackPlans({
  clientArgs = [],
  env = process.env,
  identityMode,
  target,
  userCenterProvider,
} = {}) {
  if (target === 'web' && identityMode === 'desktop-local') {
    throw new Error(
      'The web sample stack does not support desktop-local. Use desktop with --identity-mode desktop-local instead.',
    );
  }

  if (
    identityMode === 'desktop-local'
    && userCenterProvider
    && userCenterProvider !== 'builtin-local'
  ) {
    throw new Error(
      'desktop-local only supports the builtin-local user-center provider.',
    );
  }

  const stackSurfaceConfig = STACK_SURFACE_CONFIGS[target];
  const commandEnv = resolveBirdcoderCommandEnv({
    env,
    userCenterProvider,
  });
  const clientResolvedIdentity = resolveBirdcoderIdentityCommandEnv({
    env: commandEnv,
    identityMode,
    target: stackSurfaceConfig.target,
    viteMode: 'development',
  });
  const needsServer = clientResolvedIdentity.identityMode !== 'desktop-local';
  const serverResolvedIdentity = needsServer
    ? resolveBirdcoderIdentityCommandEnv({
        env: commandEnv,
        identityMode,
        target: SERVER_DEV_CONFIG.target,
        viteMode: 'development',
      })
    : null;
  const errors = [
    ...clientResolvedIdentity.errors,
    ...(serverResolvedIdentity?.errors || []),
  ];
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const clientPlan = createWorkspacePackageScriptPlan({
    env: clientResolvedIdentity.env,
    packageDir: stackSurfaceConfig.clientPackageDir,
    scriptName: stackSurfaceConfig.clientScriptName,
  });
  const serverPlan = serverResolvedIdentity
    ? createWorkspacePackageScriptPlan({
        env: serverResolvedIdentity.env,
        packageDir: SERVER_DEV_CONFIG.packageDir,
        scriptName: SERVER_DEV_CONFIG.scriptName,
      })
    : null;
  const providerKind =
    readTrimmedValue(clientResolvedIdentity.env.BIRDCODER_USER_CENTER_LOGIN_PROVIDER)
    || readTrimmedValue(serverResolvedIdentity?.env.BIRDCODER_USER_CENTER_LOGIN_PROVIDER)
    || 'builtin-local';
  const apiOriginUrl = resolveApiOriginUrl(clientResolvedIdentity.env);

  return {
    apiOriginUrl,
    clientPlan: appendPlanArgs(clientPlan, clientArgs),
    clientResolvedIdentity,
    needsServer,
    providerKind,
    serverPlan,
    serverResolvedIdentity,
    target,
  };
}

function printStackSummary({
  apiOriginUrl,
  clientPlan,
  clientResolvedIdentity,
  providerKind,
  serverPlan,
  target,
} = {}) {
  console.log(`[birdcoder-stack] surface=${target}`);
  console.log(`[birdcoder-stack] identityMode=${clientResolvedIdentity.identityMode}`);
  console.log(`[birdcoder-stack] provider=${providerKind}`);
  if (apiOriginUrl) {
    console.log(`[birdcoder-stack] apiBaseUrl=${apiOriginUrl.origin}${apiOriginUrl.pathname === '/' ? '' : apiOriginUrl.pathname}`);
  }
  if (serverPlan) {
    console.log(`[birdcoder-stack] server=${formatCommandPlan(serverPlan)}`);
  } else {
    console.log('[birdcoder-stack] server=embedded');
  }
  console.log(`[birdcoder-stack] client=${formatCommandPlan(clientPlan)}`);

  if (isBuiltinLocalProvider(providerKind)) {
    const bootstrapAccount =
      readTrimmedValue(clientResolvedIdentity.env.BIRDCODER_LOCAL_BOOTSTRAP_EMAIL)
      || DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT;
    const bootstrapPassword =
      readTrimmedValue(clientResolvedIdentity.env.BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD)
      || DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD;
    const verifyCode =
      readTrimmedValue(clientResolvedIdentity.env.BIRDCODER_LOCAL_VERIFY_CODE_FIXED)
      || DEFAULT_BIRDCODER_LOCAL_VERIFY_CODE;

    console.log(`[birdcoder-stack] sampleAccount=${bootstrapAccount}`);
    console.log(`[birdcoder-stack] samplePassword=${bootstrapPassword}`);
    console.log(`[birdcoder-stack] sampleVerifyCode=${verifyCode}`);
  }
}

function waitForChildExit(childProcess, label) {
  return new Promise((resolve) => {
    childProcess.once('exit', (code, signal) => {
      resolve({
        code: typeof code === 'number' ? code : 0,
        label,
        signal,
      });
    });
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
  let attempt = 0;

  while (Date.now() < deadline) {
    if (serverChild.exitCode !== null) {
      return false;
    }

    attempt += 1;

    try {
      const responses = await Promise.all(
        readinessUrls.map((url) =>
          probeServerReadyEndpoint(url, normalizedRequestTimeoutMs),
        ),
      );

      if (responses.every((response) => response.ok)) {
        return true;
      }
    } catch {
      // The native BirdCoder server can publish the base URL before the standardized
      // health and auth-config routes are ready. Keep polling until both contracts respond.
    }

    await sleep(normalizedPollIntervalMs);
  }

  return false;
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
  const stackPlans = resolveStackPlans({
    clientArgs: options.clientArgs,
    env,
    identityMode: options.identityMode,
    target: options.target,
    userCenterProvider: options.userCenterProvider,
  });

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
    for (const childProcess of activeChildren) {
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
    const serverChild = spawnPlan(stackPlans.serverPlan, 'server');
    activeChildren.push(serverChild);

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

  const clientChild = spawnPlan(stackPlans.clientPlan, 'client');
  activeChildren.push(clientChild);
  const exitResult = await Promise.race(
    activeChildren.map((childProcess, index) =>
      waitForChildExit(
        childProcess,
        index === 0 && stackPlans.serverPlan ? 'server' : 'client',
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
