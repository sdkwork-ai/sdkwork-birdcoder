import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SdkworkIamH5AuthLoginScreen } from '@sdkwork/iam-h5-auth';
import { AuthLoadingState } from './AuthLoadingState.tsx';
import { useBirdCoderH5Auth } from './BirdCoderH5AuthContext.tsx';

const DEFAULT_AUTHENTICATED_ROUTE = '/';

function resolveRedirectTarget(search: string): string {
  const requestedTarget = new URLSearchParams(search).get('redirect')?.trim();
  if (!requestedTarget || !requestedTarget.startsWith('/') || requestedTarget.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }

  const target = new URL(requestedTarget, 'https://sdkwork.local');
  if (target.pathname === '/auth' || target.pathname.startsWith('/auth/')) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

export function BirdCoderH5AuthLoginRoute() {
  const location = useLocation();
  const {
    authenticated,
    completeAuthentication,
    controller,
    errorMessage,
    refreshCurrentSession,
    validating,
  } = useBirdCoderH5Auth();
  const [validatedLocationKey, setValidatedLocationKey] = useState<string | null>(location.key);

  useEffect(() => {
    if (validatedLocationKey === location.key) {
      return;
    }

    let active = true;
    void refreshCurrentSession().finally(() => {
      if (active) {
        setValidatedLocationKey(location.key);
      }
    });
    return () => {
      active = false;
    };
  }, [location.key, refreshCurrentSession, validatedLocationKey]);

  if (validating || validatedLocationKey !== location.key) {
    return <AuthLoadingState />;
  }

  if (authenticated) {
    return <Navigate replace to={resolveRedirectTarget(location.search)} />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      {errorMessage ? (
        <p className="mx-auto mb-4 w-full max-w-md text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <SdkworkIamH5AuthLoginScreen
        controller={controller}
        onAuthenticated={() => {
          void completeAuthentication();
        }}
        title="Sign in to BirdCoder"
      />
    </main>
  );
}
