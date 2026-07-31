#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';

function resolveAvailablePort(excludedPorts = new Set()) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ exclusive: true, host, port: 0 }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!port || excludedPorts.has(port)) {
          resolve(resolveAvailablePort(excludedPorts));
          return;
        }
        resolve(port);
      });
    });
  });
}

function runNodeScript(relativePath, args, env) {
  const result = spawnSync(
    process.execPath,
    [path.join(rootDir, relativePath), ...args],
    {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function run() {
  const previewPort = await resolveAvailablePort();
  const mockApiPort = await resolveAvailablePort(new Set([previewPort]));
  const previewBaseUrl = `http://${host}:${previewPort}`;
  const mockApiBaseUrl = `http://${host}:${mockApiPort}`;
  const env = {
    ...process.env,
    PC_E2E_MOCK_API_PORT: String(mockApiPort),
    PC_E2E_PRODUCTION_PREVIEW: '1',
    PLAYWRIGHT_BASE_URL: previewBaseUrl,
    PLAYWRIGHT_PORT: String(previewPort),
    SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl,
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
    SDKWORK_BIRDCODER_ENVIRONMENT: 'production',
    SDKWORK_BIRDCODER_RUNTIME_TARGET: 'browser',
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl,
  };

  runNodeScript('scripts/prepare-shared-sdk-packages.mjs', [], env);
  runNodeScript('scripts/run-vite-host.mjs', [
    '--cwd',
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
    'build',
    '--mode',
    'production',
    '--environment',
    'production',
    '--deployment-profile',
    'standalone',
    '--runtime-target',
    'browser',
  ], env);
  runNodeScript('scripts/web-bundle-budget.test.mjs', [], env);
  runNodeScript('scripts/run-pc-playwright-e2e.mjs', [
    'tests/e2e/production-web-runtime.spec.ts',
    ...process.argv.slice(2),
  ], env);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
