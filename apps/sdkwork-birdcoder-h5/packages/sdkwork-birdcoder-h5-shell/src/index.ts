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
