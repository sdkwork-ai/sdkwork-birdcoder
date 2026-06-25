export const BIRDCODER_AUTH_SURFACE_BASE_PATH = '/auth';
export const BIRDCODER_AUTH_SURFACE_LOGIN_PATH = `${BIRDCODER_AUTH_SURFACE_BASE_PATH}/login`;

export function buildBirdCoderProtectedLoginPath(redirectTarget?: string | null): string {
  const normalizedTarget = (redirectTarget ?? '').trim();
  if (!normalizedTarget || normalizedTarget.startsWith(BIRDCODER_AUTH_SURFACE_BASE_PATH)) {
    return BIRDCODER_AUTH_SURFACE_LOGIN_PATH;
  }

  return `${BIRDCODER_AUTH_SURFACE_LOGIN_PATH}?redirect=${encodeURIComponent(normalizedTarget)}`;
}

export function normalizeBirdCoderAuthSurfacePath(rawPath: string | null | undefined): string {
  const normalizedPath = (rawPath ?? '').trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

export function isBirdCoderAuthSurfacePath(path: string): boolean {
  const normalizedPath = normalizeBirdCoderAuthSurfacePath(path);
  return (
    normalizedPath === BIRDCODER_AUTH_SURFACE_BASE_PATH
    || normalizedPath.startsWith(`${BIRDCODER_AUTH_SURFACE_BASE_PATH}/`)
  );
}

export function readBrowserAuthRedirectTarget(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function buildBirdCoderProtectedLoginBrowserUrl(redirectTarget?: string | null): string {
  const loginPath = buildBirdCoderProtectedLoginPath(
    redirectTarget ?? readBrowserAuthRedirectTarget(),
  );
  if (typeof window === 'undefined') {
    return loginPath;
  }

  const baseUrl = `${window.location.pathname}${window.location.search}`;
  return `${baseUrl}#${loginPath}`;
}

export function redirectBrowserToBirdCoderProtectedLogin(redirectTarget?: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const pathname = normalizeBirdCoderAuthSurfacePath(window.location.pathname);
  const hashPath = normalizeBirdCoderAuthSurfacePath(
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash,
  );
  if (isBirdCoderAuthSurfacePath(pathname) || isBirdCoderAuthSurfacePath(hashPath)) {
    return;
  }

  const nextUrl = buildBirdCoderProtectedLoginBrowserUrl(
    redirectTarget ?? readBrowserAuthRedirectTarget(),
  );
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === nextUrl) {
    return;
  }

  window.location.replace(nextUrl);
}
