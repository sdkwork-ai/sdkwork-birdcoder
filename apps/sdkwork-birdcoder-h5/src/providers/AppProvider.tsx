import { createContext, useContext, type ReactNode } from 'react';

interface AppContextValue {
  apiBaseUrl: string;
}

const AppContext = createContext<AppContextValue>({
  apiBaseUrl: 'http://localhost:3000',
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AppContext.Provider value={{ apiBaseUrl: 'http://localhost:3000' }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
