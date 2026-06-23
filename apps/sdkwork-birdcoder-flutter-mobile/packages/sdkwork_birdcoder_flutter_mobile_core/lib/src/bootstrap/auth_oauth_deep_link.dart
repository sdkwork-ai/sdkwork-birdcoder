const birdCoderMobileOAuthScheme = 'birdcoder';
const birdCoderOAuthCallbackAuthority = 'auth';
const birdCoderOAuthCallbackPath = '/oauth/callback';

String buildBirdCoderOAuthCallbackReturnUrl({String? provider}) {
  final uri = Uri(
    scheme: birdCoderMobileOAuthScheme,
    host: birdCoderOAuthCallbackAuthority,
    path: birdCoderOAuthCallbackPath,
  );
  final normalizedProvider = provider?.trim();
  if (normalizedProvider == null || normalizedProvider.isEmpty) {
    return uri.toString();
  }
  return uri.replace(queryParameters: {'provider': normalizedProvider}).toString();
}

String? readBirdCoderOAuthProviderFromCallbackPath(String path) {
  final match = RegExp(r'/oauth/callback/([^/?#]+)').firstMatch(path);
  final provider = match?.group(1)?.trim();
  if (provider == null || provider.isEmpty) {
    return null;
  }
  return provider;
}
