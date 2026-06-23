import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveBirdCoderH5Environment } from '@sdkwork/birdcoder-h5-core';

interface AppContextValue {
  apiBaseUrl: string;
  deploymentProfile: string;
  environment: string;
  runtimeTarget: string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const env = resolveBirdCoderH5Environment();
    return {
      apiBaseUrl: env.apiBaseUrl ?? '',
      deploymentProfile: env.deploymentProfile,
      environment: env.environment,
      runtimeTarget: env.runtimeTarget,
    };
  }, []);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
