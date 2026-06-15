library sdkwork_birdcoder_flutter_mobile_console_core;

const String kFlutterMobileConsoleCoreVersion = '0.1.0';

class ConsoleConfig {
  final String apiBaseUrl;
  final String tenantId;

  const ConsoleConfig({
    required this.apiBaseUrl,
    required this.tenantId,
  });

  static ConsoleConfig defaultConfig() {
    return const ConsoleConfig(
      apiBaseUrl: 'http://localhost:3000',
      tenantId: '',
    );
  }
}
