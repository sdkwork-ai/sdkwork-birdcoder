import {
  requireUserCenterProtectedToken,
  resolveUserCenterProtectedToken,
  type UserCenterProtectedTokenRequirementOptions,
  type UserCenterProtectedTokenResolutionOptions,
} from "@sdkwork/user-center-core-pc-react";

export interface BirdCoderUserCenterStoragePlan {
  accessTokenKey: string;
  authTokenKey: string;
  membershipKey: string;
  preferencesKey: string;
  profileKey: string;
  refreshTokenKey: string;
  runtimeStateKey: string;
  sessionHeaderName: string;
  sessionTokenKey: string;
  storageScope: string;
  tokenTypeKey: string;
}

export interface BirdCoderUserCenterTokenBundle {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  sessionToken?: string;
  tokenType?: string;
}

export type BirdCoderIdentityDeploymentMode =
  | "desktop-local"
  | "server-private"
  | "cloud-saas";
export type BirdCoderRuntimeUserCenterProviderKind =
  | "builtin-local"
  | "sdkwork-cloud-app-api"
  | "external-user-center";

export type BirdCoderProtectedTokenResolutionOptions =
  UserCenterProtectedTokenResolutionOptions;
export type BirdCoderProtectedTokenRequirementOptions =
  UserCenterProtectedTokenRequirementOptions;

export const BIRDCODER_USER_CENTER_NAMESPACE = 'sdkwork-birdcoder';
export const BIRDCODER_USER_CENTER_SESSION_HEADER_NAME = 'x-sdkwork-user-center-session-id';
export const BIRDCODER_USER_CENTER_LOCAL_API_BASE_PATH = '/api/app/v1';
export const BIRDCODER_USER_CENTER_AUTH_BASE_PATH = '/auth';
export const BIRDCODER_USER_CENTER_USER_ROUTE_PATH = '/user';
export const BIRDCODER_USER_CENTER_VIP_ROUTE_PATH = '/vip';
export const BIRDCODER_USER_CENTER_ROUTES = Object.freeze({
  authBasePath: BIRDCODER_USER_CENTER_AUTH_BASE_PATH,
  userRoutePath: BIRDCODER_USER_CENTER_USER_ROUTE_PATH,
  vipRoutePath: BIRDCODER_USER_CENTER_VIP_ROUTE_PATH,
});

function normalizeNamespaceSegment(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');

  return normalizedValue || 'sdkwork-app';
}

export function normalizeBirdCoderUserCenterNamespace(namespace: string): string {
  return normalizeNamespaceSegment(namespace);
}

export function createBirdCoderUserCenterStoragePlan(
  namespace: string,
): BirdCoderUserCenterStoragePlan {
  const normalizedNamespace = normalizeBirdCoderUserCenterNamespace(namespace);
  const storageScope = `${normalizedNamespace}.user-center`;

  return {
    accessTokenKey: `${storageScope}.access-token`,
    authTokenKey: `${storageScope}.auth-token`,
    membershipKey: `${storageScope}.membership.v1`,
    preferencesKey: `${storageScope}.preferences.v1`,
    profileKey: `${storageScope}.profile.v1`,
    refreshTokenKey: `${storageScope}.refresh-token`,
    runtimeStateKey: `${storageScope}.runtime-state.v1`,
    sessionHeaderName: BIRDCODER_USER_CENTER_SESSION_HEADER_NAME,
    sessionTokenKey: `${storageScope}.session-token`,
    storageScope,
    tokenTypeKey: `${storageScope}.token-type`,
  };
}

export const BIRDCODER_USER_CENTER_STORAGE_PLAN = Object.freeze(
  createBirdCoderUserCenterStoragePlan(BIRDCODER_USER_CENTER_NAMESPACE),
);

const BIRDCODER_IDENTITY_DEPLOYMENT_MODES = Object.freeze([
  "desktop-local",
  "server-private",
  "cloud-saas",
] satisfies readonly BirdCoderIdentityDeploymentMode[]);
const BIRDCODER_USER_CENTER_LOGIN_PROVIDER_PUBLIC_ENV_KEYS = Object.freeze([
  "VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER",
  "BIRDCODER_USER_CENTER_LOGIN_PROVIDER",
]);

