#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';

import {
  normalizeViteMode,
  resolveWorkspaceRootDir,
} from './run-vite-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BIRDCODER_IDENTITY_DEPLOYMENT_MODES = Object.freeze([
  'desktop-local',
  'server-private',
  'cloud-saas',
]);
export const BIRDCODER_USER_CENTER_LOGIN_PROVIDERS = Object.freeze([
  'builtin-local',
  'sdkwork-cloud-app-api',
  'external-user-center',
]);

export const DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT =
  'local-default@sdkwork-birdcoder.local';
export const DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PHONE = '13800000000';
export const DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD = 'dev123456';
export const DEFAULT_BIRDCODER_LOCAL_VERIFY_CODE = '123456';
export const DEFAULT_BIRDCODER_REMOTE_API_BASE_URL = 'http://127.0.0.1:10240';
export const DEFAULT_BIRDCODER_CLOUD_OAUTH_PROVIDERS = 'wechat,douyin,github';
export const DEFAULT_BIRDCODER_LOCAL_OAUTH_PROVIDERS = 'wechat,douyin,github';

const BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV =
  'BIRDCODER_IDENTITY_DEPLOYMENT_MODE';
const BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV =
  'BIRDCODER_USER_CENTER_LOGIN_PROVIDER';
const VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV =
  'VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER';
const BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV =
  'BIRDCODER_USER_CENTER_APP_API_BASE_URL';
const BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS_ENV =
  'BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS';
const BIRDCODER_LOCAL_OAUTH_PROVIDERS_ENV =
  'BIRDCODER_LOCAL_OAUTH_PROVIDERS';
const BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV =
  'BIRDCODER_CODING_SERVER_SQLITE_FILE';
const BIRDCODER_API_BASE_URL_ENV = 'BIRDCODER_API_BASE_URL';
const VITE_BIRDCODER_API_BASE_URL_ENV = 'VITE_BIRDCODER_API_BASE_URL';
const BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV = 'BIRDCODER_LOCAL_BOOTSTRAP_EMAIL';
const BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV = 'BIRDCODER_LOCAL_BOOTSTRAP_PHONE';
const BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV =
  'BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD';
const BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV =
  'BIRDCODER_LOCAL_VERIFY_CODE_FIXED';
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
const VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV =
  'VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE';
const BIRDCODER_LOCAL_OAUTH_ENV_PREFIX = 'BIRDCODER_LOCAL_OAUTH_';
const BIRDCODER_USER_CENTER_APP_API_ENV_PREFIX =
  'BIRDCODER_USER_CENTER_APP_API_';
const BIRDCODER_USER_CENTER_EXTERNAL_ENV_PREFIX =
  'BIRDCODER_USER_CENTER_EXTERNAL_';

const DEFAULT_SQLITE_RELATIVE_PATHS = Object.freeze({
  'cloud-saas': path.join(
    'packages',
    'sdkwork-birdcoder-server',
    '.local',
    'sdkwork-birdcoder-cloud-saas.sqlite3',
  ),
  'desktop-local': path.join(
    'packages',
    'sdkwork-birdcoder-desktop',
    '.local',
    'sdkwork-birdcoder-desktop-local.sqlite3',
  ),
  'server-private': path.join(
    'packages',
    'sdkwork-birdcoder-server',
    '.local',
    'sdkwork-birdcoder-server-private.sqlite3',
  ),
});

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

function resolveDefaultIdentityMode(target) {
  if (
    target === 'server-build'
    || target === 'server-dev'
    || target === 'web-build'
    || target === 'web-dev'
  ) {
    return 'server-private';
  }

  return 'desktop-local';
}

export function normalizeBirdcoderIdentityDeploymentMode(
  value,
  fallback = 'desktop-local',
) {
  const normalizedValue = readTrimmedValue(value)?.toLowerCase();
  if (!normalizedValue) {
    return fallback;
  }

  if (BIRDCODER_IDENTITY_DEPLOYMENT_MODES.includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
}

export function normalizeBirdcoderUserCenterLoginProvider(value) {
  const normalizedValue = readTrimmedValue(value)?.toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }

  if (BIRDCODER_USER_CENTER_LOGIN_PROVIDERS.includes(normalizedValue)) {
    return normalizedValue;
  }

  return undefined;
}

