export const BIRDCODER_AUTH_SURFACE_BASE_PATH = '/auth';
export const BIRDCODER_AUTH_SURFACE_LOGIN_PATH = `${BIRDCODER_AUTH_SURFACE_BASE_PATH}/login`;

export function normalizeBirdCoderAuthSurfacePath(
  rawPath: string | null | undefined,
): string {
  const normalizedPath = (rawPath ?? '').trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

export function isBirdCoderAuthSurfacePath(path: string): boolean {
  const normalizedPath = normalizeBirdCoderAuthSurfacePath(path);
  return normalizedPath === BIRDCODER_AUTH_SURFACE_BASE_PATH
    || normalizedPath.startsWith(`${BIRDCODER_AUTH_SURFACE_BASE_PATH}/`);
}

export function buildBirdCoderProtectedLoginPath(
  redirectTarget?: string | null,
): string {
  const rawTarget = (redirectTarget ?? '').trim();
  if (
    /^(?:[a-z][a-z\d+.-]*:|[/\\]{2})/iu.test(rawTarget)
  ) {
    return BIRDCODER_AUTH_SURFACE_LOGIN_PATH;
  }

  const normalizedTarget = normalizeBirdCoderAuthSurfacePath(rawTarget);
  if (!normalizedTarget || isBirdCoderAuthSurfacePath(normalizedTarget)) {
    return BIRDCODER_AUTH_SURFACE_LOGIN_PATH;
  }

  return `${BIRDCODER_AUTH_SURFACE_LOGIN_PATH}?redirect=${encodeURIComponent(normalizedTarget)}`;
}
