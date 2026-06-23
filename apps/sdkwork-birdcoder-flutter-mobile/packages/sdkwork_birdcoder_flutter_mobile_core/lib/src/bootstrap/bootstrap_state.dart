import 'auth_route_catalog.dart';
import 'environment.dart';
import 'iam_runtime.dart';
import 'sdk_clients.dart';

class BirdCoderFlutterBootstrapState {
  final BirdCoderFlutterEnvironment environment;
  final String apiBaseUrl;
  final BirdCoderIamRuntime iamRuntime;
  final BirdCoderFlutterSdkClients sdkClients;
  final List<BirdCoderRouteDefinition> routes;

  const BirdCoderFlutterBootstrapState({
    required this.environment,
    required this.apiBaseUrl,
    required this.iamRuntime,
    required this.sdkClients,
    required this.routes,
  });
}
