import 'package:sdkwork_birdcoder_app_sdk/app_client.dart';

const _appApiPrefix = '/app/v3/api';

typedef SdkTokenProvider = String? Function();

class BirdCoderAppSdkConsumer {
  BirdCoderAppSdkConsumer({
    required this.apiBaseUrl,
    this.authToken,
    this.accessToken,
    this.authTokenProvider,
    this.accessTokenProvider,
  });

  static const bool pendingGeneratedSdk = false;
  static const String consumerAssemblyPath =
      'apps/sdkwork-birdcoder-flutter-mobile/sdks/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer';
  static const String canonicalOpenApiAuthority = 'sdkwork-birdcoder-app-api';

  final String apiBaseUrl;
  final String? authToken;
  final String? accessToken;
  final SdkTokenProvider? authTokenProvider;
  final SdkTokenProvider? accessTokenProvider;

  SdkworkAppClient createClient() {
    return SdkworkAppClient.withBaseUrl(
      baseUrl: resolveBirdCoderAppSdkBaseUrl(apiBaseUrl),
      authToken: authTokenProvider == null ? authToken : authTokenProvider!(),
      accessToken:
          accessTokenProvider == null ? accessToken : accessTokenProvider!(),
    );
  }
}

String resolveBirdCoderAppSdkBaseUrl(String configuredApiBaseUrl) {
  final trimmed = configuredApiBaseUrl.trim();
  if (trimmed.endsWith(_appApiPrefix)) {
    return trimmed.substring(0, trimmed.length - _appApiPrefix.length);
  }
  return trimmed;
}

BirdCoderAppSdkConsumer createBirdCoderAppSdkConsumer({
  required String apiBaseUrl,
  String? authToken,
  String? accessToken,
  SdkTokenProvider? authTokenProvider,
  SdkTokenProvider? accessTokenProvider,
}) {
  return BirdCoderAppSdkConsumer(
    apiBaseUrl: apiBaseUrl,
    authToken: authToken,
    accessToken: accessToken,
    authTokenProvider: authTokenProvider,
    accessTokenProvider: accessTokenProvider,
  );
}
