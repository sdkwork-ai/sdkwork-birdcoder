import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import type {
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterSessionExchangeRequest,
  User,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from './IDEContext.ts';

interface AuthContextType {
  authConfig: BirdCoderUserCenterMetadataSummary | null;
  exchangeUserCenterSession: (
    request: BirdCoderUserCenterSessionExchangeRequest,
  ) => Promise<User>;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (email: string, password?: string, name?: string) => Promise<User>;
  user: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { authService } = useIDEServices();
  const [authConfig, setAuthConfig] = useState<BirdCoderUserCenterMetadataSummary | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const [currentUser, nextAuthConfig] = await Promise.all([
          authService.getCurrentUser(),
          authService.getUserCenterConfig?.().catch((error) => {
            console.error('Failed to load user center config', error);
            return null;
          }) ?? Promise.resolve(null),
        ]);
        if (isMounted) {
          setAuthConfig(nextAuthConfig);
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Failed to get current user', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, [authService]);

  const login = useCallback(
    async (email: string, password?: string) => {
      setIsLoading(true);
      try {
        const loggedInUser = await authService.login(email, password);
        setUser(loggedInUser);
        return loggedInUser;
      } finally {
        setIsLoading(false);
      }
    },
    [authService],
  );

  const register = useCallback(
    async (email: string, password?: string, name?: string) => {
      setIsLoading(true);
      try {
        const newUser = await authService.register(email, password, name);
        setUser(newUser);
        return newUser;
      } finally {
        setIsLoading(false);
      }
    },
    [authService],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const exchangeUserCenterSession = useCallback(
    async (request: BirdCoderUserCenterSessionExchangeRequest) => {
      if (!authService.exchangeUserCenterSession) {
        throw new Error('Current auth service does not support external user-center session exchange.');
      }

      setIsLoading(true);
      try {
        const exchangedUser = await authService.exchangeUserCenterSession(request);
        setUser(exchangedUser);
        return exchangedUser;
      } finally {
        setIsLoading(false);
      }
    },
    [authService],
  );

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        authConfig,
        exchangeUserCenterSession,
        user,
        isLoading,
        login,
        register,
        logout,
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
