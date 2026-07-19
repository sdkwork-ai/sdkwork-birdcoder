import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pcAppRoot = 'apps/sdkwork-birdcoder-pc';

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const pcPackage = readJson(`${pcAppRoot}/package.json`);
const playwrightConfig = readText(`${pcAppRoot}/playwright.config.ts`);
const bootSpec = readText(`${pcAppRoot}/tests/e2e/boot-shell.spec.ts`);
const authSpec = readText(`${pcAppRoot}/tests/e2e/auth-surface.spec.ts`);
const guestSpec = readText(`${pcAppRoot}/tests/e2e/guest-home.spec.ts`);
const authenticatedCodeSpec = readText(`${pcAppRoot}/tests/e2e/authenticated-code.spec.ts`);
const testEnv = readText(`${pcAppRoot}/packages/sdkwork-birdcoder-pc-web/.env.test`);
const mockServer = readText('scripts/pc-e2e-mock-api-server.mjs');
const mockFixtures = readText('scripts/pc-e2e-mock-api-fixtures.mjs');
const catalog = readText('pnpm-workspace.yaml');

assert.match(
  catalog,
  /["']@playwright\/test["']:/u,
  'Workspace catalog must govern @playwright/test for PC e2e.',
);

assert.match(
  String(pcPackage.scripts?.['test:e2e'] ?? ''),
  /playwright/u,
  'PC app root must expose test:e2e via Playwright.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'scripts/run-pc-playwright-e2e.mjs')),
  true,
  'Repository must provide a root-owned Playwright runner for the PC app.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'scripts/pc-e2e-mock-api-fixtures.mjs')),
  true,
  'Repository must provide structured PC e2e mock API fixtures.',
);

assert.match(
  mockServer,
  /pc-e2e-mock-api-fixtures/u,
  'PC e2e mock API server must consume shared fixtures.',
);
assert.match(
  mockServer,
  /auth\/sessions/u,
  'PC e2e mock API server must mock IAM session creation.',
);
assert.match(
  mockServer,
  /app_templates/u,
  'PC e2e mock API server must mock the templates catalog.',
);
assert.match(
  mockServer,
  /\/workspaces/u,
  'PC e2e mock API server must mock workspace bootstrap APIs.',
);
assert.match(
  mockServer,
  /\/projects/u,
  'PC e2e mock API server must mock the authenticated project catalog.',
);
assert.match(
  mockServer,
  /coding_sessions/u,
  'PC e2e mock API server must mock the authenticated coding session catalog.',
);

assert.match(
  mockFixtures,
  /e2e-password/u,
  'PC e2e fixtures must define the canonical password credential.',
);
assert.match(
  mockFixtures,
  /data:\s*\{\s*items,\s*pageInfo:/u,
  'PC e2e list fixtures must use the SDKWork v3 data.items and data.pageInfo envelope.',
);
assert.match(
  mockFixtures,
  /code:\s*0/u,
  'PC e2e success fixtures must use the numeric SDKWork v3 success code.',
);
assert.match(
  mockFixtures,
  /emailRegistrationVerificationRequired:\s*false/u,
  'PC e2e IAM fixtures must keep email registration verification disabled by default.',
);
assert.match(
  mockFixtures,
  /phoneRegistrationVerificationRequired:\s*false/u,
  'PC e2e IAM fixtures must keep phone registration verification disabled by default.',
);

assert.match(
  playwrightConfig,
  /--mode test/u,
  'PC Playwright webServer must boot Vite in test mode.',
);
assert.match(
  playwrightConfig,
  /packages\/sdkwork-birdcoder-pc-web/u,
  'PC Playwright webServer must target the pc-web host package.',
);
assert.match(
  playwrightConfig,
  /pc-e2e-mock-api-server/u,
  'PC Playwright must start the mock API server before the Vite host.',
);
assert.match(
  playwrightConfig,
  /PC_E2E_MOCK_API_PORT \?\? 11240/u,
  'PC Playwright mock API must use a dedicated port instead of reusing the standalone gateway port.',
);
assert.match(
  playwrightConfig,
  /VITE_BIRDCODER_API_BASE_URL/u,
  'PC Playwright must inject the mock API base URL for browser bootstrap.',
);
assert.match(
  playwrightConfig,
  /BIRDCODER_DEV_PROXY_TARGET: mockApiBaseUrl/u,
  'PC Playwright must route the Vite development proxy to the isolated mock API.',
);
assert.match(
  mockServer,
  /PC_E2E_MOCK_API_PORT \?\? 11240/u,
  'PC e2e mock API server must default to the dedicated Playwright port.',
);

assert.match(
  testEnv,
  /VITE_BIRDCODER_API_BASE_URL=http:\/\/127\.0\.0\.1:10240/u,
  'PC web test mode must declare the local mock API base URL.',
);
assert.match(
  testEnv,
  /VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true/u,
  'PC web test mode must enable auth development prefill for e2e login.',
);

assert.match(
  bootSpec,
  /Starting SDKWork BirdCoder/u,
  'PC boot-shell e2e must assert the startup shell copy.',
);

assert.match(
  authSpec,
  /#\/auth\/login/u,
  'PC auth-surface e2e must boot from the canonical auth hash route.',
);
assert.match(
  authSpec,
  /sdkwork-birdcoder-auth-shell/u,
  'PC auth-surface e2e must assert the IAM auth shell marker.',
);
assert.match(
  authSpec,
  /e2e-password/u,
  'PC auth-surface e2e must exercise the mock IAM password credential.',
);

assert.match(
  guestSpec,
  /Sign in/u,
  'PC guest-home e2e must redirect unauthenticated visitors to the auth surface.',
);

assert.match(
  authenticatedCodeSpec,
  /New Project/u,
  'PC authenticated-code e2e must assert the code workbench project explorer.',
);
assert.match(
  authenticatedCodeSpec,
  /Sessions/u,
  'PC authenticated-code e2e must assert the code workbench session explorer.',
);
assert.match(
  authenticatedCodeSpec,
  /e2e-password/u,
  'PC authenticated-code e2e must exercise the mock IAM password credential.',
);

console.log('pc e2e standard contract passed.');
