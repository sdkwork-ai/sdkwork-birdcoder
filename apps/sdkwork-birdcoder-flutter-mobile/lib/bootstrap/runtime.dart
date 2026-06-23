import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart'
    as core;

String resolveBirdCoderBootstrapServerBaseUrl({
  String? configuredApiBaseUrl,
  String? runtimeApiBaseUrl,
  String? storedApiBaseUrl,
}) {
  return core.resolveBirdCoderBootstrapServerBaseUrl(
        configuredApiBaseUrl: configuredApiBaseUrl,
        runtimeApiBaseUrl: runtimeApiBaseUrl,
        storedApiBaseUrl: storedApiBaseUrl,
      ) ??
      'http://localhost:3000';
}
