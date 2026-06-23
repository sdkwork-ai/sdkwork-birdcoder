import 'package:sdkwork_birdcoder_flutter_mobile_app_sdk_consumer/sdkwork_birdcoder_flutter_mobile_app_sdk_consumer.dart';

import 'token_manager.dart';

class BirdCoderFlutterSdkClients {
  BirdCoderFlutterSdkClients({
    required this.apiBaseUrl,
    required this.appSdkConsumer,
  });

  final String apiBaseUrl;
  final BirdCoderAppSdkConsumer appSdkConsumer;

  bool get pendingGeneratedSdk => BirdCoderAppSdkConsumer.pendingGeneratedSdk;

  SdkworkAppClient get appSdk => appSdkConsumer.createClient();
}

BirdCoderFlutterSdkClients createBirdCoderFlutterSdkClients({
  required String apiBaseUrl,
  BirdCoderTokenManager? tokenManager,
}) {
  final tokens = tokenManager ?? getBirdCoderGlobalTokenManager();
  return BirdCoderFlutterSdkClients(
    apiBaseUrl: apiBaseUrl,
    appSdkConsumer: createBirdCoderAppSdkConsumer(
      apiBaseUrl: apiBaseUrl,
      authToken: tokens.authToken ?? tokens.accessToken,
      accessToken: tokens.accessToken,
    ),
  );
}
