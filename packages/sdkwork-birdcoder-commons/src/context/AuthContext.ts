import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import {
  syncBirdCoderRuntimeUserCenterBindingFromMetadata,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import type {
  IAuthService,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import type {
  BirdCoderUserCenterLoginRequest,
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterRegisterRequest,
  BirdCoderUserCenterSessionExchangeRequest,
  User,
} from '@sdkwork/birdcoder-types';
import {
  resolveFallbackAwareCurrentUser,
} from './authUserIdentity.ts';
import { useIDEServices } from './IDEContext.ts';

interface AuthContextType {
  adoptAuthenticatedUser: (authenticatedUser: User) => Promise<User | null>;
  authConfig: BirdCoderUserCenterMetadataSummary | null;
  exchangeUserCenterSession: (
    request: BirdCoderUserCenterSessionExchangeRequest,
  ) => Promise<User>;
  isLoading: boolean;
  login: (
    request: BirdCoderUserCenterLoginRequest | string,
    password?: string,
  ) => Promise<User>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<User | null>;
  refreshAuthenticatedUserFromRuntime: () => Promise<User | null>;
  register: (
    request: BirdCoderUserCenterRegisterRequest | string,
    password?: string,
    name?: string,
  ) => Promise<User>;
  signInWithEmailCode: NonNullable<IAuthService['signInWithEmailCode']>;
  signInWithOAuth: NonNullable<IAuthService['signInWithOAuth']>;
  signInWithPhoneCode: NonNullable<IAuthService['signInWithPhoneCode']>;
  user: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { authService } = useIDEServices();
  const [authConfig, setAuthConfig] = useState<BirdCoderUserCenterMetadataSummary | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authMutationVersionRef = useRef(0);

  const refreshCurrentUserWithFallback = useCallback(async (fallbackUser?: User) => {
    const refreshAuthMutationVersion = authMutationVersionRef.current;
    try {
      const currentUser = await authService.getCurrentUser();
      if (authMutationVersionRef.current !== refreshAuthMutationVersion) {
        return null;
      }

      const resolvedCurrentUser = resolveFallbackAwareCurrentUser(currentUser, fallbackUser);
      setUser(resolvedCurrentUser);
      return resolvedCurrentUser;
    } catch (error) {
      if (authMutationVersionRef.current !== refreshAuthMutationVersion) {
        return null;
      }

      if (fallbackUser) {
        setUser(fallbackUser);
        return fallbackUser;
      }

      throw error;
    }
  }, [authService]);

  const refreshCurrentUser = useCallback(async () => {
    return refreshCurrentUserWithFallback();
  }, [refreshCurrentUserWithFallback]);

  const runAuthenticatedUserMutation = useCallback(
    async (operation: () => Promise<User>) => {
      const authMutationVersion = authMutationVersionRef.current + 1;
      authMutationVersionRef.current = authMutationVersion;
      setIsLoading(true);

      try {
        const authenticatedUser = await operation();
        if (authMutationVersionRef.current !== authMutationVersion) {
          return authenticatedUser;
        }

        setUser(authenticatedUser);
        return authenticatedUser;
      } finally {
        if (authMutationVersionRef.current === authMutationVersion) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const refreshCurrentUserAfterAuthMutation = useCallback(
    async (fallbackUser?: User) => {
      const authMutationVersion = authMutationVersionRef.current + 1;
      authMutationVersionRef.current = authMutationVersion;
      setIsLoading(true);

      try {
        return await refreshCurrentUserWithFallback(fallbackUser);
      } finally {
        if (authMutationVersionRef.current === authMutationVersion) {
          setIsLoading(false);
        }
      }
    },
    [refreshCurrentUserWithFallback],
  );

  const adoptAuthenticatedUser = useCallback(
    async (authenticatedUser: User) => {
      return refreshCurrentUserAfterAuthMutation(authenticatedUser);
    },
    [refreshCurrentUserAfterAuthMutation],
  );

  const refreshAuthenticatedUserFromRuntime = useCallback(async () => {
    return refreshCurrentUserAfterAuthMutation();
  }, [refreshCurrentUserAfterAuthMutation]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    const initialAuthMutationVersion = authMutationVersionRef.current;

    const loadUserCenterConfig = async () => {
      try {
        const config = await (authService.getUserCenterConfig?.() ?? Promise.resolve(null));
        if (!isMounted) {
          return;
        }

        syncBirdCoderRuntimeUserCenterBindingFromMetadata(config);
        setAuthConfig(config);
        const configSyncAuthMutationVersion = authMutationVersionRef.current;
        try {
          const currentUserAfterConfigSync = await authService.getCurrentUser();
          if (
            !isMounted ||
            authMutationVersionRef.current !== configSyncAuthMutationVersion
          ) {
            return;
          }

          setUser((previousUser) =>
            resolveFallbackAwareCurrentUser(
              currentUserAfterConfigSync,
              previousUser ?? undefined,
            ));
        } catch (error) {
          if (
            !isMounted ||
            authMutationVersionRef.current !== configSyncAuthMutationVersion
          ) {
            return;
          }

          console.error('Failed to refresh current user after user center config sync', error);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load user center config', error);
        setAuthConfig(null);
      }
    };

    const loadCurrentUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!isMounted || authMutationVersionRef.current !== initialAuthMutationVersion) {
          return;
        }

        setUser(currentUser);
      } catch (error) {
        if (!isMounted || authMutationVersionRef.current !== initialAuthMutationVersion) {
          return;
        }

        console.error('Failed to get current user', error);
        setUser(null);
      } finally {
        if (isMounted && authMutationVersionRef.current === initialAuthMutationVersion) {
          setIsLoading(false);
        }
      }
    };

    void loadUserCenterConfig();
    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [authService]);

  const login = useCallback(
    async (request: BirdCoderUserCenterLoginRequest | string, password?: string) => {
      return runAuthenticatedUserMutation(() => authService.login(request, password));
    },
    [authService, runAuthenticatedUserMutation],
  );

  const register = useCallback(
    async (
      request: BirdCoderUserCenterRegisterRequest | string,
      password?: string,
      name?: string,
    ) => {
      return runAuthenticatedUserMutation(() => authService.register(request, password, name));
    },
    [authService, runAuthenticatedUserMutation],
  );

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

  const exchangeUserCenterSession = useCallback(
    async (request: BirdCoderUserCenterSessionExchangeRequest) => {
      if (!authService.exchangeUserCenterSession) {
        throw new Error('Current auth service does not support external user-center session exchange.');
      }

      return runAuthenticatedUserMutation(() => authService.exchangeUserCenterSession!(request));
    },
    [authService, runAuthenticatedUserMutation],
  );

  const signInWithEmailCode: NonNullable<IAuthService['signInWithEmailCode']> = useCallback(
    async (request) => {
      if (!authService.signInWithEmailCode) {
        throw new Error('Current auth service does not support email-code sign-in.');
      }

      return runAuthenticatedUserMutation(() => authService.signInWithEmailCode!(request));
    },
    [authService, runAuthenticatedUserMutation],
  );

  const signInWithOAuth: NonNullable<IAuthService['signInWithOAuth']> = useCallback(
    async (input) => {
      if (!authService.signInWithOAuth) {
        throw new Error('Current auth service does not support OAuth sign-in.');
      }

      return runAuthenticatedUserMutation(() => authService.signInWithOAuth!(input));
    },
    [authService, runAuthenticatedUserMutation],
  );

  const signInWithPhoneCode: NonNullable<IAuthService['signInWithPhoneCode']> = useCallback(
    async (request) => {
      if (!authService.signInWithPhoneCode) {
        throw new Error('Current auth service does not support phone-code sign-in.');
      }

      return runAuthenticatedUserMutation(() => authService.signInWithPhoneCode!(request));
    },
    [authService, runAuthenticatedUserMutation],
  );

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        adoptAuthenticatedUser,
        authConfig,
        exchangeUserCenterSession,
        user,
        isLoading,
        login,
        register,
        logout,
        refreshCurrentUser,
        refreshAuthenticatedUserFromRuntime,
        signInWithEmailCode,
        signInWithOAuth,
        signInWithPhoneCode,
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
