library sdkwork_birdcoder_flutter_mobile_shell;

const String kFlutterMobileShellVersion = '0.1.0';

class ShellConfig {
  final String title;
  final String theme;

  const ShellConfig({
    required this.title,
    required this.theme,
  });

  static ShellConfig defaultConfig() {
    return const ShellConfig(
      title: 'SDKWork BirdCoder',
      theme: 'system',
    );
  }
}
