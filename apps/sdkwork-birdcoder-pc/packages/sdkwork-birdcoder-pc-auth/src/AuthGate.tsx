import { Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@sdkwork/birdcoder-pc-workbench/context/AuthContext';
import { StartupScreen } from '@sdkwork/birdcoder-pc-ui-shell';
import { buildBirdCoderProtectedLoginPath } from '@sdkwork/birdcoder-pc-contracts-commons/authSurfacePaths';
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
    <StartupScreen
      description={t('bootstrap.validatingSession')}
      progress={68}
      stage="session"
      stageLabels={{
        runtime: t('bootstrap.runtimeStage'),
        session: t('bootstrap.sessionStage'),
        workspace: t('bootstrap.workspaceStage'),
      }}
      title={t('bootstrap.startingTitle')}
    />
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
      || onAuthSurface
    ) {
      return;
    }

    const loginPath = buildBirdCoderProtectedLoginPath(readCurrentProtectedRouteTarget());
    replaceAuthSurfaceHashPath(loginPath);
  }, [isLoading, onAuthSurface, user]);

  if (isLoading) {
    return <AuthGateLoadingState />;
  }

  if (!user) {
    return <AuthGateAuthSurface getRuntime={getRuntime} />;
  }

  return <>{children}</>;
}
