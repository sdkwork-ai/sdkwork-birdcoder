class SdkClients {
  final dynamic appSdk;
  final dynamic backendSdk;

  SdkClients({this.appSdk, this.backendSdk});

  static SdkClients create() {
    // SDK clients are constructed here per APP_SDK_INTEGRATION_SPEC.md
    // Generated Dart/Flutter app SDK clients are injected through service/runtime boundaries
    return SdkClients();
  }
}
