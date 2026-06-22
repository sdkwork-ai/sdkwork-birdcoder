const AUTH_SURFACE_BASE_PATH = '/auth';

function normalizeAuthSurfaceLocationPath(rawPath: string | null | undefined): string {
  const normalizedPath = (rawPath || '').trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

function isAuthSurfaceLocationPath(path: string): boolean {
  return path === AUTH_SURFACE_BASE_PATH || path.startsWith(`${AUTH_SURFACE_BASE_PATH}/`);
}

function readAuthSurfaceHashPath(): string {
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
