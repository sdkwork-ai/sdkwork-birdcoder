import type { PropsWithChildren } from 'react';
import { AuthProvider, IDEProvider } from '@sdkwork/birdcoder-pc-commons';
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
