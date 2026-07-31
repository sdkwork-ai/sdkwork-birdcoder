#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import './vite-windows-realpath-patch.mjs';
import {
  loadBirdcoderViteProfileFile,
  normalizeBirdcoderDeploymentProfile,
  normalizeBirdcoderEnvironment,
  resolveBirdcoderAppRootFromPath,
} from './birdcoder-client-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readOptionValue(argv, index, flag) {
  const value = String(argv[index + 1] ?? '').trim();
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function normalizeMode(value, fallback = 'development') {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (normalizedValue === 'dev' || normalizedValue === 'development') {
    return 'development';
  }
  if (normalizedValue === 'prod' || normalizedValue === 'production') {
    return 'production';
  }
  if (normalizedValue === 'test') {
    return 'test';
  }
  return fallback;
}

function resolveWorkspacePath(workspaceRootDir, candidatePath) {
  const resolvedPath = path.resolve(workspaceRootDir, candidatePath);
  const relativePath = path.relative(workspaceRootDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Playwright Vite host path must stay inside ${workspaceRootDir}.`);
  }
  return resolvedPath;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid Vite host port: ${value}.`);
  }
  return port;
}

export function resolvePlaywrightViteHostOptions({
  argv = [],
  env = process.env,
  workspaceRootDir = path.resolve(__dirname, '..'),
} = {}) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const command = args.length > 0 && !String(args[0]).startsWith('--')
    ? String(args.shift())
    : 'serve';
  if (command !== 'serve' && command !== 'preview') {
    throw new Error(`Unsupported Playwright Vite host command: ${command}.`);
  }

  let cwd = '';
  let deploymentProfile = '';
  let environment = '';
  let host = '127.0.0.1';
  let mode = '';
  let port = 4_175;
  let runtimeTarget = '';
  let strictPort = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--strictPort') {
      strictPort = true;
      continue;
    }
    const value = readOptionValue(args, index, token);
    index += 1;
    if (token === '--cwd') {
      cwd = value;
    } else if (token === '--deployment-profile') {
      deploymentProfile = value;
    } else if (token === '--environment') {
      environment = value;
    } else if (token === '--host') {
      host = value;
    } else if (token === '--mode') {
      mode = value;
    } else if (token === '--port') {
      port = parsePort(value);
    } else if (token === '--runtime-target') {
      runtimeTarget = value;
    } else {
      throw new Error(`Unsupported Playwright Vite host option: ${token}.`);
    }
  }

  if (!cwd) {
    throw new Error('Playwright Vite host requires --cwd.');
  }

  const resolvedMode = normalizeMode(
    mode || env.SDKWORK_VITE_MODE,
    command === 'preview' ? 'production' : 'development',
  );
  const resolvedEnvironment = normalizeBirdcoderEnvironment(
    environment
    || env.SDKWORK_BIRDCODER_ENVIRONMENT
    || env.SDKWORK_ENVIRONMENT
    || resolvedMode,
  );
  const resolvedDeploymentProfile = normalizeBirdcoderDeploymentProfile(
    deploymentProfile
    || env.SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE
    || env.SDKWORK_DEPLOYMENT_PROFILE
    || 'standalone',
  );
  const resolvedRuntimeTarget = String(
    runtimeTarget
    || env.SDKWORK_BIRDCODER_RUNTIME_TARGET
    || env.SDKWORK_RUNTIME_TARGET
    || 'browser',
  ).trim();
  const resolvedCwd = resolveWorkspacePath(workspaceRootDir, cwd);
  const appRootDir = resolveBirdcoderAppRootFromPath({
    workspaceRootDir,
    startDir: resolvedCwd,
  });
  if (!appRootDir) {
    throw new Error(`Unable to resolve a BirdCoder application root from ${resolvedCwd}.`);
  }

  return {
    appRootDir,
    command,
    cwd: resolvedCwd,
    deploymentProfile: resolvedDeploymentProfile,
    environment: resolvedEnvironment,
    host,
    mode: resolvedMode,
    port,
    runtimeTarget: resolvedRuntimeTarget,
    strictPort,
    workspaceRootDir,
  };
}

export function applyPlaywrightViteHostEnv({
  env = process.env,
  options,
  processEnv = env,
  profileEnv = {},
} = {}) {
  const explicitEnv = { ...env };
  Object.assign(env, profileEnv, explicitEnv, {
    SDKWORK_DEPLOYMENT_PROFILE: options.deploymentProfile,
    SDKWORK_ENVIRONMENT: options.environment,
    SDKWORK_RUNTIME_TARGET: options.runtimeTarget,
    SDKWORK_VITE_MODE: options.mode,
  });
  if (processEnv !== env) {
    Object.assign(processEnv, env);
  }
  return env;
}

export function createPlaywrightViteHostShutdown({
  exit = (code) => process.exit(code),
  logError = (error) => console.error(`[run-playwright-vite-host] ${error.message}`),
  server,
} = {}) {
  let closingPromise = null;
  return function shutdown() {
    if (!closingPromise) {
      closingPromise = Promise.resolve()
        .then(() => server?.close())
        .then(
          () => exit(0),
          (error) => {
            logError(error instanceof Error ? error : new Error(String(error)));
            exit(1);
          },
        );
    }
    return closingPromise;
  };
}

export async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  importVite = () => import('vite'),
  registerSignalHandlers = true,
} = {}) {
  const options = resolvePlaywrightViteHostOptions({ argv, env });
  const profileEnv = loadBirdcoderViteProfileFile({
    workspaceRootDir: options.workspaceRootDir,
    appRootDir: options.appRootDir,
    deploymentProfile: options.deploymentProfile,
    environment: options.environment,
    runtimeTarget: options.runtimeTarget,
  });
  applyPlaywrightViteHostEnv({
    env,
    options,
    processEnv: process.env,
    profileEnv,
  });

  const vite = await importVite();
  const endpoint = {
    host: options.host,
    port: options.port,
    strictPort: options.strictPort,
  };
  const inlineConfig = {
    clearScreen: false,
    configLoader: process.platform === 'win32' ? 'native' : undefined,
    mode: options.mode,
    root: options.cwd,
  };
  const server = options.command === 'preview'
    ? await vite.preview({ ...inlineConfig, preview: endpoint })
    : await vite.createServer({ ...inlineConfig, server: endpoint });
  if (options.command === 'serve') {
    await server.listen();
  }
  server.printUrls?.();

  if (registerSignalHandlers) {
    const shutdown = createPlaywrightViteHostShutdown({ server });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.once(signal, shutdown);
    }
  }
  return server;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
