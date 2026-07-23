import {
  buildBirdCoderProtectedLoginPath,
  isBirdCoderAuthSurfacePath,
  normalizeBirdCoderAuthSurfacePath,
} from '@sdkwork/birdcoder-pc-contracts-commons/authSurfacePaths';

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
