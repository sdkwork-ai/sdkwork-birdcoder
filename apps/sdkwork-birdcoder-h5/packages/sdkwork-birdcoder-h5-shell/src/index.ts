export const H5_SHELL_VERSION = '0.1.0';

export interface H5ShellConfig {
  title: string;
  theme: 'light' | 'dark' | 'system';
}

export function createDefaultShellConfig(): H5ShellConfig {
  return {
    title: 'SDKWork BirdCoder',
    theme: 'system',
  };
}

export { BootstrapGate, type BootstrapGateProps } from './bootstrap/BootstrapGate.ts';
export { createBirdCoderH5BootstrapRuntime } from './bootstrap/createBootstrapRuntime.ts';
export { ShellRuntimeProviders } from './providers/ShellRuntimeProviders.ts';
export { BirdCoderAuthGate } from './auth/BirdCoderAuthGate.tsx';
export { MobileShellLayout } from './layout/MobileShellLayout.tsx';
export { BirdCoderH5AppRoutes } from './routing/BirdCoderH5AppRoutes.tsx';
export { createBirdCoderH5AppRouter } from './routing/createBirdCoderH5AppRouter.tsx';
export { resolveBirdCoderH5TabRoutes } from './navigation/tabNavigation.ts';
export {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  createBirdCoderH5RouteCatalog,
  type BirdCoderH5RouteDefinition,
} from './routes/routeCatalog.ts';
