library sdkwork_birdcoder_flutter_mobile_core;

const String kFlutterMobileCoreVersion = '0.1.0';

class FlutterMobileCoreConfig {
  final String apiBaseUrl;
  final String appVersion;
  final String environment;

  const FlutterMobileCoreConfig({
    required this.apiBaseUrl,
    required this.appVersion,
    required this.environment,
  });

  static FlutterMobileCoreConfig defaultConfig() {
    return const FlutterMobileCoreConfig(
      apiBaseUrl: 'http://localhost:3000',
      appVersion: '0.1.0',
      environment: 'development',
    );
  }
}
