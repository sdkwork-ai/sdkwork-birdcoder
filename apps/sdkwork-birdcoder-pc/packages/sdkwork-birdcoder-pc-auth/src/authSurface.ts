export const AUTH_SURFACE_BASE_PATH = '/auth';
export const AUTH_SURFACE_DEFAULT_ROUTE = `${AUTH_SURFACE_BASE_PATH}/login`;

export function normalizeAuthSurfaceLocationPath(rawPath: string | null | undefined): string {
  const normalizedPath = (rawPath || '').trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

export function isAuthSurfaceLocationPath(path: string): boolean {
  return path === AUTH_SURFACE_BASE_PATH || path.startsWith(`${AUTH_SURFACE_BASE_PATH}/`);
}

export function readAuthSurfaceHashPath(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeAuthSurfaceLocationPath(
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash,
  );
}

export function shouldBootIntoAuthSurface(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = normalizeAuthSurfaceLocationPath(window.location.pathname);
  if (isAuthSurfaceLocationPath(pathname)) {
    return true;
  }

  return isAuthSurfaceLocationPath(readAuthSurfaceHashPath());
}

export function replaceAuthSurfaceHashPath(path: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = normalizeAuthSurfaceLocationPath(path);
  const baseUrl = `${window.location.pathname}${window.location.search}`;
  const nextUrl = normalizedPath ? `${baseUrl}#${normalizedPath}` : baseUrl;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === nextUrl) {
    return;
  }

  window.history.replaceState(window.history.state, '', nextUrl);
}
