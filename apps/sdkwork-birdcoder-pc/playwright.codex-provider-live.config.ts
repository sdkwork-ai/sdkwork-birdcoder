import { defineConfig, devices } from '@playwright/test';

const liveWebUrl = process.env.SDKWORK_CODEX_LIVE_WEB_URL?.trim();

if (!liveWebUrl) {
  throw new Error(
    'SDKWORK_CODEX_LIVE_WEB_URL is required for the Codex real-provider suite.',
  );
}

export default defineConfig({
  expect: {
    timeout: 30_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: './test-results/codex-provider-live',
  preserveOutput: 'always',
  reporter: [
    ['line'],
    ['json', { outputFile: './test-results/codex-provider-live/results.json' }],
  ],
  retries: 0,
  testDir: './tests/e2e-live',
  testMatch: /codex-provider-live\.spec\.ts/u,
  timeout: 300_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: liveWebUrl,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  workers: 1,
});
