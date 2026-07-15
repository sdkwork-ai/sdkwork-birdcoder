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

function resolveDeploymentModeFromAppScopedEnv(): BirdCoderAuthDeploymentMode | undefined {
  const profile = readBirdCoderPublicEnvValue(
    'VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE',
    'VITE_SDKWORK_DEPLOYMENT_PROFILE',
  )?.toLowerCase();
  if (profile === 'cloud') {
    return 'saas';
  }
  if (profile === 'standalone') {
    const target = readBirdCoderPublicEnvValue(
      'VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET',
      'VITE_SDKWORK_RUNTIME_TARGET',
    )?.toLowerCase();
    return target === 'desktop' ? 'local' : 'private';
  }
  return undefined;
}

export function resolveBirdCoderAuthDeploymentMode(): BirdCoderAuthDeploymentMode {
  const resolved = resolveDeploymentModeFromAppScopedEnv() ?? 'private';

  if ((import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD && resolved === 'local') {
    throw new Error(
      'Production builds must not ship with a standalone+desktop deployment profile. Use server-private or cloud-saas.',
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
