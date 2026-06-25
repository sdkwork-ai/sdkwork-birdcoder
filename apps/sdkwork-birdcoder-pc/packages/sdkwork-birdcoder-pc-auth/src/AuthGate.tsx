import { Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@sdkwork/birdcoder-pc-commons';
import {
  buildProtectedRouteLoginPath,
  requiresAuthenticatedProductAccess,
} from './authAccessPolicy.ts';
import {
  AUTH_SURFACE_DEFAULT_ROUTE,
  isAuthSurfaceLocationPath,
  normalizeAuthSurfaceLocationPath,
  readAuthSurfaceHashPath,
  replaceAuthSurfaceHashPath,
  shouldBootIntoAuthSurface,
} from './authSurface.ts';
import { AuthShell } from './AuthShell.tsx';
import { loadAuthPage, type LoadBirdCoderAuthPageOptions } from './pageLoaders.ts';

interface AuthGateProps {
  children: ReactNode;
  getRuntime: LoadBirdCoderAuthPageOptions['getRuntime'];
}

function AuthGateLoadingState() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] px-6 text-white">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 shadow-lg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
        <div className="text-sm text-gray-300">{t('auth.validatingSession')}</div>
      </div>
    </div>
  );
}

function readCurrentProtectedRouteTarget(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const hashPath = readAuthSurfaceHashPath();
  if (hashPath && !isAuthSurfaceLocationPath(hashPath)) {
    return hashPath;
  }

  const pathname = normalizeAuthSurfaceLocationPath(window.location.pathname);
  if (pathname && !isAuthSurfaceLocationPath(pathname)) {
    return `${pathname}${window.location.search}`;
  }

  return '';
}

function AuthGateAuthSurface({ getRuntime }: Pick<AuthGateProps, 'getRuntime'>) {
  const LazyAuthPage = useMemo(
    () => lazy(() => loadAuthPage({ getRuntime })),
    [getRuntime],
  );

  return (
    <AuthShell>
      <Suspense fallback={<AuthGateLoadingState />}>
        <LazyAuthPage />
      </Suspense>
    </AuthShell>
  );
}

export function AuthGate({ children, getRuntime }: AuthGateProps) {
  const { isLoading, user } = useAuth();
  const onAuthSurface = shouldBootIntoAuthSurface();
  const productAccessRequiresAuth = requiresAuthenticatedProductAccess();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || !user || !onAuthSurface) {
      return;
    }

    replaceAuthSurfaceHashPath(null);
  }, [isLoading, onAuthSurface, user]);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || isLoading
      || user
      || !productAccessRequiresAuth
      || onAuthSurface
    ) {
      return;
    }

    const loginPath = buildProtectedRouteLoginPath(readCurrentProtectedRouteTarget());
    replaceAuthSurfaceHashPath(loginPath);
  }, [isLoading, onAuthSurface, productAccessRequiresAuth, user]);

  if (isLoading) {
    return <AuthGateLoadingState />;
  }

  if (!user && (onAuthSurface || productAccessRequiresAuth)) {
    return <AuthGateAuthSurface getRuntime={getRuntime} />;
  }

  if (user && onAuthSurface) {
    return <AuthGateLoadingState />;
  }

  return <>{children}</>;
}
