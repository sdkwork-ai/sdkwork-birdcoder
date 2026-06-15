class Environment {
  final String mode;
  final bool isDevelopment;
  final bool isProduction;

  Environment({
    required this.mode,
    required this.isDevelopment,
    required this.isProduction,
  });

  static Environment resolve() {
    const mode = String.fromEnvironment('FLUTTER_ENV', defaultValue: 'development');
    return Environment(
      mode: mode,
      isDevelopment: mode == 'development',
      isProduction: mode == 'production',
    );
  }
}
