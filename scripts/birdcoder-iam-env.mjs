#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { applyTopologyProfileToEnv } from './lib/birdcoder-topology.mjs';
import { mergeRepoDevBootstrapAccessTokenEnv } from './lib/birdcoder-dev-bootstrap-access-token-env.mjs';
import {
  normalizeViteMode,
  resolveWorkspaceRootDir,
} from './run-vite-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const BIRDCODER_IAM_DEPLOYMENT_MODES = Object.freeze([
  'desktop-local',
  'server-private',
  'cloud-saas',
]);
export const SDKWORK_IAM_MODES = Object.freeze([
  'local',
  'private',
  'cloud',
]);

export const DEFAULT_BIRDCODER_REMOTE_API_BASE_URL = 'http://127.0.0.1:10240';
export const DEFAULT_SDKWORK_IAM_DEV_FIXED_VERIFY_CODE = '123456';
export const DEFAULT_SDKWORK_IAM_CLOUD_OAUTH_PROVIDERS = 'wechat,douyin,github';
export const DEFAULT_SDKWORK_IAM_OAUTH_PROVIDERS = 'wechat,douyin,github';

const BIRDCODER_IAM_DEPLOYMENT_MODE_ENV =
  'BIRDCODER_IAM_DEPLOYMENT_MODE';
const VITE_BIRDCODER_IAM_DEPLOYMENT_MODE_ENV =
  'VITE_BIRDCODER_IAM_DEPLOYMENT_MODE';
const SDKWORK_IM_ENVIRONMENT_ENV = 'SDKWORK_IM_ENVIRONMENT';
const SDKWORK_ENV_ENV = 'SDKWORK_ENV';
const SDKWORK_ENVIRONMENT_ENV = 'SDKWORK_ENVIRONMENT';
const SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE_ENV =
  'SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE';
const VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE_ENV =
  'VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE';
const VITE_SDKWORK_DEPLOYMENT_PROFILE_ENV =
  'VITE_SDKWORK_DEPLOYMENT_PROFILE';
const SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV =
  'SDKWORK_BIRDCODER_RUNTIME_TARGET';
const VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV =
  'VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET';
const SDKWORK_RUNTIME_TARGET_ENV = 'SDKWORK_RUNTIME_TARGET';
const VITE_SDKWORK_RUNTIME_TARGET_ENV = 'VITE_SDKWORK_RUNTIME_TARGET';
const SDKWORK_IAM_MODE_ENV = 'SDKWORK_IAM_MODE';
const SDKWORK_IAM_APP_API_BASE_URL_ENV = 'SDKWORK_IAM_APP_API_BASE_URL';
const SDKWORK_IAM_APP_API_OAUTH_PROVIDERS_ENV =
  'SDKWORK_IAM_APP_API_OAUTH_PROVIDERS';
const SDKWORK_IAM_OAUTH_PROVIDERS_ENV =
  'SDKWORK_IAM_OAUTH_PROVIDERS';
const SDKWORK_IAM_DEV_FIXED_VERIFY_CODE_ENV =
  'SDKWORK_IAM_DEV_FIXED_VERIFY_CODE';
const SDKWORK_IAM_OAUTH_ENV_PREFIX = 'SDKWORK_IAM_OAUTH_';
const SDKWORK_IAM_APP_API_ENV_PREFIX = 'SDKWORK_IAM_APP_API_';
const BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV =
  'BIRDCODER_CODING_SERVER_SQLITE_FILE';
const SDKWORK_BIRDCODER_DATABASE_URL_ENV = 'SDKWORK_BIRDCODER_DATABASE_URL';
const SDKWORK_BIRDCODER_DATABASE_ENGINE_ENV = 'SDKWORK_BIRDCODER_DATABASE_ENGINE';
const SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY_ENV =
  'SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY';
const SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID_ENV =
  'SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID';
const BIRDCODER_API_BASE_URL_ENV = 'BIRDCODER_API_BASE_URL';
const VITE_BIRDCODER_API_BASE_URL_ENV = 'VITE_BIRDCODER_API_BASE_URL';
const BIRDCODER_ENABLE_RELEASE_DEMO_LOGIN_ENV =
  'BIRDCODER_ENABLE_RELEASE_DEMO_LOGIN';
const VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV =
  'VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED';
const VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV =
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT';
const VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV =
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL';
const VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV =
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE';
const VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV =
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD';
const VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV =
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD';
const VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE_ENV =
  'VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE';

const SDKWORK_IAM_DATABASE_URL_ENV = 'SDKWORK_IAM_DATABASE_URL';
const CLIENT_IAM_COMMAND_TARGETS = new Set(['desktop-dev', 'h5-dev', 'web-dev']);
const BIRDCODER_PC_MANIFEST_RELATIVE_PATH = path.join(
  'apps',
  'sdkwork-birdcoder-pc',
  'sdkwork.app.config.json',
);

const DEFAULT_SQLITE_RELATIVE_PATHS = Object.freeze({
  'cloud-saas': path.join(
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-server',
    '.local',
    'sdkwork-birdcoder-cloud-saas.sqlite3',
  ),
  'desktop-local': path.join(
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-desktop',
    '.local',
    'sdkwork-birdcoder-pc-desktop-local.sqlite3',
  ),
  'server-private': path.join(
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-server',
    '.local',
    'sdkwork-birdcoder-pc-server-private.sqlite3',
  ),
});

export function resolveBirdcoderPcAppRootDir(
  workspaceRootDir = resolveWorkspaceRootDir(),
) {
  return path.join(workspaceRootDir, 'apps', 'sdkwork-birdcoder-pc');
}

function readTrimmedValue(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || undefined;
}

function parseBoolean(value) {
  const normalizedValue = readTrimmedValue(value)?.toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }

  if (['1', 'on', 'true', 'yes'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

function normalizeApiBaseUrl(value) {
  const normalizedValue = readTrimmedValue(value);
  if (!normalizedValue) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return undefined;
    }

    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/u, '');
    const pathname = normalizedPathname === '/' ? '' : normalizedPathname;
    return `${parsedUrl.origin}${pathname}`;
  } catch {
    return undefined;
  }
}

function setEnvValue(env, key, value) {
  const normalizedValue = readTrimmedValue(value);
  if (!normalizedValue) {
    delete env[key];
    return;
  }

  env[key] = normalizedValue;
}

function setEnvDefault(env, key, value) {
  if (readTrimmedValue(env[key])) {
    return;
  }

  setEnvValue(env, key, value);
}

function sqliteDatabaseUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    return `sqlite:///${normalized}?mode=rwc`;
  }
  return `sqlite://${normalized}?mode=rwc`;
}

