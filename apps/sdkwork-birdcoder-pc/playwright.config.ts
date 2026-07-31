import { defineConfig, devices } from '@playwright/test';
import { mergeRepoBootstrapAccessTokenEnv } from '@sdkwork/iam-credential-entry/node-bootstrap';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const { SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken } = mergeRepoBootstrapAccessTokenEnv({
  allowTestTokenGeneration: true,
  env: {
    SDKWORK_ACCESS_TOKEN: process.env.SDKWORK_ACCESS_TOKEN,
  },
  environment: 'test',
  manifestPath: 'apps/sdkwork-birdcoder-pc/sdkwork.app.config.json',
  repoRoot: repositoryRoot,
  runtimeTarget: 'browser',
});

if (!e2eBootstrapAccessToken) {
  throw new Error('PC Playwright requires an isolated IAM credential-entry bootstrap token.');
}
if (process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== '1') {
  throw new Error(
    'PC Playwright server lifecycle is owned by scripts/run-pc-playwright-e2e.mjs. '
    + 'Use pnpm test:e2e, or set PLAYWRIGHT_SKIP_WEB_SERVER=1 for already-running services.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  preserveOutput: 'always',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
