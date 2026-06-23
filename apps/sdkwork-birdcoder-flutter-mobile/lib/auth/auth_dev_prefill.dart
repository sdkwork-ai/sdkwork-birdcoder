class BirdCoderAuthDevPrefill {
  final String? account;
  final String? password;
  final bool enabled;

  const BirdCoderAuthDevPrefill({
    this.account,
    this.password,
    this.enabled = false,
  });

  static BirdCoderAuthDevPrefill resolve() {
    const mode = String.fromEnvironment('FLUTTER_ENV', defaultValue: 'development');
    const isDevelopment = mode == 'development' || mode == 'test';
    if (!isDevelopment) {
      return const BirdCoderAuthDevPrefill();
    }

    const explicitEnabled = String.fromEnvironment(
      'BIRDCODER_AUTH_DEV_PREFILL_ENABLED',
      defaultValue: '',
    );
    const account = String.fromEnvironment(
      'BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT',
      defaultValue: '',
    );
    const password = String.fromEnvironment(
      'BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD',
      defaultValue: '',
    );

    final enabled = _parseBool(explicitEnabled)
        ?? (account.isNotEmpty || password.isNotEmpty);

    if (!enabled) {
      return const BirdCoderAuthDevPrefill();
    }

    return BirdCoderAuthDevPrefill(
      account: account.isEmpty ? null : account,
      password: password.isEmpty ? null : password,
      enabled: true,
    );
  }
}

bool? _parseBool(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized.isEmpty) {
    return null;
  }
  if (const {'1', 'on', 'true', 'yes'}.contains(normalized)) {
    return true;
  }
  if (const {'0', 'off', 'false', 'no'}.contains(normalized)) {
    return false;
  }
  return null;
}
