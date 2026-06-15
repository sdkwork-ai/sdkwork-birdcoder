#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseBirdcoderIamCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import {
  DEFAULT_SDKWORK_IAM_LOCAL_BOOTSTRAP_ACCOUNT,
  DEFAULT_SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD,
  DEFAULT_SDKWORK_IAM_LOCAL_VERIFY_CODE,
  resolveBirdcoderIamCommandEnv,
} from './birdcoder-iam-env.mjs';
import { createWorkspacePackageScriptPlan } from './run-workspace-package-script.mjs';

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_SERVER_READY_POLL_INTERVAL_MS = 350;
const DEFAULT_SERVER_READY_REQUEST_TIMEOUT_MS = 800;
const DEFAULT_SERVER_READY_TIMEOUT_MS = 30000;
const DEFAULT_SERVER_READY_PATHS = Object.freeze([
  '/app/v3/api/system/health',
  '/app/v3/api/system/iam/runtime',
]);
const DEFAULT_STACK_VITE_MODE = 'development';
const STACK_VITE_MODES = new Set(['development', 'test']);

const STACK_SURFACE_CONFIGS = Object.freeze({
  desktop: {
    clientPackageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop',
    clientScriptNamesByViteMode: {
      development: 'tauri:dev:base',
      test: 'tauri:dev:test:base',
    },
    target: 'desktop-dev',
  },
  web: {
    clientPackageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
    clientScriptNamesByViteMode: {
      development: 'dev:base',
      test: 'dev:test:base',
    },
    target: 'web-dev',
  },
});

const SERVER_DEV_CONFIG = Object.freeze({
    packageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server',
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
  const serverPlan = serverResolvedIam
    ? createWorkspacePackageScriptPlan({
        env: serverResolvedIam.env,
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
  console.log(`[birdcoder-stack] client=${formatCommandPlan(clientPlan)}`);

  if (sdkworkIamMode !== 'cloud') {
    const bootstrapAccount =
      readTrimmedValue(clientResolvedIam.env.SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL)
      || DEFAULT_SDKWORK_IAM_LOCAL_BOOTSTRAP_ACCOUNT;
    const bootstrapPassword =
      readTrimmedValue(clientResolvedIam.env.SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD)
      || DEFAULT_SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD;
    const verifyCode =
      readTrimmedValue(clientResolvedIam.env.SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED)
      || DEFAULT_SDKWORK_IAM_LOCAL_VERIFY_CODE;

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
    iamMode: options.iamMode,
    target: options.target,
    viteMode: options.viteMode,
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
