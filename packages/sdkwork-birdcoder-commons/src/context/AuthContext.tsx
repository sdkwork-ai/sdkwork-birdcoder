import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { User } from '@sdkwork/birdcoder-types';
import { useIDEServices } from './IDEContext';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (email: string, password?: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authService } = useIDEServices();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to get current user", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    checkAuth();
    return () => { isMounted = false; };
  }, [authService]);

  const login = useCallback(async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const register = useCallback(async (email: string, password?: string, name?: string) => {
    setIsLoading(true);
    try {
      const newUser = await authService.register(email, password, name);
      setUser(newUser);
      return newUser;
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
