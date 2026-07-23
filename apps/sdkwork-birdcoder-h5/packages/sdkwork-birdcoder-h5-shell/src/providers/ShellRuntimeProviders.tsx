import type { PropsWithChildren } from 'react';
import { BirdCoderH5AuthProvider } from '../auth/BirdCoderH5AuthContext.tsx';

export function ShellRuntimeProviders({ children }: PropsWithChildren) {
  return <BirdCoderH5AuthProvider>{children}</BirdCoderH5AuthProvider>;
}
