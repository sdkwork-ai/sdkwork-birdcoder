import type { ReactNode } from 'react';
import { AuthLoadingState } from './AuthLoadingState.tsx';
import { useBirdCoderH5Auth } from './BirdCoderH5AuthContext.tsx';

interface BirdCoderAuthGateProps {
  children: ReactNode;
}

export function BirdCoderAuthGate({ children }: BirdCoderAuthGateProps) {
  const { initialized } = useBirdCoderH5Auth();
  return initialized ? children : <AuthLoadingState />;
}
