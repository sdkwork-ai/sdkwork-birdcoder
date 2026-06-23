import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

class AppProvider extends InheritedWidget {
  final BirdCoderFlutterBootstrapState bootstrapState;

  const AppProvider({
    super.key,
    required this.bootstrapState,
    required super.child,
  });

  String get apiBaseUrl => bootstrapState.apiBaseUrl;
  String get deploymentProfile => bootstrapState.environment.deploymentProfile;
  BirdCoderIamRuntime get iamRuntime => bootstrapState.iamRuntime;
  BirdCoderFlutterSdkClients get sdkClients => bootstrapState.sdkClients;
  List<BirdCoderRouteDefinition> get routes => bootstrapState.routes;

  static AppProvider of(BuildContext context) {
    final provider = context.dependOnInheritedWidgetOfExactType<AppProvider>();
    assert(provider != null, 'No AppProvider found in context');
    return provider!;
  }

  @override
  bool updateShouldNotify(AppProvider oldWidget) {
    return bootstrapState.apiBaseUrl != oldWidget.bootstrapState.apiBaseUrl;
  }
}