function resolveImplicitUserCenterLoginProvider(identityMode) {
  return identityMode === 'cloud-saas'
    ? 'sdkwork-cloud-app-api'
    : 'builtin-local';
}

function applyProviderScopedEnvDefaults(env, providerKind) {
  if (providerKind === 'builtin-local') {
    clearEnvValuesByPrefix(env, BIRDCODER_USER_CENTER_APP_API_ENV_PREFIX);
    clearEnvValuesByPrefix(env, BIRDCODER_USER_CENTER_EXTERNAL_ENV_PREFIX);
    setEnvDefault(
      env,
      BIRDCODER_LOCAL_OAUTH_PROVIDERS_ENV,
      DEFAULT_BIRDCODER_LOCAL_OAUTH_PROVIDERS,
    );
    return;
  }

  clearEnvValuesByPrefix(env, BIRDCODER_LOCAL_OAUTH_ENV_PREFIX);
  clearEnvValues(env, BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV);

  if (providerKind === 'sdkwork-cloud-app-api') {
    clearEnvValuesByPrefix(env, BIRDCODER_USER_CENTER_EXTERNAL_ENV_PREFIX);
    setEnvDefault(
      env,
      BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS_ENV,
      DEFAULT_BIRDCODER_CLOUD_OAUTH_PROVIDERS,
    );
    return;
  }

  clearEnvValuesByPrefix(env, BIRDCODER_USER_CENTER_APP_API_ENV_PREFIX);
}

function stripRemoteProviderSampleDevelopmentPrefill({
  env,
  providerKind,
  bootstrapAccount,
  bootstrapPhone,
  bootstrapPassword,
}) {
  if (providerKind === 'builtin-local') {
    return;
  }

  let removedSampleValue = false;
  const sampleDefaults = [
    [VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV, bootstrapAccount],
    [VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV, bootstrapAccount],
    [VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV, bootstrapPhone],
    [VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV, bootstrapPassword],
  ];

  for (const [key, sampleValue] of sampleDefaults) {
    if (readEnvValue(env, key) === sampleValue) {
      delete env[key];
      removedSampleValue = true;
    }
  }

  const remainingPrefillValues = readEnvValue(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
  );
  const loginMethod = readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV);
  if (removedSampleValue && loginMethod === 'password' && !remainingPrefillValues) {
    delete env[VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV];
  }

  if (
    removedSampleValue
    && !readEnvValue(
      env,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
      VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD_ENV,
    )
  ) {
    setEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV, 'false');
  }
}

