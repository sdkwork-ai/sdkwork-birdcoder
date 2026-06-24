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
  return (
    normalizeDeploymentMode(
      readBirdCoderPublicEnvValue(
        'VITE_SDKWORK_DEPLOYMENT_MODE',
        'VITE_BIRDCODER_IAM_DEPLOYMENT_MODE',
        'VITE_SDKWORK_BIRDCODER_IAM_DEPLOYMENT_MODE',
      ),
    ) ?? 'private'
  );
}

export function requiresAuthenticatedProductAccess(): boolean {
  return resolveBirdCoderAuthDeploymentMode() !== 'local';
}

export function buildProtectedRouteLoginPath(redirectTarget?: string | null): string {
  const normalizedTarget = (redirectTarget ?? '').trim();
  if (!normalizedTarget || normalizedTarget.startsWith('/auth')) {
    return '/auth/login';
  }

  return `/auth/login?redirect=${encodeURIComponent(normalizedTarget)}`;
}
