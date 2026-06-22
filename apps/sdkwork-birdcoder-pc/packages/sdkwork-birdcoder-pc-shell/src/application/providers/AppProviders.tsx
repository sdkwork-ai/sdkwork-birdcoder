import type { PropsWithChildren } from 'react';
import i18n from '@sdkwork/birdcoder-pc-i18n';
import { ThemeManager } from './ThemeManager';

export function AppProviders({ children }: PropsWithChildren) {
  void i18n;

  return (
    <>
      <ThemeManager />
      {children}
    </>
  );
}
