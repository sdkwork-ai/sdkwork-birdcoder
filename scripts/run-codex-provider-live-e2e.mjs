#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pcAppDir = path.join(rootDir, 'apps/sdkwork-birdcoder-pc');
const playwrightCli = path.join(rootDir, 'node_modules/@playwright/test/cli.js');
const configPath = path.join(pcAppDir, 'playwright.codex-provider-live.config.ts');
const canonicalSessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const requiredEnvironmentKeys = [
  'SDKWORK_CODEX_LIVE_E2E',
  'SDKWORK_CODEX_LIVE_WEB_URL',
  'SDKWORK_CODEX_LIVE_ACCOUNT',
  'SDKWORK_CODEX_LIVE_PASSWORD',
  'SDKWORK_CODEX_LIVE_PROJECT_NAME',
  'SDKWORK_CODEX_LIVE_SEND_SESSION_ID',
  'SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID',
  'SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID',
  'SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID',
  'SDKWORK_CODEX_LIVE_PROVIDER_HOST',
  'SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE',
  'SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON',
  'SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE',
  'SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON',
];

function readEnvironmentValue(key) {
  return process.env[key]?.trim() ?? '';
}

function buildProviderProbeEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => ![
      'SDKWORK_CODEX_LIVE_ACCOUNT',
      'SDKWORK_CODEX_LIVE_PASSWORD',
    ].includes(key)),
  );
}

function parseStringArray(key) {
  const rawValue = readEnvironmentValue(key);
  let parsedValue;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error(`${key} must be a JSON array of strings.`);
  }
  if (!Array.isArray(parsedValue) || parsedValue.some((value) => typeof value !== 'string')) {
    throw new Error(`${key} must be a JSON array of strings.`);
  }
  return parsedValue;
}

function validateExecutable(key) {
  const executable = readEnvironmentValue(key);
  if (!path.isAbsolute(executable) || !existsSync(executable)) {
    throw new Error(`${key} must name an existing absolute executable path.`);
  }
}

function validateLiveEnvironment() {
  const missingKeys = requiredEnvironmentKeys.filter((key) => !readEnvironmentValue(key));
  if (missingKeys.length > 0) {
    throw new Error(`Missing required live E2E environment keys: ${missingKeys.join(', ')}`);
  }
  if (readEnvironmentValue('SDKWORK_CODEX_LIVE_E2E') !== '1') {
    throw new Error('SDKWORK_CODEX_LIVE_E2E must be exactly 1.');
  }

  const liveWebUrl = new URL(readEnvironmentValue('SDKWORK_CODEX_LIVE_WEB_URL'));
  if (!['http:', 'https:'].includes(liveWebUrl.protocol)) {
    throw new Error('SDKWORK_CODEX_LIVE_WEB_URL must use http or https.');
  }
  if (liveWebUrl.username || liveWebUrl.password) {
    throw new Error('SDKWORK_CODEX_LIVE_WEB_URL must not contain credentials.');
  }

  const sessionIds = [
    readEnvironmentValue('SDKWORK_CODEX_LIVE_SEND_SESSION_ID'),
    readEnvironmentValue('SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID'),
    readEnvironmentValue('SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID'),
    readEnvironmentValue('SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID'),
  ];
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw new Error('Each live capability must use a distinct canonical Session fixture.');
  }
  if (sessionIds.some((sessionId) => !canonicalSessionIdPattern.test(sessionId))) {
    throw new Error('Live canonical Session fixture IDs contain unsupported characters.');
  }

  const providerHost = readEnvironmentValue('SDKWORK_CODEX_LIVE_PROVIDER_HOST');
  if (!['local', 'remote'].includes(providerHost)) {
    throw new Error('SDKWORK_CODEX_LIVE_PROVIDER_HOST must be local or remote.');
  }

  validateExecutable('SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE');
  validateExecutable('SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE');
  parseStringArray('SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON');
  const cancelProbeArguments = parseStringArray(
    'SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON',
  );
  if (
    !cancelProbeArguments.some((value) => value.includes('{sessionId}'))
    || !cancelProbeArguments.some((value) => value.includes('{turnId}'))
  ) {
    throw new Error(
      'SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON must scope the probe with '
        + '{sessionId} and {turnId}.',
    );
  }

  if (providerHost === 'local') {
    const codexExecutable = readEnvironmentValue('SDKWORK_CODEX_LIVE_CODEX_EXECUTABLE') || 'codex';
    const loginStatus = spawnSync(codexExecutable, ['login', 'status'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: buildProviderProbeEnvironment(),
      shell: false,
      windowsHide: true,
    });
    if (loginStatus.status !== 0) {
      throw new Error('The local Codex provider host is not authenticated.');
    }
  }
}

function run() {
  if (!existsSync(playwrightCli)) {
    throw new Error('Missing @playwright/test. Run pnpm install from the repository root.');
  }
  if (!existsSync(configPath)) {
    throw new Error('Missing the Codex real-provider Playwright configuration.');
  }

  validateLiveEnvironment();
  if (process.argv.includes('--preflight-only')) {
    console.log('Codex real-provider E2E preflight passed.');
    return;
  }

  const forwardedArguments = process.argv.slice(2).filter((value) => value !== '--preflight-only');
  const result = spawnSync(
    process.execPath,
    [
      playwrightCli,
      'test',
      '--config',
      configPath,
      'tests/e2e-live/codex-provider-live.spec.ts',
      ...forwardedArguments,
    ],
    {
      cwd: pcAppDir,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
