import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@sdkwork/birdcoder-pc-workbench/context/AuthContext';
import {
  AUTH_SURFACE_DEFAULT_ROUTE,
  replaceAuthSurfaceHashPath,
} from '@sdkwork/birdcoder-pc-auth/authSurface';

interface BirdCoderH5ProtectedRouteProps {
  children: ReactNode;
  required?: boolean;
}

function AuthGateLoadingState() {
  return (
    <div className="flex h-full min-h-48 items-center justify-center px-6">
      <div className="text-sm text-muted-foreground">Validating SDKWork session…</div>
    </div>
  );
}

export function BirdCoderH5ProtectedRoute({
  children,
  required = true,
}: BirdCoderH5ProtectedRouteProps) {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || user || !required) {
      return;
    }

    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    replaceAuthSurfaceHashPath(
      `${AUTH_SURFACE_DEFAULT_ROUTE}?returnTo=${encodeURIComponent(returnTo)}`,
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [isLoading, location.hash, location.pathname, location.search, required, user]);

  if (isLoading) {
    return <AuthGateLoadingState />;
  }

  if (required && !user) {
    return <AuthGateLoadingState />;
  }

  return children;
}
