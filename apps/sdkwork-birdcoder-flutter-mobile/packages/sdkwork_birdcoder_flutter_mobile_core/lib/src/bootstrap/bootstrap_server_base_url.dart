String? normalizeBirdCoderServerBaseUrl(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  final parsed = Uri.tryParse(trimmed);
  if (parsed == null || !parsed.hasScheme) {
    return null;
  }

  if (parsed.scheme != 'http' && parsed.scheme != 'https') {
    return null;
  }

  final pathname = parsed.path.replaceAll(RegExp(r'/+$'), '');
  final normalizedPath = pathname == '/' || pathname.isEmpty ? '' : pathname;
  return '${parsed.scheme}://${parsed.host}${parsed.hasPort ? ':${parsed.port}' : ''}$normalizedPath';
}

String? resolveBirdCoderBootstrapServerBaseUrl({
  String? configuredApiBaseUrl,
  String? runtimeApiBaseUrl,
  String? storedApiBaseUrl,
}) {
  return normalizeBirdCoderServerBaseUrl(storedApiBaseUrl) ??
      normalizeBirdCoderServerBaseUrl(runtimeApiBaseUrl) ??
      normalizeBirdCoderServerBaseUrl(configuredApiBaseUrl);
}

bool isBirdCoderLocalRuntimeApiBaseUrl(String apiBaseUrl) {
  final parsed = Uri.tryParse(apiBaseUrl);
  if (parsed == null) {
    return false;
  }

  const localHosts = {'localhost', '127.0.0.1', '::1'};
  return localHosts.contains(parsed.host);
}