export function loadBirdcoderWorkspaceEnv({
  env = process.env,
  viteMode = 'development',
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const resolvedViteMode = normalizeViteMode(viteMode, 'development');
  const fileEnv = loadEnv(resolvedViteMode, workspaceRootDir, '');

  return {
    ...fileEnv,
    ...env,
  };
}

function resolveSqliteFilePath({
  identityMode,
  workspaceRootDir,
  target,
}) {
  if (target === 'desktop-build') {
    return undefined;
  }

  if (target === 'desktop-dev' && identityMode !== 'desktop-local') {
    return undefined;
  }

  if (
    (target === 'server-dev' || target === 'server-build')
    && identityMode === 'desktop-local'
  ) {
    return undefined;
  }

  const relativePath = DEFAULT_SQLITE_RELATIVE_PATHS[identityMode];
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
  identityMode,
  target,
}) {
  const isDesktopTarget = target === 'desktop-build' || target === 'desktop-dev';
  const isWebTarget = target === 'web-build' || target === 'web-dev';
  const isClientTarget = isDesktopTarget || isWebTarget;
  if (!isClientTarget) {
    return;
  }

  if (identityMode === 'desktop-local') {
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

function applyUserCenterProviderDefaults({
  env,
  identityMode,
}) {
  setEnvDefault(
    env,
    BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV,
    resolveImplicitUserCenterLoginProvider(identityMode),
  );

  const providerKind = normalizeBirdcoderUserCenterLoginProvider(
    readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
  );
  if (!providerKind) {
    return;
  }

  applyProviderScopedEnvDefaults(env, providerKind);
}

function applyUserCenterProviderPublicEnv(env) {
  const providerKind = normalizeBirdcoderUserCenterLoginProvider(
    readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
  );
  if (!providerKind) {
    delete env[VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV];
    return;
  }

  setEnvValue(env, VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV, providerKind);
}

function applyDevelopmentPrefillDefaults({
  env,
  identityMode,
  viteMode,
}) {
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const providerKind =
    normalizeBirdcoderUserCenterLoginProvider(
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
    )
    ?? (
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        ? undefined
        : resolveImplicitUserCenterLoginProvider(identityMode)
    );
  const isBuiltinLocalProvider = providerKind === 'builtin-local';
  const explicitEnabled = parseBoolean(
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV),
  );
  const bootstrapAccount =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT;
  const bootstrapPhone =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PHONE;
  const bootstrapPassword =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD;
  stripRemoteProviderSampleDevelopmentPrefill({
    env,
    providerKind,
    bootstrapAccount,
    bootstrapPhone,
    bootstrapPassword,
  });
  const resolvedDefaultAccount =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV)
    ?? (isBuiltinLocalProvider ? bootstrapAccount : undefined);
  const resolvedDefaultEmail =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV)
    ?? (isBuiltinLocalProvider ? bootstrapAccount : undefined);
  const resolvedDefaultPhone =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV)
    ?? (isBuiltinLocalProvider ? bootstrapPhone : undefined);
  const resolvedDefaultPassword =
    readEnvValue(env, VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV)
    ?? (isBuiltinLocalProvider ? bootstrapPassword : undefined);
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
      && Boolean(
        hasResolvedPrefillValues,
      )
    );
  const resolvedShouldEnable =
    !isBuiltinLocalProvider && !hasResolvedPrefillValues
      ? false
      : shouldEnable;

  if (typeof resolvedShouldEnable === 'boolean') {
    setEnvValue(
      env,
      VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV,
      resolvedShouldEnable ? 'true' : 'false',
    );
  }

  if (!resolvedShouldEnable) {
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
  identityMode,
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

  const providerKind =
    normalizeBirdcoderUserCenterLoginProvider(
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
    )
    ?? (
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        ? undefined
        : resolveImplicitUserCenterLoginProvider(identityMode)
    );
  if (providerKind !== 'builtin-local') {
    return;
  }

  const bootstrapAccount =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT;
  const bootstrapPhone =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PHONE;
  const bootstrapPassword =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD;

  setEnvValue(env, VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED_ENV, 'true');
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT_ENV,
    bootstrapAccount,
  );
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL_ENV,
    bootstrapAccount,
  );
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE_ENV,
    bootstrapPhone,
  );
  setEnvDefault(
    env,
    VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD_ENV,
    bootstrapPassword,
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

function applyLocalVerifyCodeDefaults({
  env,
  identityMode,
  target,
  viteMode,
}) {
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const isServerRuntimeTarget = target === 'desktop-dev' || target === 'server-dev';
  const providerKind =
    normalizeBirdcoderUserCenterLoginProvider(
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
    )
    ?? (
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        ? undefined
        : resolveImplicitUserCenterLoginProvider(identityMode)
    );
  if (
    !isDevelopmentLike
    || !isServerRuntimeTarget
    || providerKind !== 'builtin-local'
  ) {
    return;
  }

  setEnvDefault(
    env,
    BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV,
    DEFAULT_BIRDCODER_LOCAL_VERIFY_CODE,
  );
}

export function resolveBirdcoderIdentityDeveloperExperience({
  env = process.env,
  identityMode,
  viteMode = 'development',
} = {}) {
  const resolvedIdentityMode = normalizeBirdcoderIdentityDeploymentMode(
    identityMode,
    'desktop-local',
  );
  const providerKind =
    normalizeBirdcoderUserCenterLoginProvider(
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
    )
    ?? (
      readEnvValue(env, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        ? undefined
        : resolveImplicitUserCenterLoginProvider(resolvedIdentityMode)
    );
  const isDevelopmentLike = viteMode === 'development' || viteMode === 'test';
  const bootstrapAccount =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_ACCOUNT;
  const bootstrapPhone =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PHONE;
  const bootstrapPassword =
    readEnvValue(env, BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD;
  const verifyCode =
    readEnvValue(env, BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV)
    ?? DEFAULT_BIRDCODER_LOCAL_VERIFY_CODE;
  const localProviderEnabled = providerKind === 'builtin-local';
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
  const explicitQuickLoginConfigured = Boolean(
    configuredQuickLoginAccount
    || configuredQuickLoginEmail
    || configuredQuickLoginPhone
    || configuredQuickLoginPassword
    || configuredQuickLoginMethod,
  );

  return {
    bootstrapUser:
      localProviderEnabled
        ? {
            account: bootstrapAccount,
            email: bootstrapAccount,
            phone: bootstrapPhone,
          }
        : null,
    providerKind,
    quickLogin:
      isDevelopmentLike && (localProviderEnabled || explicitQuickLoginConfigured)
        ? {
            account:
              configuredQuickLoginAccount
              ?? (localProviderEnabled ? bootstrapAccount : undefined),
            email:
              configuredQuickLoginEmail
              ?? (localProviderEnabled ? bootstrapAccount : undefined),
            phone:
              configuredQuickLoginPhone
              ?? (localProviderEnabled ? bootstrapPhone : undefined),
            password:
              configuredQuickLoginPassword
              ?? (localProviderEnabled ? bootstrapPassword : undefined),
            loginMethod:
              configuredQuickLoginMethod
              ?? 'password',
            ...(localProviderEnabled
              ? {
                  verifyCode,
                }
              : {}),
          }
        : null,
  };
}

export function resolveBirdcoderIdentityCommandEnv({
  env = process.env,
  identityMode,
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
  const nextEnv = {
    ...loadedEnv,
  };
  const resolvedIdentityMode = normalizeBirdcoderIdentityDeploymentMode(
    identityMode ?? nextEnv[BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV],
    resolveDefaultIdentityMode(target),
  );
  const errors = [];

  setEnvValue(
    nextEnv,
    BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV,
    resolvedIdentityMode,
  );
  setEnvValue(
    nextEnv,
    VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV,
    resolvedIdentityMode,
  );

  applyUserCenterProviderDefaults({
    env: nextEnv,
    identityMode: resolvedIdentityMode,
  });
  const resolvedProviderKind = normalizeBirdcoderUserCenterLoginProvider(
    readEnvValue(nextEnv, BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV),
  );
  if (!resolvedProviderKind) {
    errors.push(
      `${BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV} must be one of: ${BIRDCODER_USER_CENTER_LOGIN_PROVIDERS.join(', ')}.`,
    );
  } else {
    setEnvValue(
      nextEnv,
      BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV,
      resolvedProviderKind,
    );
  }
  applyUserCenterProviderPublicEnv(nextEnv);

  applyClientApiBaseUrl({
    env: nextEnv,
    identityMode: resolvedIdentityMode,
    target,
  });

  if (
    target === 'desktop-build'
    && resolvedIdentityMode !== 'desktop-local'
    && !readConfiguredClientApiBaseUrl(loadedEnv)
  ) {
    errors.push(
      `${BIRDCODER_API_BASE_URL_ENV} or ${VITE_BIRDCODER_API_BASE_URL_ENV} must be configured when building desktop packages for ${resolvedIdentityMode}.`,
    );
  }

  const sqliteFilePath = resolveSqliteFilePath({
    identityMode: resolvedIdentityMode,
    target,
    workspaceRootDir,
  });
  if (sqliteFilePath) {
    setEnvDefault(nextEnv, BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV, sqliteFilePath);
  }

  applyAuthSurfaceDefaults({
    env: nextEnv,
  });

  applyReleaseDemoLoginDefaults({
    env: nextEnv,
    identityMode: resolvedIdentityMode,
    target,
  });

  applyDevelopmentPrefillDefaults({
    env: nextEnv,
    identityMode: resolvedIdentityMode,
    viteMode: resolvedViteMode,
  });

  applyLocalVerifyCodeDefaults({
    env: nextEnv,
    identityMode: resolvedIdentityMode,
    target,
    viteMode: resolvedViteMode,
  });

  if (
    resolvedIdentityMode === 'cloud-saas'
    && (target === 'server-build' || target === 'server-dev')
    && !readEnvValue(nextEnv, BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV)
  ) {
    errors.push(
      `${BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV} is required when ${BIRDCODER_IDENTITY_DEPLOYMENT_MODE_ENV}=cloud-saas for server commands.`,
    );
  }

  return {
    env: nextEnv,
    errors,
    identityMode: resolvedIdentityMode,
    viteMode: resolvedViteMode,
  };
}

export const birdcoderIdentityEnvMeta = {
  module: 'birdcoder-identity-env',
  workspaceRootDir: resolveWorkspaceRootDir(),
  scriptDir: __dirname,
};
