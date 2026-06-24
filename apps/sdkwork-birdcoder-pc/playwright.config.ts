import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 10240);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const reuse = !process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['line']],
  webServer: [
    {
      command: 'node ../../scripts/pc-e2e-mock-api-server.mjs',
      url: `${mockApiBaseUrl}/app/v3/api/system/health`,
      reuseExistingServer: reuse,
      timeout: 30_000,
      env: {
        PC_E2E_MOCK_API_PORT: String(mockApiPort),
      },
    },
    {
      command: `node ../../scripts/prepare-shared-sdk-packages.mjs && node ../../scripts/run-vite-host.mjs serve --cwd packages/sdkwork-birdcoder-pc-web --host 127.0.0.1 --port ${port} --mode test`,
      url: baseURL,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        VITE_BIRDCODER_API_BASE_URL: mockApiBaseUrl,
      },
    },
  ],
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
