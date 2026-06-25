export type BirdCoderAuthDeploymentMode = 'local' | 'private' | 'saas';

function readBirdCoderPublicEnvValue(...keys: string[]): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };

  for (const key of keys) {
    const value = String(meta.env?.[key] ?? '').trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeDeploymentMode(value: string | undefined): BirdCoderAuthDeploymentMode | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'local' || normalized === 'private' || normalized === 'saas'
    ? normalized
    : undefined;
}

export function resolveBirdCoderAuthDeploymentMode(): BirdCoderAuthDeploymentMode {
  const resolved =
    normalizeDeploymentMode(
      readBirdCoderPublicEnvValue(
        'VITE_SDKWORK_DEPLOYMENT_MODE',
        'VITE_BIRDCODER_IAM_DEPLOYMENT_MODE',
        'VITE_SDKWORK_BIRDCODER_IAM_DEPLOYMENT_MODE',
      ),
    ) ?? 'private';

  if (import.meta.env.PROD && resolved === 'local') {
    throw new Error(
      'Production builds must not ship with VITE_SDKWORK_DEPLOYMENT_MODE=local. Use private or saas.',
    );
  }

  return resolved;
}

export function requiresAuthenticatedProductAccess(): boolean {
  return resolveBirdCoderAuthDeploymentMode() !== 'local';
}

const AUTH_SURFACE_BASE_PATH = '/auth';
const AUTH_SURFACE_LOGIN_PATH = `${AUTH_SURFACE_BASE_PATH}/login`;

/** Auth-surface alias kept for IAM/AuthGate; canonical implementation lives in pc-core. */
export function buildProtectedRouteLoginPath(redirectTarget?: string | null): string {
  const normalizedTarget = (redirectTarget ?? '').trim();
  if (!normalizedTarget || normalizedTarget.startsWith(AUTH_SURFACE_BASE_PATH)) {
    return AUTH_SURFACE_LOGIN_PATH;
  }

  return `${AUTH_SURFACE_LOGIN_PATH}?redirect=${encodeURIComponent(normalizedTarget)}`;
}
