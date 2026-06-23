import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer/sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer.dart';

class BirdCoderFlutterBackendSdkClients {
  BirdCoderFlutterBackendSdkClients({
    required this.apiBaseUrl,
    required this.backendSdkConsumer,
  });

  final String apiBaseUrl;
  final BirdCoderBackendSdkConsumer backendSdkConsumer;

  bool get pendingGeneratedSdk => BirdCoderBackendSdkConsumer.pendingGeneratedSdk;

  SdkworkBackendClient get backendSdk => backendSdkConsumer.createClient();
}

BirdCoderFlutterBackendSdkClients createBirdCoderFlutterBackendSdkClients({
  required String apiBaseUrl,
  BirdCoderTokenManager? tokenManager,
}) {
  final tokens = tokenManager ?? getBirdCoderGlobalTokenManager();
  return BirdCoderFlutterBackendSdkClients(
    apiBaseUrl: apiBaseUrl,
    backendSdkConsumer: createBirdCoderBackendSdkConsumer(
      apiBaseUrl: apiBaseUrl,
      authToken: tokens.authToken ?? tokens.accessToken,
      accessToken: tokens.accessToken,
    ),
  );
}
