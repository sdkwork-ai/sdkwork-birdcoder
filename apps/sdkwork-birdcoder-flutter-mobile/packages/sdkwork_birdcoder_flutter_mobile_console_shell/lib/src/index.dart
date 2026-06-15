library sdkwork_birdcoder_flutter_mobile_console_shell;

const String kFlutterMobileConsoleShellVersion = '0.1.0';

class ConsoleShellConfig {
  final String title;
  final List<ConsoleNavItem> navigationItems;

  const ConsoleShellConfig({
    required this.title,
    required this.navigationItems,
  });

  static ConsoleShellConfig defaultConfig() {
    return const ConsoleShellConfig(
      title: 'BirdCoder Console',
      navigationItems: [
        ConsoleNavItem(id: 'dashboard', label: 'Dashboard', path: '/console'),
        ConsoleNavItem(id: 'settings', label: 'Settings', path: '/console/settings'),
      ],
    );
  }
}

class ConsoleNavItem {
  final String id;
  final String label;
  final String path;

  const ConsoleNavItem({
    required this.id,
    required this.label,
    required this.path,
  });
}
