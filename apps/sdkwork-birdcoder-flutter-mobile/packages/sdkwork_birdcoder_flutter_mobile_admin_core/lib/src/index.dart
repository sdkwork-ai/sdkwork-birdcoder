library sdkwork_birdcoder_flutter_mobile_admin_core;

export 'sdk/backend_sdk_client.dart';

const String kFlutterMobileAdminCoreVersion = '0.1.0';

class AdminConfig {
  final String apiBaseUrl;
  final String operatorId;

  const AdminConfig({
    required this.apiBaseUrl,
    required this.operatorId,
  });

  static AdminConfig defaultConfig() {
    return const AdminConfig(
      apiBaseUrl: 'http://localhost:3000',
      operatorId: '',
    );
  }
}
