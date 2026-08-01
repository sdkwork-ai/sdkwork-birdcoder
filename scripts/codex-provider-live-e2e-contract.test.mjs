import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.join(rootDir, 'scripts/run-codex-provider-live-e2e.mjs');
const configPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/playwright.codex-provider-live.config.ts',
);
const harnessPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/tests/e2e-live/codexProviderLiveHarness.ts',
);
const specPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/tests/e2e-live/codex-provider-live.spec.ts',
);

for (const requiredPath of [runnerPath, configPath, harnessPath, specPath]) {
  assert.equal(fs.existsSync(requiredPath), true, `Missing live E2E source: ${requiredPath}`);
}

const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const configSource = fs.readFileSync(configPath, 'utf8');
const harnessSource = fs.readFileSync(harnessPath, 'utf8');
const specSource = fs.readFileSync(specPath, 'utf8');
const liveSources = [runnerSource, configSource, harnessSource, specSource].join('\n');

assert.doesNotMatch(configSource, /webServer|pc-e2e-mock-api-server|11240/u);
assert.doesNotMatch(
  liveSources,
  /APIRequestContext|page\.request|request\.(?:get|post|put|delete)\(|\bfetch\s*\(|axios|Access-Token|Authorization/u,
  'The live suite must use the BirdCoder UI and its injected generated SDK clients.',
);
assert.doesNotMatch(
  liveSources,
  /\bThread\b|\bthreadId\b/u,
  'BirdCoder live E2E source must use canonical Session terminology.',
);
assert.match(runnerSource, /SDKWORK_CODEX_LIVE_E2E/u);
assert.match(runnerSource, /SDKWORK_CODEX_LIVE_PROVIDER_HOST/u);
assert.match(runnerSource, /SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE/u);
assert.match(runnerSource, /SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE/u);
assert.match(runnerSource, /buildProviderProbeEnvironment/u);
assert.match(
  harnessSource,
  /searchParams\.get\(['"]event_protocol['"]\)\)\.toBe\(['"]kernel-v1['"]\)/u,
);
assert.match(harnessSource, /session_activity_summaries/u);
assert.match(harnessSource, /currentRuntimeBinding/u);
assert.match(harnessSource, /providerSessionId/u);
assert.match(harnessSource, /buildProviderProcessEnvironment/u);
assert.match(specSource, /responseFinishedAt\(\)[\s\S]*toBeNull\(\)/u);
assert.match(specSource, /restartProviderService/u);
assert.match(specSource, /waitForProviderProcessTermination/u);
assert.match(specSource, /assertCanonicalCancellationAccepted/u);
assert.match(specSource, /assertProviderCancellationSettled/u);
assert.match(harnessSource, /status:\s*['"]cancelled['"]/u);
assert.match(harnessSource, /original streamed Turn response must finish after provider cancellation/iu);
assert.match(specSource, /approval returns to the waiting Codex provider/u);
assert.match(specSource, /question answer returns to the waiting Codex provider/u);

const sanitizedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('SDKWORK_CODEX_LIVE_')),
);
const missingEnvironmentResult = spawnSync(
  process.execPath,
  [runnerPath, '--preflight-only'],
  {
    cwd: rootDir,
    encoding: 'utf8',
    env: sanitizedEnvironment,
    windowsHide: true,
  },
);
assert.notEqual(missingEnvironmentResult.status, 0);
assert.match(
  `${missingEnvironmentResult.stdout}${missingEnvironmentResult.stderr}`,
  /Missing required live E2E environment keys/u,
);

const passwordSentinel = 'must-not-appear-in-preflight-output';
const validPreflightEnvironment = {
  ...sanitizedEnvironment,
  SDKWORK_CODEX_LIVE_ACCOUNT: 'live-e2e-user',
  SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID: 'session.live.approval',
  SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON: '["--version","{sessionId}","{turnId}"]',
  SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE: process.execPath,
  SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID: 'session.live.cancel',
  SDKWORK_CODEX_LIVE_E2E: '1',
  SDKWORK_CODEX_LIVE_PASSWORD: passwordSentinel,
  SDKWORK_CODEX_LIVE_PROJECT_NAME: 'Live E2E Project',
  SDKWORK_CODEX_LIVE_PROVIDER_HOST: 'remote',
  SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID: 'session.live.question',
  SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON: '["--version"]',
  SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE: process.execPath,
  SDKWORK_CODEX_LIVE_SEND_SESSION_ID: 'session.live.send',
  SDKWORK_CODEX_LIVE_WEB_URL: 'https://birdcoder-live.example.invalid',
};
const validPreflightResult = spawnSync(
  process.execPath,
  [runnerPath, '--preflight-only'],
  {
    cwd: rootDir,
    encoding: 'utf8',
    env: validPreflightEnvironment,
    windowsHide: true,
  },
);
assert.equal(
  validPreflightResult.status,
  0,
  `${validPreflightResult.stdout}${validPreflightResult.stderr}`,
);
assert.doesNotMatch(
  `${validPreflightResult.stdout}${validPreflightResult.stderr}`,
  new RegExp(passwordSentinel, 'u'),
);

console.log('codex provider live E2E contract passed.');
