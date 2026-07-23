import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

typedef IamRuntime = BirdCoderIamRuntime;

BirdCoderIamRuntime createIamRuntime({
  required BirdCoderFlutterSdkClients sdkClients,
}) =>
    createBirdCoderIamRuntime(sdkClients: sdkClients);
