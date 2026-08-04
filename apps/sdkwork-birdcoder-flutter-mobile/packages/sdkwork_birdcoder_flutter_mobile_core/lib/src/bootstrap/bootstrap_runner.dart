import 'package:flutter/foundation.dart';

import 'bootstrap_api_ready.dart';
import 'bootstrap_state.dart';
import 'auth_route_catalog.dart';
import 'bootstrap_server_base_url.dart';
import 'environment.dart';
import 'iam_auth_service.dart';
import 'iam_runtime.dart';
import 'sdk_clients.dart';
import 'token_manager.dart';

Future<BirdCoderFlutterBootstrapState> bootstrapBirdCoderFlutterShell({
  String? credentialEntryBootstrapAccessToken,
  String? storedApiBaseUrl,
}) async {
  final environment = BirdCoderFlutterEnvironment.resolve();
  final apiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl(
    configuredApiBaseUrl: environment.configuredApiBaseUrl,
    storedApiBaseUrl: storedApiBaseUrl,
  );
  if (apiBaseUrl == null) {
    if (environment.isProduction) {
      throw StateError(
        'BirdCoderFlutter bootstrap: no API base URL configured in '
        'production; set SDKWORK_BIRDCODER_API_BASE_URL or provide a '
        'stored runtime base URL before bootstrapping.',
      );
    }
    // Development fallback only: never reach production with an
    // unconfigured endpoint that silently targets a local host.
    const developmentBaseUrl = 'http://localhost:3000';
    debugPrint(
      'BirdCoderFlutter bootstrap: no API base URL configured; '
      'development fallback $developmentBaseUrl',
    );
    return _bootstrapWithBaseUrl(
      apiBaseUrl: developmentBaseUrl,
      environment: environment,
      credentialEntryBootstrapAccessToken: credentialEntryBootstrapAccessToken,
    );
  }

  return _bootstrapWithBaseUrl(
    apiBaseUrl: apiBaseUrl,
    environment: environment,
    credentialEntryBootstrapAccessToken: credentialEntryBootstrapAccessToken,
  );
}

Future<BirdCoderFlutterBootstrapState> _bootstrapWithBaseUrl({
  required String apiBaseUrl,
  required BirdCoderFlutterEnvironment environment,
  String? credentialEntryBootstrapAccessToken,
}) async {
  await waitForBirdCoderApiReady(apiBaseUrl);

  final tokenManager = getBirdCoderGlobalTokenManager();
  final sdkClients = createBirdCoderFlutterSdkClients(
    apiBaseUrl: apiBaseUrl,
    credentialEntryBootstrapAccessToken: credentialEntryBootstrapAccessToken,
    tokenManager: tokenManager,
  );
  final iamRuntime = createBirdCoderIamRuntime(sdkClients: sdkClients);
  final iamAuthService = BirdCoderIamAuthService(sdkClients: sdkClients);
  await iamRuntime.bootstrap();
  final routes = createBirdCoderRouteCatalog();

  return BirdCoderFlutterBootstrapState(
    environment: environment,
    apiBaseUrl: apiBaseUrl,
    iamRuntime: iamRuntime,
    iamAuthService: iamAuthService,
    sdkClients: sdkClients,
    routes: routes,
  );
}
