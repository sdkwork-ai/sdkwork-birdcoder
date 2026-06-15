class AppRuntime {
  final String apiBaseUrl;

  AppRuntime({required this.apiBaseUrl});

  static AppRuntime create() {
    return AppRuntime(
      apiBaseUrl: const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3000',
      ),
    );
  }
}
