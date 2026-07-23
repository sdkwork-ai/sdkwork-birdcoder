import { type ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { IAM_H5_AUTH_ROUTES } from '@sdkwork/iam-h5-auth';
import { AuthLoadingState } from '../auth/AuthLoadingState.tsx';
import { useBirdCoderH5Auth } from '../auth/BirdCoderH5AuthContext.tsx';

interface BirdCoderH5ProtectedRouteProps {
  children: ReactNode;
  required?: boolean;
}

export function BirdCoderH5ProtectedRoute({
  children,
  required = true,
}: BirdCoderH5ProtectedRouteProps) {
  const { authenticated, refreshCurrentSession, validating } = useBirdCoderH5Auth();
  const location = useLocation();
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

  if (required && !authenticated) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    const loginTarget = `${IAM_H5_AUTH_ROUTES.loginPath}?redirect=${encodeURIComponent(redirect)}`;
    return <Navigate replace to={loginTarget} />;
  }

  return children;
}
