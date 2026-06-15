library sdkwork_birdcoder_flutter_mobile_admin_shell;

const String kFlutterMobileAdminShellVersion = '0.1.0';

class AdminShellConfig {
  final String title;
  final List<AdminNavItem> navigationItems;

  const AdminShellConfig({
    required this.title,
    required this.navigationItems,
  });

  static AdminShellConfig defaultConfig() {
    return const AdminShellConfig(
      title: 'BirdCoder Admin',
      navigationItems: [
        AdminNavItem(id: 'dashboard', label: 'Dashboard', path: '/admin'),
        AdminNavItem(id: 'users', label: 'Users', path: '/admin/users', permission: 'admin:users:read'),
        AdminNavItem(id: 'audit', label: 'Audit Log', path: '/admin/audit', permission: 'admin:audit:read'),
      ],
    );
  }
}

class AdminNavItem {
  final String id;
  final String label;
  final String path;
  final String? permission;

  const AdminNavItem({
    required this.id,
    required this.label,
    required this.path,
    this.permission,
  });
}
