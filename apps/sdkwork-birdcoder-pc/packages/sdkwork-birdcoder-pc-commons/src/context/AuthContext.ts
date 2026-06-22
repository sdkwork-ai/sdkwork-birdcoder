import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  User,
} from '@sdkwork/birdcoder-pc-types';
import {
  resolveFallbackAwareCurrentUser,
} from './authUserIdentity.ts';
import { useIDEServices } from './IDEContext.ts';

interface AuthContextType {
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<User | null>;
  user: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { authService } = useIDEServices();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authMutationVersionRef = useRef(0);

  const refreshCurrentUser = useCallback(async () => {
    const refreshAuthMutationVersion = authMutationVersionRef.current;
    try {
      const [currentUser, sessionPresent] = await Promise.all([
        authService.getCurrentUser(),
        authService.hasStoredSession(),
      ]);
      if (authMutationVersionRef.current !== refreshAuthMutationVersion) {
        return null;
      }

      setUser((previousUser) => {
        if (currentUser === null && !sessionPresent) {
          return null;
        }

        return resolveFallbackAwareCurrentUser(currentUser, previousUser ?? undefined);
      });
      return currentUser;
    } catch (error) {
      if (authMutationVersionRef.current === refreshAuthMutationVersion) {
        setUser(null);
      }
      throw error;
    }
  }, [authService]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const currentAuthMutationVersion = authMutationVersionRef.current;
      setIsLoading(true);
      try {
        const currentUser = await authService.getCurrentUser();
        if (!isMounted || authMutationVersionRef.current !== currentAuthMutationVersion) {
          return;
        }

        setUser(currentUser);
      } catch (error) {
        if (!isMounted || authMutationVersionRef.current !== currentAuthMutationVersion) {
          return;
        }

        console.error('Failed to get current user', error);
        setUser(null);
      } finally {
        if (isMounted && authMutationVersionRef.current === currentAuthMutationVersion) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    const handleAppSessionChange = () => {
      void loadCurrentUser();
    };
    globalThis.addEventListener?.('sdkwork:birdcoder:app-session-change', handleAppSessionChange);

    return () => {
      isMounted = false;
      globalThis.removeEventListener?.('sdkwork:birdcoder:app-session-change', handleAppSessionChange);
    };
  }, [authService]);

  const logout = useCallback(async () => {
    const authMutationVersion = authMutationVersionRef.current + 1;
    authMutationVersionRef.current = authMutationVersion;
    setIsLoading(true);

    try {
      await authService.logout();
      if (authMutationVersionRef.current === authMutationVersion) {
        setUser(null);
      }
    } finally {
      if (authMutationVersionRef.current === authMutationVersion) {
        setIsLoading(false);
      }
    }
  }, [authService]);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isLoading,
        logout,
        refreshCurrentUser,
      },
    },
    children,
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