function readEnvValue(env, ...keys) {
  for (const key of keys) {
    const value = readTrimmedValue(env[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function clearEnvValues(env, ...keys) {
  for (const key of keys) {
    delete env[key];
  }
}

function clearEnvValuesByPrefix(env, prefix, { except = [] } = {}) {
  const normalizedPrefix = readTrimmedValue(prefix);
  if (!normalizedPrefix) {
    return;
  }

  const excludedKeys = new Set(except);
  for (const key of Object.keys(env)) {
    if (key.startsWith(normalizedPrefix) && !excludedKeys.has(key)) {
      delete env[key];
    }
  }
}

function resolveDefaultIamMode(target) {
  if (
    target === 'server-build'
    || target === 'server-dev'
    || target === 'web-build'
    || target === 'web-dev'
    || target === 'h5-dev'
  ) {
    return 'server-private';
  }

  return 'desktop-local';
}

function resolveSdkworkIamMode(iamDeploymentMode) {
  if (iamDeploymentMode === 'cloud-saas') {
    return 'cloud';
  }

  if (iamDeploymentMode === 'server-private') {
    return 'private';
  }

  return 'local';
}

function resolveSdkworkDeploymentProfile(iamDeploymentMode) {
  return iamDeploymentMode === 'cloud-saas' ? 'cloud' : 'standalone';
}

function resolveSdkworkRuntimeTarget(target) {
  if (target === 'desktop-build' || target === 'desktop-dev') {
    return 'desktop';
  }

  if (target === 'web-build' || target === 'web-dev' || target === 'h5-dev') {
    return 'browser';
  }

  if (target === 'server-build' || target === 'server-dev') {
    return 'server';
  }

  return undefined;
}

function applySdkworkRuntimeConfigEnv({
  env,
  iamMode,
  target,
}) {
  const deploymentProfile = resolveSdkworkDeploymentProfile(iamMode);
  const runtimeTarget = resolveSdkworkRuntimeTarget(target);

  setEnvValue(env, SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE_ENV, deploymentProfile);
  setEnvValue(env, VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE_ENV, deploymentProfile);
  setEnvValue(env, VITE_SDKWORK_DEPLOYMENT_PROFILE_ENV, deploymentProfile);

  if (!runtimeTarget) {
    clearEnvValues(
      env,
      SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV,
      VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV,
      SDKWORK_RUNTIME_TARGET_ENV,
      VITE_SDKWORK_RUNTIME_TARGET_ENV,
    );
    return;
  }

  setEnvValue(env, SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV, runtimeTarget);
  setEnvValue(env, VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET_ENV, runtimeTarget);
  setEnvValue(env, SDKWORK_RUNTIME_TARGET_ENV, runtimeTarget);
  setEnvValue(env, VITE_SDKWORK_RUNTIME_TARGET_ENV, runtimeTarget);
}

export function normalizeBirdcoderIamDeploymentMode(
  value,
  fallback = 'desktop-local',
) {
  const normalizedValue = readTrimmedValue(value)?.toLowerCase();
  if (!normalizedValue) {
    return fallback;
  }

  if (BIRDCODER_IAM_DEPLOYMENT_MODES.includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
}

export function normalizeSdkworkIamMode(value) {
  const normalizedValue = readTrimmedValue(value)?.toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }

  return SDKWORK_IAM_MODES.includes(normalizedValue)
    ? normalizedValue
    : undefined;
}

function applyIamModeScopedEnvDefaults(env, sdkworkIamMode) {
  if (sdkworkIamMode === 'local' || sdkworkIamMode === 'private') {
    clearEnvValuesByPrefix(env, SDKWORK_IAM_APP_API_ENV_PREFIX);
    setEnvDefault(
      env,
      SDKWORK_IAM_OAUTH_PROVIDERS_ENV,
      DEFAULT_SDKWORK_IAM_OAUTH_PROVIDERS,
    );
    return;
  }

  clearEnvValuesByPrefix(env, SDKWORK_IAM_OAUTH_ENV_PREFIX);
  clearEnvValues(env, SDKWORK_IAM_DEV_FIXED_VERIFY_CODE_ENV);
  setEnvDefault(
    env,
    SDKWORK_IAM_APP_API_OAUTH_PROVIDERS_ENV,
    DEFAULT_SDKWORK_IAM_CLOUD_OAUTH_PROVIDERS,
  );
}

function applyIamModeDefaults({
  env,
  iamMode,
}) {
  setEnvDefault(
    env,
    SDKWORK_IAM_MODE_ENV,
    resolveSdkworkIamMode(iamMode),
  );

  const sdkworkIamMode = normalizeSdkworkIamMode(
    readEnvValue(env, SDKWORK_IAM_MODE_ENV),
  );
  if (!sdkworkIamMode) {
    return;
  }

  applyIamModeScopedEnvDefaults(env, sdkworkIamMode);
}

function loadBirdcoderWorkspaceEnv({
  env = process.env,
  viteMode = 'development',
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const resolvedViteMode = normalizeViteMode(viteMode, 'development');
  const pcAppRootDir = resolveBirdcoderPcAppRootDir(workspaceRootDir);
  const fileEnv = {
    ...loadWorkspaceEnvFiles(resolvedViteMode, workspaceRootDir, ''),
    ...loadWorkspaceEnvFiles(resolvedViteMode, pcAppRootDir, ''),
  };

  return {
    ...fileEnv,
    ...env,
  };
}

function isRuntimeDevTarget(target) {
  return target === 'desktop-dev' || target === 'server-dev';
}

function applyWindowsLocalIamDatabaseDefaults({
  env,
  sdkworkIamMode,
  target,
}) {
  if (process.platform !== 'win32') {
    return;
  }

  if (!isRuntimeDevTarget(target)) {
    return;
  }

  if (sdkworkIamMode !== 'local' && sdkworkIamMode !== 'private') {
    return;
  }

  if (readEnvValue(env, SDKWORK_IAM_DATABASE_URL_ENV)) {
    return;
  }

  // Local IAM database URL must come from .env.local; do not embed credentials in repo scripts.
}

function loadWorkspaceEnvFiles(mode, workspaceRootDir, prefix) {
  const viteLoadEnv = resolveViteLoadEnv();
  if (viteLoadEnv) {
    return viteLoadEnv(mode, workspaceRootDir, prefix);
  }

  return loadWorkspaceEnvFilesFallback(mode, workspaceRootDir, prefix);
}

function resolveViteLoadEnv() {
  try {
    const vite = require('vite');
    return typeof vite?.loadEnv === 'function' ? vite.loadEnv : null;
  } catch {
    return null;
  }
}

function loadWorkspaceEnvFilesFallback(mode, workspaceRootDir, prefix) {
  const envFiles = [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`,
  ];
  const fileEnv = {};

  for (const envFile of envFiles) {
    const envPath = path.join(workspaceRootDir, envFile);
    if (!existsSync(envPath)) {
      continue;
    }
    Object.assign(fileEnv, parseEnvFile(readFileSync(envPath, 'utf8'), prefix));
  }

  return fileEnv;
}

function parseEnvFile(source, prefix) {
  const env = {};
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  for (const line of String(source ?? '').split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (shouldIncludeEnvKey(parsed.key, prefixes)) {
      env[parsed.key] = parsed.value;
    }
  }
  return env;
}

function parseEnvLine(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const match = /^(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$/u.exec(trimmed);
  if (!match?.groups) {
    return null;
  }

  return {
    key: match.groups.key,
    value: normalizeEnvFileValue(match.groups.value),
  };
}

function normalizeEnvFileValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed.replace(/\s+#.*$/u, '').trim();
}

function shouldIncludeEnvKey(key, prefixes) {
  if (prefixes.length === 0 || prefixes.some((item) => item === '')) {
    return true;
  }
  return prefixes.some((item) => key.startsWith(item));
}

function resolveSqliteFilePath({
  iamMode,
  workspaceRootDir,
  target,
}) {
  if (target === 'desktop-build') {
    return undefined;
  }

  if (target === 'desktop-dev' && iamMode !== 'desktop-local') {
    return undefined;
  }

  if (
    (target === 'server-dev' || target === 'server-build')
    && iamMode === 'desktop-local'
  ) {
    return undefined;
  }

  const relativePath = DEFAULT_SQLITE_RELATIVE_PATHS[iamMode];
  if (!relativePath) {
    return undefined;
  }

  return path.join(workspaceRootDir, relativePath);
}

function readConfiguredClientApiBaseUrl(env) {
  return normalizeApiBaseUrl(
    readEnvValue(env, BIRDCODER_API_BASE_URL_ENV, VITE_BIRDCODER_API_BASE_URL_ENV),
  );
}

function applyClientApiBaseUrl({
  env,
  iamMode,
  target,
}) {
  const isDesktopTarget = target === 'desktop-build' || target === 'desktop-dev';
  const isWebTarget = target === 'web-build' || target === 'web-dev' || target === 'h5-dev';
  const isClientTarget = isDesktopTarget || isWebTarget;
  if (!isClientTarget) {
    return;
  }

  if (iamMode === 'desktop-local') {
    clearEnvValues(
      env,
      BIRDCODER_API_BASE_URL_ENV,
      VITE_BIRDCODER_API_BASE_URL_ENV,
    );
    return;
  }

  const configuredApiBaseUrl = readConfiguredClientApiBaseUrl(env);
  if (isWebTarget && target === 'web-build' && !configuredApiBaseUrl) {
    clearEnvValues(
      env,
      BIRDCODER_API_BASE_URL_ENV,
      VITE_BIRDCODER_API_BASE_URL_ENV,
    );
    return;
  }

  const resolvedApiBaseUrl =
    configuredApiBaseUrl
    ?? DEFAULT_BIRDCODER_REMOTE_API_BASE_URL;
  setEnvValue(env, BIRDCODER_API_BASE_URL_ENV, resolvedApiBaseUrl);
  setEnvValue(env, VITE_BIRDCODER_API_BASE_URL_ENV, resolvedApiBaseUrl);
}

function applyDevelopmentPrefillDefaults({
  env,
  viteMode,
}) {
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const explicitEnabled = parseBoolean(
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV),
  );
  const resolvedDefaultAccount =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV);
  const resolvedDefaultEmail =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV);
  const resolvedDefaultPhone =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV);
  const resolvedDefaultPassword =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV);
  const resolvedDefaultLoginMethod =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV)
    ?? (
      resolvedDefaultAccount
      || resolvedDefaultEmail
      || resolvedDefaultPhone
      || resolvedDefaultPassword
        ? 'password'
        : undefined
    );
  const hasResolvedPrefillValues = Boolean(
    resolvedDefaultAccount
    || resolvedDefaultEmail
    || resolvedDefaultPhone
    || resolvedDefaultPassword,
  );
  const shouldEnable =
    explicitEnabled
    ?? (
      isDevelopmentLike
      && Boolean(hasResolvedPrefillValues)
    );

  if (typeof shouldEnable === 'boolean') {
    setEnvValue(
      env,
      VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV,
      shouldEnable ? 'true' : 'false',
    );
  }

  if (!shouldEnable) {
    return;
  }

  if (resolvedDefaultAccount) {
    setEnvDefault(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
      resolvedDefaultAccount,
    );
  }
  if (resolvedDefaultEmail) {
    setEnvDefault(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
      resolvedDefaultEmail,
    );
  }
  if (resolvedDefaultPhone) {
    setEnvDefault(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
      resolvedDefaultPhone,
    );
  }
  if (resolvedDefaultPassword) {
    setEnvDefault(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
      resolvedDefaultPassword,
    );
  }
  if (resolvedDefaultLoginMethod) {
    setEnvValue(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV,
      resolvedDefaultLoginMethod,
    );
  }
}

function applyReleaseDemoLoginDefaults({
  env,
  iamMode,
  target,
}) {
  const enableReleaseDemoLogin = parseBoolean(
    readEnvValue(env, BIRDCODER_ENABLE_RELEASE_DEMO_LOGIN_ENV),
  );
  if (!enableReleaseDemoLogin) {
    return;
  }

  const isClientBuildTarget = target === 'desktop-build' || target === 'web-build';
  if (!isClientBuildTarget) {
    return;
  }

  const sdkworkIamMode =
    normalizeSdkworkIamMode(readEnvValue(env, SDKWORK_IAM_MODE_ENV))
    ?? resolveSdkworkIamMode(iamMode);
  if (sdkworkIamMode === 'cloud') {
    return;
  }

  const prefillAccount =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV)
    ?? readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV);
  const prefillPhone =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV);
  const prefillPassword =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV);
  if (!prefillAccount || !prefillPassword) {
    return;
  }

  setEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV, 'true');
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
    prefillAccount,
  );
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
    prefillAccount,
  );
  if (prefillPhone) {
    setEnvDefault(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
      prefillPhone,
    );
  }
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
    prefillPassword,
  );
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV,
    'password',
  );
}

function applyAuthSurfaceDefaults({
  env,
}) {
  setEnvDefault(env, VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE_ENV, 'qr-only');
}

function applyIamDevEnvironmentDefaults({
  env,
  viteMode,
  iamMode,
}) {
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  if (!isDevelopmentLike) {
    return;
  }

  // Set IAM development environment markers so the Rust server's
  // allows_dev_authentication_fallback() returns true, skipping manifest
  // permission checks when the IAM permission catalog is not provisioned
  // (e.g. SQLite local databases). See sdkwork-iam-web-adapter
  // dev_runtime.rs and production_runtime.rs for the detection logic.
  setEnvDefault(env, SDKWORK_IM_ENVIRONMENT_ENV, 'dev');
  setEnvDefault(env, SDKWORK_ENV_ENV, 'dev');
  setEnvDefault(env, SDKWORK_ENVIRONMENT_ENV, 'development');
}

function applyLocalVerifyCodeDefaults({
  env,
  iamMode,
  target,
  viteMode,
}) {
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const isServerRuntimeTarget = target === 'desktop-dev' || target === 'server-dev';
  const sdkworkIamMode =
    normalizeSdkworkIamMode(readEnvValue(env, SDKWORK_IAM_MODE_ENV))
    ?? resolveSdkworkIamMode(iamMode);
  if (
    !isDevelopmentLike
    || !isServerRuntimeTarget
    || sdkworkIamMode === 'cloud'
  ) {
    return;
  }

  setEnvDefault(
    env,
    SDKWORK_IAM_DEV_FIXED_VERIFY_CODE_ENV,
    DEFAULT_SDKWORK_IAM_DEV_FIXED_VERIFY_CODE,
  );
}

export function resolveBirdcoderIamDeveloperExperience({
  env = process.env,
  iamMode,
  viteMode = 'development',
} = {}) {
  const resolvedIamMode = normalizeBirdcoderIamDeploymentMode(
    iamMode,
    'desktop-local',
  );
  const sdkworkIamMode =
    normalizeSdkworkIamMode(readEnvValue(env, SDKWORK_IAM_MODE_ENV))
    ?? resolveSdkworkIamMode(resolvedIamMode);
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const verifyCode =
    readEnvValue(env, SDKWORK_IAM_DEV_FIXED_VERIFY_CODE_ENV)
    ?? DEFAULT_SDKWORK_IAM_DEV_FIXED_VERIFY_CODE;
  const configuredQuickLoginAccount = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
  );
  const configuredQuickLoginEmail = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
  );
  const configuredQuickLoginPhone = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
  );
  const configuredQuickLoginPassword = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
  );
  const configuredQuickLoginMethod = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV,
  );
  const prefillEnabled = parseBoolean(
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV),
  );
  const explicitQuickLoginConfigured = Boolean(
    prefillEnabled
    && (
      configuredQuickLoginAccount
      || configuredQuickLoginEmail
      || configuredQuickLoginPhone
      || configuredQuickLoginPassword
      || configuredQuickLoginMethod
    ),
  );

  return {
    iamMode: sdkworkIamMode,
    quickLogin:
      isDevelopmentLike && explicitQuickLoginConfigured
        ? {
            account: configuredQuickLoginAccount ?? configuredQuickLoginEmail,
            email: configuredQuickLoginEmail ?? configuredQuickLoginAccount,
            phone: configuredQuickLoginPhone,
            password: configuredQuickLoginPassword,
            loginMethod: configuredQuickLoginMethod ?? 'password',
            verifyCode,
          }
        : null,
  };
}

export function resolveBirdcoderIamCommandEnv({
  env = process.env,
  iamMode,
  target = 'desktop-dev',
  viteMode = 'development',
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const resolvedViteMode = normalizeViteMode(viteMode, 'development');
  const loadedEnv = loadBirdcoderWorkspaceEnv({
    env,
    viteMode: resolvedViteMode,
    workspaceRootDir,
  });
  const resolvedIamMode = normalizeBirdcoderIamDeploymentMode(
    iamMode ?? loadedEnv[BIRDCODER_IAM_DEPLOYMENT_MODE_ENV],
    resolveDefaultIamMode(target),
  );
  const nextEnv = applyTopologyProfileToEnv({
    env: loadedEnv,
    iamMode: resolvedIamMode,
    target,
    viteMode: resolvedViteMode,
  });
  const errors = [];
  const sdkworkIamMode = resolveSdkworkIamMode(resolvedIamMode);

  setEnvValue(
    nextEnv,
    BIRDCODER_IAM_DEPLOYMENT_MODE_ENV,
    resolvedIamMode,
  );
  setEnvValue(
    nextEnv,
    VITE_BIRDCODER_IAM_DEPLOYMENT_MODE_ENV,
    resolvedIamMode,
  );
  applyIamDevEnvironmentDefaults({
    env: nextEnv,
    viteMode: resolvedViteMode,
    iamMode: resolvedIamMode,
  });
  setEnvValue(nextEnv, SDKWORK_IAM_MODE_ENV, sdkworkIamMode);
  applySdkworkRuntimeConfigEnv({
    env: nextEnv,
    iamMode: resolvedIamMode,
    target,
  });

  applyIamModeDefaults({
    env: nextEnv,
    iamMode: resolvedIamMode,
  });
  const resolvedSdkworkIamMode = normalizeSdkworkIamMode(
    readEnvValue(nextEnv, SDKWORK_IAM_MODE_ENV),
  );
  if (!resolvedSdkworkIamMode) {
    errors.push(
      `${SDKWORK_IAM_MODE_ENV} must be one of: ${SDKWORK_IAM_MODES.join(', ')}.`,
    );
  }

  applyClientApiBaseUrl({
    env: nextEnv,
    iamMode: resolvedIamMode,
    target,
  });

  applyWindowsLocalIamDatabaseDefaults({
    env: nextEnv,
    sdkworkIamMode: resolvedSdkworkIamMode,
    target,
  });

  if (
    target === 'desktop-build'
    && resolvedIamMode !== 'desktop-local'
    && !readConfiguredClientApiBaseUrl(loadedEnv)
  ) {
    errors.push(
      `${BIRDCODER_API_BASE_URL_ENV} or ${VITE_BIRDCODER_API_BASE_URL_ENV} must be configured when building desktop packages for ${resolvedIamMode}.`,
    );
  }

  const sqliteFilePath = resolveSqliteFilePath({
    iamMode: resolvedIamMode,
    target,
    workspaceRootDir,
  });
  if (sqliteFilePath) {
    setEnvDefault(nextEnv, BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV, sqliteFilePath);
    setEnvDefault(
      nextEnv,
      SDKWORK_BIRDCODER_DATABASE_URL_ENV,
      sqliteDatabaseUrl(sqliteFilePath),
    );
    setEnvDefault(nextEnv, SDKWORK_BIRDCODER_DATABASE_ENGINE_ENV, 'sqlite');
  }

  // Development-only runtime-location encryption defaults. Production must
  // inject these from a protected secret manager; these values never enter
  // VITE_*, client bundles, or checked-in env example files.
  setEnvDefault(
    nextEnv,
    SDKWORK_BIRDCODER_RUNTIME_LOCATION_MASTER_KEY_ENV,
    'standalone-development-runtime-location-master-key',
  );
  setEnvDefault(
    nextEnv,
    SDKWORK_BIRDCODER_RUNTIME_LOCATION_KEY_ID_ENV,
    'standalone-development-v1',
  );

  applyAuthSurfaceDefaults({
    env: nextEnv,
  });

  applyReleaseDemoLoginDefaults({
    env: nextEnv,
    iamMode: resolvedIamMode,
    target,
  });

  applyDevelopmentPrefillDefaults({
    env: nextEnv,
    viteMode: resolvedViteMode,
  });

  applyLocalVerifyCodeDefaults({
    env: nextEnv,
    iamMode: resolvedIamMode,
    target,
    viteMode: resolvedViteMode,
  });

  if (CLIENT_IAM_COMMAND_TARGETS.has(target)) {
    Object.assign(
      nextEnv,
      mergeRepoDevBootstrapAccessTokenEnv({
        repoRoot: workspaceRootDir,
        manifestPath: BIRDCODER_PC_MANIFEST_RELATIVE_PATH,
        appId: 'sdkwork-birdcoder',
        env: nextEnv,
      }),
    );
  }

  if (
    resolvedIamMode === 'cloud-saas'
    && (target === 'server-build' || target === 'server-dev')
    && !readEnvValue(nextEnv, SDKWORK_IAM_APP_API_BASE_URL_ENV)
  ) {
    errors.push(
      `${SDKWORK_IAM_APP_API_BASE_URL_ENV} is required when ${BIRDCODER_IAM_DEPLOYMENT_MODE_ENV}=cloud-saas for server commands.`,
    );
  }

  return {
    env: nextEnv,
    errors,
    iamMode: resolvedIamMode,
    sdkworkIamMode: resolvedSdkworkIamMode,
    viteMode: resolvedViteMode,
    developerExperience: resolveBirdcoderIamDeveloperExperience({
      env: nextEnv,
      iamMode: resolvedIamMode,
      viteMode: resolvedViteMode,
    }),
  };
}

export const birdcoderIamEnvMeta = {
  module: 'birdcoder-iam-env',
  workspaceRootDir: resolveWorkspaceRootDir(),
  scriptDir: __dirname,
};
