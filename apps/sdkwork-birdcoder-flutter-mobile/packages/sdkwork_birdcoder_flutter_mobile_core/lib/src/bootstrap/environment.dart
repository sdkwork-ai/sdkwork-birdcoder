class BirdCoderFlutterEnvironment {
  final String mode;
  final String deploymentProfile;
  final String runtimeTarget;
  final String? configuredApiBaseUrl;
  final bool isDevelopment;
  final bool isProduction;

  const BirdCoderFlutterEnvironment({
    required this.mode,
    required this.deploymentProfile,
    required this.runtimeTarget,
    required this.configuredApiBaseUrl,
    required this.isDevelopment,
    required this.isProduction,
  });

  static BirdCoderFlutterEnvironment resolve() {
    const mode = String.fromEnvironment('FLUTTER_ENV', defaultValue: 'development');
    const deploymentProfile = String.fromEnvironment(
      'SDKWORK_DEPLOYMENT_PROFILE',
      defaultValue: 'cloud',
    );
    const runtimeTarget = String.fromEnvironment(
      'SDKWORK_RUNTIME_TARGET',
      defaultValue: 'flutter-mobile',
    );
    const configuredApiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: '',
    );

    return BirdCoderFlutterEnvironment(
      mode: mode,
      deploymentProfile: deploymentProfile,
      runtimeTarget: runtimeTarget,
      configuredApiBaseUrl: configuredApiBaseUrl.isEmpty ? null : configuredApiBaseUrl,
      isDevelopment: mode == 'development',
      isProduction: mode == 'production',
    );
  }
}
