import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4175);
const mockApiPort = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`;
const reuse = !process.env.CI;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';

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
  webServer: skipWebServer ? undefined : [
    {
      command: 'node ../../scripts/pc-e2e-mock-api-server.mjs',
      url: `${mockApiBaseUrl}/readyz`,
      reuseExistingServer: reuse,
      timeout: 30_000,
      env: {
        PC_E2E_ALLOWED_ORIGINS: baseURL,
        PC_E2E_MOCK_API_PORT: String(mockApiPort),
      },
    },
    {
      command: `node ../../scripts/prepare-shared-sdk-packages.mjs && node ../../scripts/run-vite-host.mjs serve --cwd apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web --host 127.0.0.1 --port ${port} --mode test`,
      url: baseURL,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        BIRDCODER_DEV_PROXY_TARGET: mockApiBaseUrl,
        VITE_SDKWORK_DRIVE_APP_API_BASE_URL: mockApiBaseUrl,
        VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl,
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
