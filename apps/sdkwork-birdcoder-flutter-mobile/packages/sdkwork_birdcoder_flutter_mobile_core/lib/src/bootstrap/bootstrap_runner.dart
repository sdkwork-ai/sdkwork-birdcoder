import 'bootstrap_api_ready.dart';
import 'bootstrap_state.dart';
import 'auth_route_catalog.dart';
import 'bootstrap_server_base_url.dart';
import 'environment.dart';
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

  final iamRuntime = createBirdCoderIamRuntime(apiBaseUrl: apiBaseUrl);
  await iamRuntime.bootstrap();

  final tokenManager = getBirdCoderGlobalTokenManager();
  final sdkClients = createBirdCoderFlutterSdkClients(
    apiBaseUrl: apiBaseUrl,
    tokenManager: tokenManager,
  );
  final routes = createBirdCoderRouteCatalog();

  return BirdCoderFlutterBootstrapState(
    environment: environment,
    apiBaseUrl: apiBaseUrl,
    iamRuntime: iamRuntime,
    sdkClients: sdkClients,
    routes: routes,
  );
}
