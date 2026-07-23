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
  String? storedApiBaseUrl,
}) async {
  final environment = BirdCoderFlutterEnvironment.resolve();
  final apiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl(
        configuredApiBaseUrl: environment.configuredApiBaseUrl,
        storedApiBaseUrl: storedApiBaseUrl,
      ) ??
      'http://localhost:3000';

  await waitForBirdCoderApiReady(apiBaseUrl);

  final tokenManager = getBirdCoderGlobalTokenManager();
  final sdkClients = createBirdCoderFlutterSdkClients(
    apiBaseUrl: apiBaseUrl,
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
