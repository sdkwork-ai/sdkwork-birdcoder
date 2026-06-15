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
