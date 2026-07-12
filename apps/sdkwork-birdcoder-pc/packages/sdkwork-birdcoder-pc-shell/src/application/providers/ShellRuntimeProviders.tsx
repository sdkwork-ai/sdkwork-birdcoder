import type { PropsWithChildren } from 'react';
import { AuthProvider } from '@sdkwork/birdcoder-pc-commons/context/AuthContext';
import { IDEProvider } from '@sdkwork/birdcoder-pc-commons/context/IDEContext';
import { AuthStateBridge } from './AuthStateBridge';

export function ShellRuntimeProviders({ children }: PropsWithChildren) {
  return (
    <IDEProvider>
      <AuthProvider>
        <AuthStateBridge>{children}</AuthStateBridge>
      </AuthProvider>
    </IDEProvider>
  );
}
