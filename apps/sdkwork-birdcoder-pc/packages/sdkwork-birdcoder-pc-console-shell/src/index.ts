export const PC_CONSOLE_SHELL_VERSION = '0.1.0';

export interface ConsoleShellConfig {
  title: string;
  navigationItems: ConsoleNavItem[];
}

export interface ConsoleNavItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
}

export function createDefaultConsoleShellConfig(): ConsoleShellConfig {
  return {
    title: 'BirdCoder Console',
    navigationItems: [
      { id: 'dashboard', label: 'Dashboard', path: '/console' },
      { id: 'settings', label: 'Settings', path: '/console/settings' },
    ],
  };
}
