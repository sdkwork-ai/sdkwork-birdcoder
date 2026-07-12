import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useAuth } from '@sdkwork/birdcoder-pc-commons/context/AuthContext';

export interface AuthStateSnapshot {
  isAuthenticated: boolean;
  userId: string | null;
}

const AuthStateBridgeContext = createContext<AuthStateSnapshot>({
  isAuthenticated: false,
  userId: null,
});

export function useAuthStateSnapshot(): AuthStateSnapshot {
  return useContext(AuthStateBridgeContext);
}

export function AuthStateBridge({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const snapshot = useMemo<AuthStateSnapshot>(
    () => ({
      isAuthenticated: Boolean(user),
      userId: user?.id ?? null,
    }),
    [user],
  );

  return (
    <AuthStateBridgeContext.Provider value={snapshot}>
      {children}
    </AuthStateBridgeContext.Provider>
  );
}
