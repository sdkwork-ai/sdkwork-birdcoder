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
} from '@sdkwork/birdcoder-pc-contracts-commons';
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
  const initialSessionLoadCompletedRef = useRef(false);

  const refreshCurrentUser = useCallback(async () => {
    const refreshAuthMutationVersion = authMutationVersionRef.current;
    try {
      if (!(await authService.hasStoredSession())) {
        if (authMutationVersionRef.current === refreshAuthMutationVersion) {
          setUser(null);
        }
        return null;
      }
      const currentUser = await authService.getCurrentUser();
      if (authMutationVersionRef.current !== refreshAuthMutationVersion) {
        return null;
      }

      setUser(currentUser);
      return currentUser;
    } catch (error) {
      throw error;
    }
  }, [authService]);

  useEffect(() => {
    let isMounted = true;
    let loadingInProgress = false;
    let reloadRequested = false;
    let scheduledReload: ReturnType<typeof setTimeout> | null = null;

    function scheduleCurrentUserLoad(): void {
      if (scheduledReload !== null) {
        clearTimeout(scheduledReload);
      }

      // Session commits update token/context storage in more than one step.
      // Defer the read to the next task so all synchronous commit listeners
      // finish and multiple change events collapse into one validation.
      scheduledReload = setTimeout(() => {
        scheduledReload = null;
        void loadCurrentUser();
      }, 0);
    }

    async function loadCurrentUser() {
      if (loadingInProgress) {
        reloadRequested = true;
        return;
      }

      loadingInProgress = true;
      const currentAuthMutationVersion = authMutationVersionRef.current;
      if (!initialSessionLoadCompletedRef.current) {
        setIsLoading(true);
      }
      try {
        if (!(await authService.hasStoredSession())) {
          if (!isMounted || authMutationVersionRef.current !== currentAuthMutationVersion) {
            return;
          }
          setUser(null);
          return;
        }
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
      } finally {
        loadingInProgress = false;
        if (isMounted && authMutationVersionRef.current === currentAuthMutationVersion) {
          initialSessionLoadCompletedRef.current = true;
          setIsLoading(false);
        }
        if (isMounted && reloadRequested) {
          reloadRequested = false;
          scheduleCurrentUserLoad();
        }
      }
    }

    void loadCurrentUser();

    const handleAppSessionChange = () => {
      // Invalidate any load that started under the previous token pair before
      // scheduling the post-commit read.
      authMutationVersionRef.current += 1;
      scheduleCurrentUserLoad();
    };
    globalThis.addEventListener?.('sdkwork:birdcoder:app-session-change', handleAppSessionChange);

    return () => {
      isMounted = false;
      if (scheduledReload !== null) {
        clearTimeout(scheduledReload);
        scheduledReload = null;
      }
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
