export const PC_ADMIN_SHELL_VERSION = '0.1.0';

export interface AdminShellConfig {
  title: string;
  navigationItems: AdminNavItem[];
}

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  permission?: string;
}

export function createDefaultAdminShellConfig(): AdminShellConfig {
  return {
    title: 'BirdCoder Admin',
    navigationItems: [
      { id: 'dashboard', label: 'Dashboard', path: '/admin' },
      { id: 'users', label: 'Users', path: '/admin/users', permission: 'admin:users:read' },
      { id: 'audit', label: 'Audit Log', path: '/admin/audit', permission: 'admin:audit:read' },
    ],
  };
}
