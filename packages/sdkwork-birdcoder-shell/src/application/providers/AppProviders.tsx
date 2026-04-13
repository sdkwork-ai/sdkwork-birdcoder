import type { PropsWithChildren } from 'react';
import i18n from '@sdkwork/birdcoder-i18n';
import { AuthStateBridge } from './AuthStateBridge';
import { ThemeManager } from './ThemeManager';

export function AppProviders({ children }: PropsWithChildren) {
  void i18n;

  return (
    <>
      <ThemeManager />
      <AuthStateBridge>{children}</AuthStateBridge>
    </>
  );
}