function readBirdCoderPublicEnvValue(...keys: string[]): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  const processEnv =
    typeof globalThis === "object" && globalThis
      ? (
          globalThis as {
            process?: {
              env?: Record<string, string | undefined>;
            };
          }
        ).process?.env
      : undefined;

  for (const key of keys) {
    const metaValue = String(meta.env?.[key] ?? "").trim();
    if (metaValue) {
      return metaValue;
    }

    const processValue = String(processEnv?.[key] ?? "").trim();
    if (processValue) {
      return processValue;
    }
  }

  return undefined;
}

export function normalizeBirdCoderIdentityDeploymentMode(
  value: string | null | undefined,
  fallback: BirdCoderIdentityDeploymentMode = "desktop-local",
): BirdCoderIdentityDeploymentMode {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (
    BIRDCODER_IDENTITY_DEPLOYMENT_MODES.includes(
      normalizedValue as BirdCoderIdentityDeploymentMode,
    )
  ) {
    return normalizedValue as BirdCoderIdentityDeploymentMode;
  }

  return fallback;
}

export function normalizeBirdCoderRuntimeUserCenterProviderKind(
  value: string | null | undefined,
): BirdCoderRuntimeUserCenterProviderKind | undefined {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (normalizedValue === "builtin-local") {
    return "builtin-local";
  }

  if (normalizedValue === "sdkwork-cloud-app-api") {
    return "sdkwork-cloud-app-api";
  }

  if (normalizedValue === "external-user-center") {
    return "external-user-center";
  }

  return undefined;
}

export function resolveBirdCoderIdentityDeploymentModeFromPublicEnv(
  fallback: BirdCoderIdentityDeploymentMode = "desktop-local",
): BirdCoderIdentityDeploymentMode {
  return normalizeBirdCoderIdentityDeploymentMode(
    readBirdCoderPublicEnvValue(
      "VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE",
      "BIRDCODER_IDENTITY_DEPLOYMENT_MODE",
    ),
    fallback,
  );
}

export function resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv(
  fallback?: BirdCoderRuntimeUserCenterProviderKind,
): BirdCoderRuntimeUserCenterProviderKind {
  const configuredProviderKind = normalizeBirdCoderRuntimeUserCenterProviderKind(
    readBirdCoderPublicEnvValue(
      ...BIRDCODER_USER_CENTER_LOGIN_PROVIDER_PUBLIC_ENV_KEYS,
    ),
  );
  if (configuredProviderKind) {
    return configuredProviderKind;
  }

  return (
    fallback
    ?? inferBirdCoderRuntimeUserCenterProviderKindFromIdentityMode(
      resolveBirdCoderIdentityDeploymentModeFromPublicEnv(),
    )
  );
}

export function inferBirdCoderRuntimeUserCenterProviderKindFromIdentityMode(
  identityMode: BirdCoderIdentityDeploymentMode,
): BirdCoderRuntimeUserCenterProviderKind {
  if (identityMode === "cloud-saas") {
    return "sdkwork-cloud-app-api";
  }

  return "builtin-local";
}

export function resolveBirdCoderRuntimeUserCenterProviderKind(
  value?: string | null,
): BirdCoderRuntimeUserCenterProviderKind {
  return (
    normalizeBirdCoderRuntimeUserCenterProviderKind(value)
    ?? resolveBirdCoderRuntimeUserCenterProviderKindFromPublicEnv()
  );
}

export function resolveBirdCoderProtectedToken(
  options: BirdCoderProtectedTokenResolutionOptions,
): string | null {
  return resolveUserCenterProtectedToken(options);
}

export function requireBirdCoderProtectedToken(
  options: BirdCoderProtectedTokenRequirementOptions,
): string {
  return requireUserCenterProtectedToken(options);
}
