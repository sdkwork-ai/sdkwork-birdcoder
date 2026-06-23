import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

enum BirdCoderAuthSurfaceRoute {
  login,
  register,
  recovery,
  qr,
  oauthCallback,
}

BirdCoderAuthSurfaceRoute resolveBirdCoderAuthSurfaceRoute(String? path) {
  final normalized = (path ?? '').replaceAll(RegExp(r'/+$'), '');
  if (normalized.contains('/oauth/callback')) {
    return BirdCoderAuthSurfaceRoute.oauthCallback;
  }
  if (normalized.endsWith('/qr')) {
    return BirdCoderAuthSurfaceRoute.qr;
  }
  if (normalized.endsWith('/register')) {
    return BirdCoderAuthSurfaceRoute.register;
  }
  if (normalized.endsWith('/recovery')) {
    return BirdCoderAuthSurfaceRoute.recovery;
  }
  return BirdCoderAuthSurfaceRoute.login;
}

BirdCoderOAuthCallbackQuery parseBirdCoderOAuthCallbackQuery(String? path) {
  final uri = Uri.tryParse(path ?? '');
  if (uri == null) {
    return const BirdCoderOAuthCallbackQuery();
  }

  final pathWithHost = uri.host.isEmpty
      ? uri.path
      : '/${uri.host}${uri.path}';
  final providerFromPath = readBirdCoderOAuthProviderFromCallbackPath(pathWithHost);
  final providerFromQuery = uri.queryParameters['provider'];

  return BirdCoderOAuthCallbackQuery(
    code: uri.queryParameters['code'],
    provider: providerFromQuery ?? providerFromPath,
    state: uri.queryParameters['state'],
    error: uri.queryParameters['error'],
    errorDescription: uri.queryParameters['error_description'],
  );
}

class BirdCoderOAuthCallbackQuery {
  final String? code;
  final String? provider;
  final String? state;
  final String? error;
  final String? errorDescription;

  const BirdCoderOAuthCallbackQuery({
    this.code,
    this.provider,
    this.state,
    this.error,
    this.errorDescription,
  });
}

String birdCoderAuthSurfacePath(
  BirdCoderAuthSurfaceRoute route, [
  String basePath = '/auth',
]) {
  final normalizedBase = basePath.replaceAll(RegExp(r'/+$'), '');
  switch (route) {
    case BirdCoderAuthSurfaceRoute.register:
      return '$normalizedBase/register';
    case BirdCoderAuthSurfaceRoute.recovery:
      return '$normalizedBase/recovery';
    case BirdCoderAuthSurfaceRoute.qr:
      return '$normalizedBase/qr';
    case BirdCoderAuthSurfaceRoute.oauthCallback:
      return '$normalizedBase/oauth/callback';
    case BirdCoderAuthSurfaceRoute.login:
      return '$normalizedBase/login';
  }
}
