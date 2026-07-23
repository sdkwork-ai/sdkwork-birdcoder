import 'package:sdkwork_agents_app_sdk/sdkwork_agents_app_sdk.dart'
    as agents_sdk;
import 'package:sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer.dart'
    as birdcoder_sdk;
import 'package:sdkwork_iam_app_sdk/sdkwork_iam_app_sdk.dart' as iam_sdk;

import 'token_manager.dart';

const String birdCoderAppApiPrefix = '/app/v3/api';

class BirdCoderFlutterSdkClients {
  BirdCoderFlutterSdkClients({
    required this.apiBaseUrl,
    required this.appSdkConsumer,
    required this.tokenManager,
  });

  final String apiBaseUrl;
  final birdcoder_sdk.BirdCoderAppSdkConsumer appSdkConsumer;
  final BirdCoderTokenManager tokenManager;

  bool get pendingGeneratedSdk =>
      birdcoder_sdk.BirdCoderAppSdkConsumer.pendingGeneratedSdk;

  birdcoder_sdk.SdkworkAppClient get appSdk => appSdkConsumer.createClient();

  String get appApiBaseUrl => normalizeBirdCoderAppApiBaseUrl(apiBaseUrl);

  agents_sdk.SdkworkAppClient get agentsSdk =>
      agents_sdk.SdkworkAppClient.withBaseUrl(
        baseUrl: resolveBirdCoderAppApiTransportBaseUrl(appApiBaseUrl),
        authToken: tokenManager.authToken,
        accessToken: tokenManager.accessToken,
      );

  iam_sdk.SdkworkAppClient get iamSdk => iam_sdk.SdkworkAppClient.withBaseUrl(
        baseUrl: resolveBirdCoderAppApiTransportBaseUrl(appApiBaseUrl),
        authToken: tokenManager.authToken,
        accessToken: tokenManager.accessToken,
      );

  iam_sdk.SdkworkAppClient get anonymousIamSdk =>
      iam_sdk.SdkworkAppClient.withBaseUrl(
        baseUrl: resolveBirdCoderAppApiTransportBaseUrl(appApiBaseUrl),
      );
}

BirdCoderFlutterSdkClients createBirdCoderFlutterSdkClients({
  required String apiBaseUrl,
  BirdCoderTokenManager? tokenManager,
}) {
  final tokens = tokenManager ?? getBirdCoderGlobalTokenManager();
  return BirdCoderFlutterSdkClients(
    apiBaseUrl: apiBaseUrl,
    appSdkConsumer: birdcoder_sdk.createBirdCoderAppSdkConsumer(
      apiBaseUrl: apiBaseUrl,
      authTokenProvider: () => tokens.authToken ?? tokens.accessToken,
      accessTokenProvider: () => tokens.accessToken,
    ),
    tokenManager: tokens,
  );
}

String normalizeBirdCoderAppApiBaseUrl(String value) {
  final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
  final surfaceUrl = normalized.endsWith(birdCoderAppApiPrefix)
      ? normalized
      : '$normalized$birdCoderAppApiPrefix';
  final uri = Uri.tryParse(surfaceUrl);
  if (uri == null ||
      !uri.hasScheme ||
      (uri.scheme != 'http' && uri.scheme != 'https') ||
      uri.host.isEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      !uri.path.endsWith(birdCoderAppApiPrefix)) {
    throw ArgumentError.value(
      value,
      'apiBaseUrl',
      'must resolve to an absolute HTTP(S) App API URL ending with '
          '$birdCoderAppApiPrefix',
    );
  }
  final prefixStart = uri.path.length - birdCoderAppApiPrefix.length;
  if (uri.path.substring(0, prefixStart).endsWith(birdCoderAppApiPrefix)) {
    throw ArgumentError.value(
      value,
      'apiBaseUrl',
      'must contain $birdCoderAppApiPrefix exactly once',
    );
  }
  return surfaceUrl;
}

String resolveBirdCoderAppApiTransportBaseUrl(String appApiBaseUrl) {
  final normalized = normalizeBirdCoderAppApiBaseUrl(appApiBaseUrl);
  final uri = Uri.parse(normalized);
  final transportPath = uri.path.substring(
    0,
    uri.path.length - birdCoderAppApiPrefix.length,
  );
  return uri
      .replace(path: transportPath)
      .toString()
      .replaceFirst(RegExp(r'/+$'), '');
}
