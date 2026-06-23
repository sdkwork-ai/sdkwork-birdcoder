import 'package:sdkwork_birdcoder_backend_sdk/backend_client.dart';

const _backendApiPrefix = '/backend/v3/api';

class BirdCoderBackendSdkConsumer {
  BirdCoderBackendSdkConsumer({
    required this.apiBaseUrl,
    this.authToken,
    this.accessToken,
  });

  static const bool pendingGeneratedSdk = false;
  static const String consumerAssemblyPath =
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer';
  static const String canonicalOpenApiAuthority = 'sdkwork-birdcoder-backend-api';

  final String apiBaseUrl;
  final String? authToken;
  final String? accessToken;

  SdkworkBackendClient createClient() {
    return SdkworkBackendClient.withBaseUrl(
      baseUrl: resolveBirdCoderBackendSdkBaseUrl(apiBaseUrl),
      authToken: authToken,
      accessToken: accessToken,
    );
  }
}

String resolveBirdCoderBackendSdkBaseUrl(String configuredApiBaseUrl) {
  final trimmed = configuredApiBaseUrl.trim();
  if (trimmed.endsWith(_backendApiPrefix)) {
    return trimmed.substring(0, trimmed.length - _backendApiPrefix.length);
  }
  return trimmed;
}

BirdCoderBackendSdkConsumer createBirdCoderBackendSdkConsumer({
  required String apiBaseUrl,
  String? authToken,
  String? accessToken,
}) {
  return BirdCoderBackendSdkConsumer(
    apiBaseUrl: apiBaseUrl,
    authToken: authToken,
    accessToken: accessToken,
  );
}
