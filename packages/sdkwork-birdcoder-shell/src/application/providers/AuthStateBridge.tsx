import type { PropsWithChildren } from 'react';

export interface AuthStateSnapshot {
  isAuthenticated: boolean;
  userId: string | null;
}

export function AuthStateBridge({ children }: PropsWithChildren) {
  return children;
}
