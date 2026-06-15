import { createElement, type ComponentType } from 'react';
import type { AuthPageProps } from './pages/AuthPage.tsx';

export interface LoadBirdCoderAuthPageOptions {
  getRuntime: AuthPageProps['getRuntime'];
}

export type BirdCoderBoundAuthPageProps = Omit<AuthPageProps, 'getRuntime'>;

export async function loadAuthPage(
  options: LoadBirdCoderAuthPageOptions,
): Promise<{ default: ComponentType<BirdCoderBoundAuthPageProps> }> {
  const module = await import('./pages/AuthPage.tsx');
  const BirdCoderBoundAuthPage = (props: BirdCoderBoundAuthPageProps) =>
    createElement(module.AuthPage, { ...props, getRuntime: options.getRuntime });

  return { default: BirdCoderBoundAuthPage };
}
