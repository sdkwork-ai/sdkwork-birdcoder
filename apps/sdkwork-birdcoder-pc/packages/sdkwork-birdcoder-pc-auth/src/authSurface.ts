import {
  BIRDCODER_AUTH_SURFACE_BASE_PATH,
  BIRDCODER_AUTH_SURFACE_LOGIN_PATH,
  isBirdCoderAuthSurfacePath,
  normalizeBirdCoderAuthSurfacePath,
} from '@sdkwork/birdcoder-pc-contracts-commons/authSurfacePaths';

export const AUTH_SURFACE_BASE_PATH = BIRDCODER_AUTH_SURFACE_BASE_PATH;
export const AUTH_SURFACE_DEFAULT_ROUTE = BIRDCODER_AUTH_SURFACE_LOGIN_PATH;
export const normalizeAuthSurfaceLocationPath = normalizeBirdCoderAuthSurfacePath;
export const isAuthSurfaceLocationPath = isBirdCoderAuthSurfacePath;

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
