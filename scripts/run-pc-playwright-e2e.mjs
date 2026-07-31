#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { mergeRepoBootstrapAccessTokenEnv } from '@sdkwork/iam-credential-entry/node-bootstrap';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const pcAppDir = path.join(rootDir, 'apps/sdkwork-birdcoder-pc');
const playwrightCli = path.join(rootDir, 'node_modules/@playwright/test/cli.js');
const managedServerCloseTimeoutMs = 10_000;

function normalizeError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

async function runManagedServerClose({
  close,
  label,
  timeoutMs,
}) {
  let timeoutHandle;
  try {
    await Promise.race([
      Promise.resolve().then(close),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function closeManagedServerLifecycle({
  label,
  lifecycle,
  timeoutMs,
}) {
  if (!lifecycle) {
    return;
  }

  try {
    await runManagedServerClose({
      close: () => lifecycle.close(),
      label,
      timeoutMs,
    });
  } catch (closeError) {
    if (typeof lifecycle.forceClose !== 'function') {
      throw closeError;
    }
    try {
      await runManagedServerClose({
        close: () => lifecycle.forceClose(),
        label: `${label} fallback`,
        timeoutMs,
      });
    } catch (fallbackError) {
      throw new AggregateError(
        [normalizeError(closeError), normalizeError(fallbackError)],
        `${label} failed to close and its fallback also failed.`,
      );
    }
  }
}

export async function closePcPlaywrightManagedServers({
  closeTimeoutMs = managedServerCloseTimeoutMs,
  mockApiLifecycle,
  viteHostLifecycle,
} = {}) {
  const closeResults = await Promise.allSettled([
    closeManagedServerLifecycle({
      label: 'PC Playwright Vite host',
      lifecycle: viteHostLifecycle,
      timeoutMs: closeTimeoutMs,
    }),
    closeManagedServerLifecycle({
      label: 'PC Playwright mock API',
      lifecycle: mockApiLifecycle,
      timeoutMs: closeTimeoutMs,
    }),
  ]);
  const closeErrors = closeResults
    .filter((result) => result.status === 'rejected')
    .map((result) => normalizeError(result.reason));
  if (closeErrors.length > 0) {
    throw new AggregateError(
      closeErrors,
      'PC Playwright managed server cleanup failed.',
    );
  }
}

export function createPcPlaywrightE2EPlan({
  argv = [],
  env = process.env,
} = {}) {
  const port = Number(env.PLAYWRIGHT_PORT ?? 4_175);
  const mockApiPort = Number(env.PC_E2E_MOCK_API_PORT ?? 11_240);
  const baseURL = env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
  const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
  const productionPreview = env.PC_E2E_PRODUCTION_PREVIEW === '1';
  const skipManagedServers = env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';
  const viteArgv = productionPreview
    ? [
        'preview',
        '--cwd',
        'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
        '--mode',
        'production',
        '--environment',
        'production',
        '--deployment-profile',
        'standalone',
        '--runtime-target',
        'browser',
      ]
    : [
        'serve',
        '--cwd',
        'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
        '--mode',
        'test',
      ];

  return {
    baseURL,
    mockApiBaseUrl,
    mockApiPort,
    playwrightArgs: ['test', ...argv],
    port,
    productionPreview,
    skipManagedServers,
    viteArgv,
  };
}

export async function executePcPlaywrightE2E({
  closeTimeoutMs = managedServerCloseTimeoutMs,
  plan,
  runPlaywright,
  startMockApi,
  startViteHost,
} = {}) {
  let mockApiLifecycle = null;
  let viteHostLifecycle = null;
  let executionError = null;
  try {
    if (!plan.skipManagedServers) {
      mockApiLifecycle = await startMockApi(plan);
      viteHostLifecycle = await startViteHost(plan);
    }
    return await runPlaywright(plan);
  } catch (error) {
    executionError = error;
    throw error;
  } finally {
    const managedViteHostLifecycle = viteHostLifecycle
      ? { ...viteHostLifecycle, close: () => viteHostLifecycle?.close() }
      : null;
    const managedMockApiLifecycle = mockApiLifecycle
      ? { ...mockApiLifecycle, close: () => mockApiLifecycle?.close() }
      : null;
    try {
      await closePcPlaywrightManagedServers({
        closeTimeoutMs,
        mockApiLifecycle: managedMockApiLifecycle,
        viteHostLifecycle: managedViteHostLifecycle,
      });
    } catch (cleanupError) {
      if (executionError !== null) {
        const normalizedExecutionError = normalizeError(executionError);
        throw new AggregateError(
          [normalizedExecutionError, normalizeError(cleanupError)],
          `PC Playwright E2E failed (${normalizedExecutionError.message}) and managed server cleanup also failed.`,
        );
      }
      throw cleanupError;
    }
  }
}

function runPlaywrightProcess(plan) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, ...plan.playwrightArgs], {
      cwd: pcAppDir,
      env: plan.env,
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

async function startMockApi() {
  const mockApi = await import('./pc-e2e-mock-api-server.mjs');
  const server = await mockApi.startPcE2EMockApiServer();
  return {
    close: () => mockApi.closePcE2EMockApiServer(server),
    forceClose: () => {
      server.closeAllConnections?.();
      server.closeIdleConnections?.();
      return mockApi.closePcE2EMockApiServer(server);
    },
  };
}

async function startViteHost(plan) {
  const viteHost = await import('./run-playwright-vite-host.mjs');
  const server = await viteHost.runCli({
    argv: plan.viteArgv,
    env: plan.env,
    registerSignalHandlers: false,
  });
  return {
    close: () => server.close(),
    forceClose: () => {
      server.httpServer?.closeAllConnections?.();
      server.httpServer?.closeIdleConnections?.();
      return server.close();
    },
  };
}

export async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  if (!existsSync(playwrightCli)) {
    throw new Error('Missing @playwright/test. Run pnpm install from the repository root.');
  }

  const plan = createPcPlaywrightE2EPlan({ argv, env });
  const { SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken } = mergeRepoBootstrapAccessTokenEnv({
    allowTestTokenGeneration: true,
    env: {
      SDKWORK_ACCESS_TOKEN: env.SDKWORK_ACCESS_TOKEN,
    },
    environment: 'test',
    manifestPath: 'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
    repoRoot: rootDir,
    runtimeTarget: 'browser',
  });
  if (!e2eBootstrapAccessToken) {
    throw new Error('PC Playwright requires an isolated IAM credential-entry bootstrap token.');
  }

  const runtimeEnv = {
    ...env,
    PC_E2E_ALLOWED_ORIGINS: plan.baseURL,
    PC_E2E_MOCK_API_PORT: String(plan.mockApiPort),
    PLAYWRIGHT_BASE_URL: plan.baseURL,
    PLAYWRIGHT_PORT: String(plan.port),
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken,
    SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: plan.mockApiBaseUrl,
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: plan.mockApiBaseUrl,
  };
  Object.assign(process.env, runtimeEnv);

  return executePcPlaywrightE2E({
    plan: { ...plan, env: runtimeEnv },
    runPlaywright: runPlaywrightProcess,
    startMockApi,
    startViteHost,
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
