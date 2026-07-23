import 'auth_route_catalog.dart';
import 'environment.dart';
import 'iam_auth_service.dart';
import 'iam_runtime.dart';
import 'sdk_clients.dart';

class BirdCoderFlutterBootstrapState {
  final BirdCoderFlutterEnvironment environment;
  final String apiBaseUrl;
  final BirdCoderIamRuntime iamRuntime;
  final BirdCoderIamAuthService iamAuthService;
  final BirdCoderFlutterSdkClients sdkClients;
  final List<BirdCoderRouteDefinition> routes;

  const BirdCoderFlutterBootstrapState({
    required this.environment,
    required this.apiBaseUrl,
    required this.iamRuntime,
    required this.iamAuthService,
    required this.sdkClients,
    required this.routes,
  });
}
