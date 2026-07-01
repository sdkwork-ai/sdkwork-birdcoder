library sdkwork_birdcoder_flutter_mobile_core;

export 'bootstrap/auth_oauth_deep_link.dart';
export 'bootstrap/auth_route_catalog.dart';
export 'bootstrap/auth_deep_link.dart';
export 'bootstrap/bootstrap_api_ready.dart';
export 'bootstrap/bootstrap_runner.dart';
export 'bootstrap/bootstrap_server_base_url.dart';
export 'bootstrap/bootstrap_state.dart';
export 'bootstrap/environment.dart';
export 'bootstrap/iam_auth_service.dart';
export 'bootstrap/iam_runtime.dart';
export 'bootstrap/birdcoder_mobile_chat_api.dart';
export 'bootstrap/sdk_clients.dart';
export 'bootstrap/token_manager.dart' show
    BirdCoderTokenManager,
    getBirdCoderGlobalTokenManager,
    syncBirdCoderGlobalTokenManagerFromStorage;

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
