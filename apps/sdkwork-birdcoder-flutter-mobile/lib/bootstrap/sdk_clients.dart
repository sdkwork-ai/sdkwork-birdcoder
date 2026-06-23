import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

typedef SdkClients = BirdCoderFlutterSdkClients;

BirdCoderFlutterSdkClients createSdkClients({required String apiBaseUrl}) {
  return createBirdCoderFlutterSdkClients(apiBaseUrl: apiBaseUrl);
}
